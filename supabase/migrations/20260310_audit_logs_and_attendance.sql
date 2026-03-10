-- Incremental migration for attendance batch entry, reversal workflow, and audit logs.
-- This is safe to run on top of the previously applied base schema/policies files.

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.members(id) on delete set null,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    diff_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create or replace function public.current_actor_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select user_profiles.member_id
    from public.user_profiles
    where user_profiles.id = auth.uid()
    limit 1;
$$;

create or replace function public.create_audit_log(
    p_entity_type text,
    p_entity_id uuid,
    p_action text,
    p_diff_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_audit_log_id uuid;
    v_actor_member_id uuid;
begin
    v_actor_member_id := public.current_actor_member_id();

    insert into public.audit_logs (
        actor_id,
        entity_type,
        entity_id,
        action,
        diff_json
    )
    values (
        v_actor_member_id,
        p_entity_type,
        p_entity_id,
        p_action,
        coalesce(p_diff_json, '{}'::jsonb)
    )
    returning id into v_audit_log_id;

    return v_audit_log_id;
end;
$$;

create or replace function public.create_activity_entry(
    p_member_id uuid,
    p_point_rule_id uuid,
    p_note text default null,
    p_reason text default null,
    p_occurred_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_record_id uuid;
    v_activity_type_id uuid;
    v_base_point integer;
    v_season_id uuid;
    v_actor_member_id uuid;
    v_member_name text;
    v_rule_name text;
begin
    select
        point_rules.activity_type_id,
        point_rules.base_point
    into
        v_activity_type_id,
        v_base_point
    from public.point_rules
    where point_rules.id = p_point_rule_id
      and point_rules.is_active = true;

    if v_activity_type_id is null then
        raise exception '활성 점수 규칙 %를 찾을 수 없습니다.', p_point_rule_id;
    end if;

    select seasons.id
    into v_season_id
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    v_actor_member_id := public.current_actor_member_id();

    select members.name
    into v_member_name
    from public.members
    where members.id = p_member_id
    limit 1;

    select activity_types.name
    into v_rule_name
    from public.point_rules
    join public.activity_types on activity_types.id = point_rules.activity_type_id
    where point_rules.id = p_point_rule_id
    limit 1;

    insert into public.activity_records (
        member_id,
        season_id,
        activity_type_id,
        occurred_at,
        status,
        note,
        created_by
    )
    values (
        p_member_id,
        v_season_id,
        v_activity_type_id,
        coalesce(p_occurred_at, now()),
        'confirmed',
        p_note,
        v_actor_member_id
    )
    returning id into v_record_id;

    insert into public.point_ledgers (
        record_id,
        member_id,
        point_rule_id,
        delta,
        reason,
        created_by
    )
    values (
        v_record_id,
        p_member_id,
        p_point_rule_id,
        v_base_point,
        coalesce(p_reason, p_note, '수동 활동 기록'),
        v_actor_member_id
    );

    perform public.create_audit_log(
        'activity_record',
        v_record_id,
        'created',
        jsonb_build_object(
            'summary', concat(coalesce(v_member_name, '알 수 없는 멤버'), ' · ', coalesce(v_rule_name, '활동'), ' 기록 생성'),
            'memberId', p_member_id,
            'memberName', v_member_name,
            'pointRuleId', p_point_rule_id,
            'ruleName', v_rule_name,
            'delta', v_base_point,
            'reason', coalesce(p_reason, p_note, '수동 활동 기록'),
            'occurredAt', coalesce(p_occurred_at, now())
        )
    );

    return v_record_id;
end;
$$;

create or replace function public.create_batch_activity_entries(
    p_member_ids uuid[],
    p_point_rule_id uuid,
    p_note text default null,
    p_reason text default null,
    p_occurred_at timestamptz default now()
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_id uuid;
    v_record_id uuid;
    v_record_ids uuid[] := '{}';
begin
    if coalesce(array_length(p_member_ids, 1), 0) = 0 then
        return v_record_ids;
    end if;

    foreach v_member_id in array p_member_ids loop
        v_record_id := public.create_activity_entry(
            v_member_id,
            p_point_rule_id,
            p_note,
            p_reason,
            p_occurred_at
        );
        v_record_ids := array_append(v_record_ids, v_record_id);
    end loop;

    return v_record_ids;
end;
$$;

create or replace function public.reverse_activity_entry(
    p_record_id uuid,
    p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_original_ledger public.point_ledgers%rowtype;
    v_actor_member_id uuid;
    v_reversal_ledger_id uuid;
    v_member_name text;
    v_rule_name text;
begin
    select point_ledgers.*
    into v_original_ledger
    from public.point_ledgers
    where point_ledgers.record_id = p_record_id
      and point_ledgers.reversal_of is null
    order by point_ledgers.created_at asc
    limit 1;

    if v_original_ledger.id is null then
        raise exception '취소할 원본 기록 %를 찾을 수 없습니다.', p_record_id;
    end if;

    if exists (
        select 1
        from public.point_ledgers
        where point_ledgers.reversal_of = v_original_ledger.id
    ) then
        raise exception '이미 취소된 기록입니다.';
    end if;

    v_actor_member_id := public.current_actor_member_id();

    select members.name
    into v_member_name
    from public.members
    where members.id = v_original_ledger.member_id
    limit 1;

    select activity_types.name
    into v_rule_name
    from public.point_rules
    join public.activity_types on activity_types.id = point_rules.activity_type_id
    where point_rules.id = v_original_ledger.point_rule_id
    limit 1;

    insert into public.point_ledgers (
        record_id,
        member_id,
        point_rule_id,
        delta,
        reason,
        created_by,
        reversal_of
    )
    values (
        v_original_ledger.record_id,
        v_original_ledger.member_id,
        v_original_ledger.point_rule_id,
        v_original_ledger.delta * -1,
        coalesce(p_note, concat('기록 취소 · ', coalesce(v_original_ledger.reason, '원본 기록'))),
        v_actor_member_id,
        v_original_ledger.id
    )
    returning id into v_reversal_ledger_id;

    update public.activity_records
    set status = 'reversed'
    where activity_records.id = p_record_id;

    perform public.create_audit_log(
        'activity_record',
        p_record_id,
        'reversed',
        jsonb_build_object(
            'summary', concat(coalesce(v_member_name, '알 수 없는 멤버'), ' · ', coalesce(v_rule_name, '활동'), ' 기록 취소'),
            'memberId', v_original_ledger.member_id,
            'memberName', v_member_name,
            'pointRuleId', v_original_ledger.point_rule_id,
            'ruleName', v_rule_name,
            'reversalLedgerId', v_reversal_ledger_id,
            'reversalOf', v_original_ledger.id,
            'delta', v_original_ledger.delta * -1,
            'reason', coalesce(p_note, concat('기록 취소 · ', coalesce(v_original_ledger.reason, '원본 기록')))
        )
    );

    return v_reversal_ledger_id;
end;
$$;

create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

revoke insert, update on public.activity_records from anon, authenticated;
revoke insert, update on public.point_ledgers from anon, authenticated;

grant select on public.audit_logs to authenticated;
grant execute on function public.create_activity_entry(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.create_batch_activity_entries(uuid[], uuid, text, text, timestamptz) to authenticated;
grant execute on function public.reverse_activity_entry(uuid, text) to authenticated;

drop policy if exists activity_records_insert_all on public.activity_records;
drop policy if exists activity_records_update_all on public.activity_records;
drop policy if exists point_ledgers_insert_all on public.point_ledgers;
drop policy if exists point_ledgers_update_all on public.point_ledgers;
drop policy if exists audit_logs_select_authenticated on public.audit_logs;

create policy audit_logs_select_authenticated
on public.audit_logs
for select
to authenticated
using (true);

insert into public.activity_types (code, name, group_name)
values ('attendance-absent', '불참', 'attendance')
on conflict (code) do nothing;

insert into public.point_rules (activity_type_id, base_point, penalty_point, condition_json, is_active, version)
select activity_types.id, 0, 0, '{}'::jsonb, true, 1
from public.activity_types
where activity_types.code = 'attendance-absent'
  and not exists (
      select 1
      from public.point_rules
      where point_rules.activity_type_id = activity_types.id
        and point_rules.version = 1
  );
