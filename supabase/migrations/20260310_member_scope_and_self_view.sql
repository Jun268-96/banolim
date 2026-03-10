-- Incremental migration for member self-view scope and role-aware read/write restrictions.
-- Safe to run after the base schema/policies files and the audit log migration.

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select user_profiles.app_role
    from public.user_profiles
    where user_profiles.id = auth.uid()
    limit 1;
$$;

create or replace function public.member_team_id(p_member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select members.team_id
    from public.members
    where members.id = p_member_id
    limit 1;
$$;

create or replace function public.can_manage_admin_tables()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_app_role(), 'member') in ('super_admin', 'operator');
$$;

create or replace function public.can_manage_activities()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_app_role(), 'member') in ('super_admin', 'operator', 'team_lead');
$$;

create or replace function public.can_access_member(p_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_app_role text;
    v_current_member_id uuid;
    v_current_team_id uuid;
    v_target_team_id uuid;
begin
    v_app_role := coalesce(public.current_app_role(), 'member');

    if v_app_role in ('super_admin', 'operator') then
        return true;
    end if;

    v_current_member_id := public.current_actor_member_id();

    if v_current_member_id is null then
        return false;
    end if;

    if p_member_id = v_current_member_id then
        return true;
    end if;

    if v_app_role = 'team_lead' then
        v_current_team_id := public.member_team_id(v_current_member_id);
        v_target_team_id := public.member_team_id(p_member_id);

        return v_current_team_id is not null
           and v_target_team_id is not null
           and v_current_team_id = v_target_team_id;
    end if;

    return false;
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

create or replace function public.get_my_member_overview()
returns table (
    id uuid,
    name text,
    score integer,
    is_approved boolean,
    role_id uuid,
    role_name text,
    team_id uuid,
    team_name text,
    status public.member_status,
    joined_at date,
    is_visible boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        m.id,
        m.name,
        coalesce(sum(pl.delta), 0)::integer as score,
        m.is_approved,
        m.role_id,
        r.name as role_name,
        m.team_id,
        t.name as team_name,
        m.status,
        m.joined_at,
        m.is_visible
    from public.members m
    left join public.roles r on r.id = m.role_id
    left join public.teams t on t.id = m.team_id
    left join public.point_ledgers pl on pl.member_id = m.id
    where m.id = public.current_actor_member_id()
      and m.is_visible = true
    group by m.id, m.name, m.is_approved, m.role_id, r.name, m.team_id, t.name, m.status, m.joined_at, m.is_visible;
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
    v_app_role text;
    v_reversal_ledger_id uuid;
    v_member_name text;
    v_rule_name text;
begin
    v_app_role := coalesce(public.current_app_role(), 'member');

    if v_app_role not in ('super_admin', 'operator', 'team_lead') then
        raise exception '활동 기록 권한이 없습니다.';
    end if;

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

create or replace view public.member_score_summary
with (security_invoker = true) as
select
    m.id,
    m.name,
    m.is_approved,
    coalesce(sum(pl.delta), 0)::integer as score
from public.members m
left join public.point_ledgers pl on pl.member_id = m.id
where m.is_visible = true
group by m.id, m.name, m.is_approved;

create or replace view public.activity_log_feed
with (security_invoker = true) as
select
    pl.id,
    pl.created_at as timestamp,
    pl.member_id,
    pl.point_rule_id as category_id,
    pl.delta as point_delta,
    pl.reason
from public.point_ledgers pl;

grant execute on function public.create_activity_entry(uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.create_batch_activity_entries(uuid[], uuid, text, text, timestamptz) to authenticated;
grant execute on function public.get_my_activity_logs() to authenticated;
grant execute on function public.get_my_member_overview() to authenticated;
grant execute on function public.reverse_activity_entry(uuid, text) to authenticated;

drop policy if exists roles_insert_all on public.roles;
create policy roles_insert_all on public.roles for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists roles_update_all on public.roles;
create policy roles_update_all on public.roles for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists teams_insert_all on public.teams;
create policy teams_insert_all on public.teams for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists teams_update_all on public.teams;
create policy teams_update_all on public.teams for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists seasons_insert_all on public.seasons;
create policy seasons_insert_all on public.seasons for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists seasons_update_all on public.seasons;
create policy seasons_update_all on public.seasons for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists members_select_all on public.members;
create policy members_select_all on public.members for select to authenticated using (public.can_access_member(id));
drop policy if exists members_insert_all on public.members;
create policy members_insert_all on public.members for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists members_update_all on public.members;
create policy members_update_all on public.members for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists activity_types_insert_all on public.activity_types;
create policy activity_types_insert_all on public.activity_types for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists activity_types_update_all on public.activity_types;
create policy activity_types_update_all on public.activity_types for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists point_rules_insert_all on public.point_rules;
create policy point_rules_insert_all on public.point_rules for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists point_rules_update_all on public.point_rules;
create policy point_rules_update_all on public.point_rules for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists activity_records_select_all on public.activity_records;
create policy activity_records_select_all on public.activity_records for select to authenticated using (public.can_access_member(member_id));

drop policy if exists point_ledgers_select_all on public.point_ledgers;
create policy point_ledgers_select_all on public.point_ledgers for select to authenticated using (public.can_access_member(member_id));

drop policy if exists audit_logs_select_authenticated on public.audit_logs;
create policy audit_logs_select_authenticated on public.audit_logs for select to authenticated using (public.can_manage_activities());
