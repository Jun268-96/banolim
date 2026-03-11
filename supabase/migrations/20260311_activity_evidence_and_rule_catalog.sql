alter table public.activity_records
add column if not exists evidence_url text;

drop function if exists public.create_batch_activity_entries(uuid[], uuid, text, text, timestamptz);
drop function if exists public.create_batch_activity_entries(uuid[], uuid, text, text, timestamptz, text);
drop function if exists public.create_activity_entry(uuid, uuid, text, text, timestamptz);
drop function if exists public.create_activity_entry(uuid, uuid, text, text, timestamptz, text);
drop function if exists public.create_point_rule_version(uuid, integer, integer, jsonb);
drop function if exists public.get_my_activity_logs();

create or replace function public.create_point_rule_version(
    p_source_rule_id uuid,
    p_base_point integer,
    p_penalty_point integer default 0,
    p_condition_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_source_rule public.point_rules%rowtype;
    v_new_rule_id uuid;
    v_rule_name text;
begin
    if not public.can_manage_admin_tables() then
        raise exception '점수 규칙을 관리할 권한이 없습니다.';
    end if;

    select point_rules.*
    into v_source_rule
    from public.point_rules
    where point_rules.id = p_source_rule_id
    limit 1;

    if v_source_rule.id is null then
        raise exception '기준 점수 규칙을 찾지 못했습니다.';
    end if;

    insert into public.point_rules (
        activity_type_id,
        base_point,
        penalty_point,
        condition_json,
        is_active,
        version
    )
    values (
        v_source_rule.activity_type_id,
        p_base_point,
        coalesce(p_penalty_point, 0),
        coalesce(p_condition_json, '{}'::jsonb),
        true,
        v_source_rule.version + 1
    )
    returning id into v_new_rule_id;

    update public.point_rules
    set is_active = false
    where point_rules.id = p_source_rule_id;

    select activity_types.name
    into v_rule_name
    from public.activity_types
    where activity_types.id = v_source_rule.activity_type_id
    limit 1;

    perform public.create_audit_log(
        'point_rule',
        v_new_rule_id,
        'version_created',
        jsonb_build_object(
            'summary', concat(coalesce(v_rule_name, '알 수 없는 규칙'), ' 규칙 v', v_source_rule.version + 1, ' 생성'),
            'sourceRuleId', p_source_rule_id,
            'newRuleId', v_new_rule_id,
            'activityTypeId', v_source_rule.activity_type_id,
            'ruleName', v_rule_name,
            'basePoint', p_base_point,
            'penaltyPoint', coalesce(p_penalty_point, 0),
            'condition', coalesce(p_condition_json, '{}'::jsonb)
        )
    );

    return v_new_rule_id;
end;
$$;

create or replace function public.create_activity_entry(
    p_member_id uuid,
    p_point_rule_id uuid,
    p_note text default null,
    p_reason text default null,
    p_occurred_at timestamptz default now(),
    p_evidence_url text default null
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
    v_app_role text;
    v_member_name text;
    v_rule_name text;
begin
    v_app_role := coalesce(public.current_app_role(), 'member');

    if v_app_role not in ('super_admin', 'operator', 'team_lead') then
        raise exception '활동 기록 권한이 없습니다.';
    end if;

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
        evidence_url,
        created_by
    )
    values (
        p_member_id,
        v_season_id,
        v_activity_type_id,
        coalesce(p_occurred_at, now()),
        'confirmed',
        p_note,
        nullif(btrim(coalesce(p_evidence_url, '')), ''),
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
            'occurredAt', coalesce(p_occurred_at, now()),
            'evidenceUrl', nullif(btrim(coalesce(p_evidence_url, '')), '')
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
    p_occurred_at timestamptz default now(),
    p_evidence_url text default null
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
            p_occurred_at,
            p_evidence_url
        );
        v_record_ids := array_append(v_record_ids, v_record_id);
    end loop;

    return v_record_ids;
end;
$$;

create or replace function public.get_my_activity_logs()
returns table (
    id uuid,
    record_id uuid,
    "timestamp" timestamptz,
    member_id uuid,
    member_name text,
    category_id uuid,
    category_name text,
    point_delta integer,
    reason text,
    note text,
    evidence_url text,
    reversal_of uuid,
    is_reversal boolean,
    record_status text
)
language sql
stable
security definer
set search_path = public
as $$
    select
        pl.id,
        pl.record_id,
        case
            when pl.reversal_of is not null then pl.created_at
            else coalesce(ar.occurred_at, pl.created_at)
        end as "timestamp",
        pl.member_id,
        m.name as member_name,
        pl.point_rule_id as category_id,
        at.name as category_name,
        pl.delta as point_delta,
        pl.reason,
        ar.note,
        ar.evidence_url,
        pl.reversal_of,
        (pl.reversal_of is not null) as is_reversal,
        coalesce(ar.status, 'confirmed') as record_status
    from public.point_ledgers pl
    join public.members m on m.id = pl.member_id
    join public.activity_records ar on ar.id = pl.record_id
    join public.point_rules pr on pr.id = pl.point_rule_id
    join public.activity_types at on at.id = pr.activity_type_id
    where pl.member_id = public.current_actor_member_id()
    order by timestamp desc;
$$;

grant execute on function public.create_activity_entry(uuid, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.create_batch_activity_entries(uuid[], uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.create_point_rule_version(uuid, integer, integer, jsonb) to authenticated;
grant execute on function public.get_my_activity_logs() to authenticated;

create or replace view public.point_rule_catalog as
select
    pr.id,
    pr.activity_type_id,
    at.name as category_name,
    pr.base_point as point_value,
    pr.is_active,
    pr.version,
    at.group_name,
    pr.penalty_point,
    pr.condition_json
from public.point_rules pr
join public.activity_types at on at.id = pr.activity_type_id;
