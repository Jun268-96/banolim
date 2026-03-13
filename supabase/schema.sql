create extension if not exists pgcrypto;

do $$
begin
    create type public.member_status as enum ('active', 'dormant', 'inactive');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.team_type as enum ('core', 'study', 'project');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.season_status as enum ('planned', 'active', 'closed');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.correction_request_status as enum ('pending', 'reviewing', 'resolved', 'rejected');
exception
    when duplicate_object then null;
end
$$;

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    permission_scope text not null,
    rank_order integer not null default 100,
    created_at timestamptz not null default now()
);

create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    type public.team_type not null default 'core',
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.activity_groups (
    code text primary key,
    name text not null unique,
    sort_order integer not null default 100,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.seasons (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    start_date date not null,
    end_date date,
    status public.season_status not null default 'planned',
    created_at timestamptz not null default now()
);

create table if not exists public.members (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    login_email text,
    auth_user_id uuid,
    auth_provisioned_at timestamptz,
    password_reset_required boolean not null default false,
    role_id uuid references public.roles(id) on delete set null,
    team_id uuid references public.teams(id) on delete set null,
    status public.member_status not null default 'active',
    joined_at date not null default current_date,
    avatar_key text,
    is_visible boolean not null default true,
    is_approved boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.member_team_links (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (member_id, team_id)
);

create table if not exists public.activity_types (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    group_name text not null default 'general',
    created_at timestamptz not null default now()
);

create table if not exists public.point_rules (
    id uuid primary key default gen_random_uuid(),
    activity_type_id uuid not null references public.activity_types(id) on delete restrict,
    base_point integer not null,
    penalty_point integer not null default 0,
    condition_json jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    version integer not null default 1,
    created_at timestamptz not null default now()
);

create table if not exists public.activity_records (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    season_id uuid references public.seasons(id) on delete set null,
    activity_type_id uuid not null references public.activity_types(id) on delete restrict,
    occurred_at timestamptz not null default now(),
    status text not null default 'confirmed',
    note text,
    evidence_url text,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.point_ledgers (
    id uuid primary key default gen_random_uuid(),
    record_id uuid not null references public.activity_records(id) on delete cascade,
    member_id uuid not null references public.members(id) on delete cascade,
    point_rule_id uuid not null references public.point_rules(id) on delete restrict,
    delta integer not null,
    reason text,
    created_by uuid references public.members(id) on delete set null,
    reversal_of uuid references public.point_ledgers(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.members(id) on delete set null,
    entity_type text not null,
    entity_id uuid not null,
    action text not null,
    diff_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists public.correction_requests (
    id uuid primary key default gen_random_uuid(),
    requester_member_id uuid not null references public.members(id) on delete cascade,
    activity_record_id uuid not null references public.activity_records(id) on delete cascade,
    status public.correction_request_status not null default 'pending',
    reason text not null,
    review_note text,
    reviewed_by uuid references public.members(id) on delete set null,
    reviewed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.badges (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text not null,
    icon_key text not null,
    image_url text,
    tone text not null default 'sky',
    evaluation_scope text not null default 'season',
    criteria_json jsonb not null default '{}'::jsonb,
    sort_order integer not null default 100,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.badges
    drop constraint if exists badges_evaluation_scope_check;

alter table public.badges
    add constraint badges_evaluation_scope_check
    check (evaluation_scope in ('season', 'lifetime'));

alter table public.badges
    drop constraint if exists badges_criteria_json_object_check;

alter table public.badges
    add constraint badges_criteria_json_object_check
    check (jsonb_typeof(criteria_json) = 'object');

create table if not exists public.member_badges (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    badge_id uuid not null references public.badges(id) on delete cascade,
    awarded_at timestamptz not null default now(),
    season_id uuid references public.seasons(id) on delete set null
);

create table if not exists public.announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    starts_at timestamptz,
    ends_at timestamptz,
    is_pinned boolean not null default false,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.schedule_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    location text,
    start_at timestamptz not null,
    end_at timestamptz,
    season_id uuid references public.seasons(id) on delete set null,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.site_banners (
    id uuid primary key default gen_random_uuid(),
    title text,
    image_url text not null,
    display_order integer not null default 100,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.recap_snapshots (
    id uuid primary key default gen_random_uuid(),
    snapshot_scope text not null check (snapshot_scope in ('member', 'overall')),
    period_type text not null check (period_type in ('month', 'season')),
    title text not null,
    subtitle text not null,
    summary text not null,
    badge_label text not null,
    note text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    member_id uuid references public.members(id) on delete set null,
    member_name text,
    season_id uuid references public.seasons(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.attendance_sessions (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    session_code text not null unique,
    point_rule_id uuid not null references public.point_rules(id) on delete restrict,
    season_id uuid references public.seasons(id) on delete set null,
    starts_at timestamptz not null,
    ends_at timestamptz,
    note text,
    is_active boolean not null default true,
    target_group_type text not null default 'all' check (target_group_type in ('all', 'team', 'ungrouped')),
    target_team_id uuid references public.teams(id) on delete set null,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.attendance_checkins (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.attendance_sessions(id) on delete cascade,
    member_id uuid not null references public.members(id) on delete cascade,
    activity_record_id uuid not null references public.activity_records(id) on delete cascade,
    point_ledger_id uuid not null references public.point_ledgers(id) on delete cascade,
    checked_in_at timestamptz not null default now()
);

create table if not exists public.attendance_session_members (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.attendance_sessions(id) on delete cascade,
    member_id uuid not null references public.members(id) on delete cascade,
    attendance_status text not null default 'present' check (attendance_status in ('present', 'late', 'absent')),
    activity_record_id uuid references public.activity_records(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

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
    select coalesce(
        (
            select members.team_id
            from public.members
            where members.id = p_member_id
            limit 1
        ),
        (
            select member_team_links.team_id
            from public.member_team_links
            where member_team_links.member_id = p_member_id
            order by member_team_links.created_at asc
            limit 1
        )
    );
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

create or replace function public.swap_banner_display_order(
    p_first_banner_id uuid,
    p_second_banner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_first_order integer;
    v_second_order integer;
begin
    if not public.can_manage_admin_tables() then
        raise exception '배너 순서를 변경할 권한이 없습니다.';
    end if;

    select display_order
    into v_first_order
    from public.site_banners
    where id = p_first_banner_id
    for update;

    select display_order
    into v_second_order
    from public.site_banners
    where id = p_second_banner_id
    for update;

    if v_first_order is null or v_second_order is null then
        raise exception '순서를 변경할 배너를 찾지 못했습니다.';
    end if;

    update public.site_banners
    set display_order = case
        when id = p_first_banner_id then v_second_order
        when id = p_second_banner_id then v_first_order
        else display_order
    end
    where id in (p_first_banner_id, p_second_banner_id);
end;
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
        return exists (
            select 1
            from public.member_team_links current_links
            join public.member_team_links target_links
              on target_links.team_id = current_links.team_id
            where current_links.member_id = v_current_member_id
              and target_links.member_id = p_member_id
        ) or public.member_team_id(v_current_member_id) = public.member_team_id(p_member_id);
    end if;

    return false;
end;
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

create or replace function public.audit_member_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_changes jsonb := '{}'::jsonb;
    v_summary text;
    v_previous_role_name text;
    v_next_role_name text;
    v_previous_team_name text;
    v_next_team_name text;
begin
    if tg_op = 'INSERT' then
        select roles.name
        into v_next_role_name
        from public.roles
        where roles.id = new.role_id
        limit 1;

        select teams.name
        into v_next_team_name
        from public.teams
        where teams.id = new.team_id
        limit 1;

        perform public.create_audit_log(
            'member',
            new.id,
            'created',
            jsonb_build_object(
                'summary', concat(new.name, ' 멤버 등록'),
                'memberName', new.name,
                'changes', jsonb_build_object(
                    'loginEmail', jsonb_build_object('to', new.login_email),
                    'role', jsonb_build_object(
                        'toId', new.role_id,
                        'toName', v_next_role_name,
                        'toScope', public.member_role_scope(new.role_id)
                    ),
                    'team', jsonb_build_object(
                        'toId', new.team_id,
                        'toName', v_next_team_name
                    ),
                    'status', jsonb_build_object('to', new.status),
                    'approval', jsonb_build_object('to', new.is_approved),
                    'visibility', jsonb_build_object('to', new.is_visible)
                )
            )
        );

        return new;
    end if;

    select roles.name
    into v_previous_role_name
    from public.roles
    where roles.id = old.role_id
    limit 1;

    select roles.name
    into v_next_role_name
    from public.roles
    where roles.id = new.role_id
    limit 1;

    select teams.name
    into v_previous_team_name
    from public.teams
    where teams.id = old.team_id
    limit 1;

    select teams.name
    into v_next_team_name
    from public.teams
    where teams.id = new.team_id
    limit 1;

    if old.name is distinct from new.name then
        v_changes := v_changes || jsonb_build_object(
            'name',
            jsonb_build_object('from', old.name, 'to', new.name)
        );
    end if;

    if old.login_email is distinct from new.login_email then
        v_changes := v_changes || jsonb_build_object(
            'loginEmail',
            jsonb_build_object('from', old.login_email, 'to', new.login_email)
        );
    end if;

    if old.role_id is distinct from new.role_id then
        v_changes := v_changes || jsonb_build_object(
            'role',
            jsonb_build_object(
                'fromId', old.role_id,
                'fromName', v_previous_role_name,
                'fromScope', public.member_role_scope(old.role_id),
                'toId', new.role_id,
                'toName', v_next_role_name,
                'toScope', public.member_role_scope(new.role_id)
            )
        );
    end if;

    if old.team_id is distinct from new.team_id then
        v_changes := v_changes || jsonb_build_object(
            'team',
            jsonb_build_object(
                'fromId', old.team_id,
                'fromName', v_previous_team_name,
                'toId', new.team_id,
                'toName', v_next_team_name
            )
        );
    end if;

    if old.status is distinct from new.status then
        v_changes := v_changes || jsonb_build_object(
            'status',
            jsonb_build_object('from', old.status, 'to', new.status)
        );
    end if;

    if old.is_approved is distinct from new.is_approved then
        v_changes := v_changes || jsonb_build_object(
            'approval',
            jsonb_build_object('from', old.is_approved, 'to', new.is_approved)
        );
    end if;

    if old.is_visible is distinct from new.is_visible then
        v_changes := v_changes || jsonb_build_object(
            'visibility',
            jsonb_build_object('from', old.is_visible, 'to', new.is_visible)
        );
    end if;

    if v_changes = '{}'::jsonb then
        return new;
    end if;

    v_summary := case
        when v_changes ? 'role' then concat(new.name, ' · 직책/권한 변경')
        when v_changes ? 'loginEmail' then concat(new.name, ' · 로그인 이메일 변경')
        when v_changes ? 'approval' then concat(new.name, ' · 승인 상태 변경')
        when v_changes ? 'status' then concat(new.name, ' · 회원 상태 변경')
        when v_changes ? 'team' then concat(new.name, ' · 소속 팀 변경')
        else concat(new.name, ' · 회원 정보 수정')
    end;

    perform public.create_audit_log(
        'member',
        new.id,
        'updated',
        jsonb_build_object(
            'summary', v_summary,
            'memberName', new.name,
            'changes', v_changes
        )
    );

    return new;
end;
$$;

drop trigger if exists trg_members_audit on public.members;
create trigger trg_members_audit
after insert or update on public.members
for each row
execute function public.audit_member_changes();

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

    perform public.award_member_badges(p_member_id);

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

create or replace function public.create_attendance_session(
    p_title text,
    p_point_rule_id uuid,
    p_starts_at timestamptz,
    p_ends_at timestamptz default null,
    p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_member_id uuid;
    v_session_id uuid;
    v_session_code text;
    v_season_id uuid;
    v_rule_name text;
begin
    if not public.can_manage_activities() then
        raise exception '출석 세션을 생성할 권한이 없습니다.';
    end if;

    if nullif(btrim(coalesce(p_title, '')), '') is null then
        raise exception '출석 세션 제목을 입력해 주세요.';
    end if;

    if p_ends_at is not null and p_ends_at <= p_starts_at then
        raise exception '종료 시각은 시작 시각보다 뒤여야 합니다.';
    end if;

    select seasons.id
    into v_season_id
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    loop
        v_session_code := upper(substring(encode(gen_random_bytes(4), 'hex') from 1 for 8));
        exit when not exists (
            select 1
            from public.attendance_sessions
            where attendance_sessions.session_code = v_session_code
        );
    end loop;

    v_actor_member_id := public.current_actor_member_id();

    insert into public.attendance_sessions (
        title,
        session_code,
        point_rule_id,
        season_id,
        starts_at,
        ends_at,
        note,
        is_active,
        created_by
    )
    values (
        btrim(p_title),
        v_session_code,
        p_point_rule_id,
        v_season_id,
        p_starts_at,
        p_ends_at,
        nullif(btrim(coalesce(p_note, '')), ''),
        true,
        v_actor_member_id
    )
    returning id into v_session_id;

    select activity_types.name
    into v_rule_name
    from public.point_rules
    join public.activity_types on activity_types.id = point_rules.activity_type_id
    where point_rules.id = p_point_rule_id
    limit 1;

    perform public.create_audit_log(
        'attendance_session',
        v_session_id,
        'created',
        jsonb_build_object(
            'summary', concat(btrim(p_title), ' 출석 세션 생성'),
            'title', btrim(p_title),
            'sessionCode', v_session_code,
            'pointRuleId', p_point_rule_id,
            'ruleName', v_rule_name,
            'startsAt', p_starts_at,
            'endsAt', p_ends_at,
            'note', nullif(btrim(coalesce(p_note, '')), '')
        )
    );

    return v_session_id;
end;
$$;

create or replace function public.submit_attendance_checkin(
    p_session_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_member_id uuid;
    v_session public.attendance_sessions%rowtype;
    v_activity_type_id uuid;
    v_base_point integer;
    v_record_id uuid;
    v_ledger_id uuid;
    v_member_name text;
begin
    v_actor_member_id := public.current_actor_member_id();

    if v_actor_member_id is null then
        raise exception '체크인할 회원 정보를 찾지 못했습니다.';
    end if;

    select attendance_sessions.*
    into v_session
    from public.attendance_sessions
    where upper(attendance_sessions.session_code) = upper(btrim(coalesce(p_session_code, '')))
      and attendance_sessions.is_active = true
    limit 1;

    if v_session.id is null then
        raise exception '사용 가능한 출석 코드가 아닙니다.';
    end if;

    if now() < v_session.starts_at then
        raise exception '아직 시작 전인 출석 세션입니다.';
    end if;

    if v_session.ends_at is not null and now() > v_session.ends_at then
        raise exception '이미 종료된 출석 세션입니다.';
    end if;

    if exists (
        select 1
        from public.attendance_checkins
        where attendance_checkins.session_id = v_session.id
          and attendance_checkins.member_id = v_actor_member_id
    ) then
        raise exception '이미 체크인한 출석 세션입니다.';
    end if;

    select
        point_rules.activity_type_id,
        point_rules.base_point
    into
        v_activity_type_id,
        v_base_point
    from public.point_rules
    where point_rules.id = v_session.point_rule_id
      and point_rules.is_active = true;

    if v_activity_type_id is null then
        raise exception '이 출석 세션의 점수 규칙을 찾지 못했습니다.';
    end if;

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
        v_actor_member_id,
        v_session.season_id,
        v_activity_type_id,
        now(),
        'confirmed',
        coalesce(v_session.note, concat(v_session.title, ' 셀프 체크인')),
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
        v_actor_member_id,
        v_session.point_rule_id,
        v_base_point,
        concat(v_session.title, ' 출석 체크'),
        v_actor_member_id
    )
    returning id into v_ledger_id;

    insert into public.attendance_checkins (
        session_id,
        member_id,
        activity_record_id,
        point_ledger_id
    )
    values (
        v_session.id,
        v_actor_member_id,
        v_record_id,
        v_ledger_id
    );

    select members.name
    into v_member_name
    from public.members
    where members.id = v_actor_member_id
    limit 1;

    perform public.create_audit_log(
        'attendance_session',
        v_session.id,
        'checked_in',
        jsonb_build_object(
            'summary', concat(coalesce(v_member_name, '알 수 없는 회원'), ' · ', v_session.title, ' 체크인'),
            'memberId', v_actor_member_id,
            'memberName', v_member_name,
            'sessionCode', v_session.session_code,
            'recordId', v_record_id,
            'pointLedgerId', v_ledger_id,
            'delta', v_base_point
        )
    );

    perform public.award_member_badges(v_actor_member_id);

    return v_record_id;
end;
$$;

create or replace function public.award_member_badges(
    p_member_id uuid default public.current_actor_member_id()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_active_season_id uuid;
    v_badge record;
    v_existing_badge record;
    v_target_season_id uuid;
    v_metrics jsonb;
    v_is_eligible boolean := false;
    v_awarded integer := 0;
    v_row_count integer := 0;
begin
    if p_member_id is null then
        return 0;
    end if;

    if not public.can_access_member(p_member_id) and not public.can_manage_activities() then
        raise exception '해당 회원의 배지를 갱신할 권한이 없습니다.';
    end if;

    select seasons.id
    into v_active_season_id
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    for v_badge in
        select id, evaluation_scope, criteria_json, is_active
        from public.badges
    loop
        select *
        into v_existing_badge
        from public.member_badges
        where member_badges.member_id = p_member_id
          and member_badges.badge_id = v_badge.id
        limit 1;

        if not coalesce(v_badge.is_active, false) then
            if v_existing_badge.id is not null then
                delete from public.member_badges
                where member_badges.id = v_existing_badge.id;
            end if;
            continue;
        end if;

        v_target_season_id := null;
        if coalesce(v_badge.evaluation_scope, 'season') = 'season' then
            v_target_season_id := coalesce(v_existing_badge.season_id, v_active_season_id);
        end if;

        v_metrics := public.get_member_badge_metrics(
            p_member_id,
            coalesce(v_badge.evaluation_scope, 'season'),
            v_target_season_id
        );
        v_is_eligible := public.badge_criteria_met(v_badge.criteria_json, v_metrics);

        if v_is_eligible and v_existing_badge.id is null then
            insert into public.member_badges (member_id, badge_id, season_id)
            values (
                p_member_id,
                v_badge.id,
                case
                    when coalesce(v_badge.evaluation_scope, 'season') = 'season' then v_target_season_id
                    else null
                end
            )
            on conflict (member_id, badge_id) do nothing;
            get diagnostics v_row_count = row_count;
            v_awarded := v_awarded + v_row_count;
        elsif not v_is_eligible and v_existing_badge.id is not null then
            delete from public.member_badges
            where member_badges.id = v_existing_badge.id;
        end if;
    end loop;

    return v_awarded;
end;
$$;

create or replace function public.get_member_badge_metrics(
    p_member_id uuid,
    p_scope text default 'season',
    p_season_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_activity_count integer := 0;
    v_attendance_count integer := 0;
    v_spotlight_count integer := 0;
    v_unique_activity_types integer := 0;
    v_evidence_count integer := 0;
    v_active_days integer := 0;
    v_total_points integer := 0;
begin
    if p_member_id is null then
        return jsonb_build_object(
            'activityCount', 0,
            'attendanceCount', 0,
            'spotlightCount', 0,
            'uniqueActivityTypeCount', 0,
            'evidenceCount', 0,
            'activeDayCount', 0,
            'totalPoints', 0
        );
    end if;

    if p_scope = 'season' and p_season_id is null then
        return jsonb_build_object(
            'activityCount', 0,
            'attendanceCount', 0,
            'spotlightCount', 0,
            'uniqueActivityTypeCount', 0,
            'evidenceCount', 0,
            'activeDayCount', 0,
            'totalPoints', 0
        );
    end if;

    select
        count(*)::integer,
        count(*) filter (where activity_types.name ~* '(출석|참석|지각|불참|attendance|present|late|absent)')::integer,
        count(*) filter (where point_ledgers.delta >= 20 or activity_types.name ~* '(발표|세션|리딩|presentation|session|reading)')::integer,
        count(distinct activity_records.activity_type_id)::integer,
        count(*) filter (where nullif(btrim(coalesce(activity_records.evidence_url, '')), '') is not null)::integer,
        count(distinct (activity_records.occurred_at::date))::integer,
        coalesce(sum(point_ledgers.delta), 0)::integer
    into
        v_activity_count,
        v_attendance_count,
        v_spotlight_count,
        v_unique_activity_types,
        v_evidence_count,
        v_active_days,
        v_total_points
    from public.activity_records
    join public.point_ledgers on point_ledgers.record_id = activity_records.id
        and point_ledgers.member_id = activity_records.member_id
        and point_ledgers.reversal_of is null
    join public.point_rules on point_rules.id = point_ledgers.point_rule_id
    join public.activity_types on activity_types.id = point_rules.activity_type_id
    where activity_records.member_id = p_member_id
      and coalesce(activity_records.status, 'confirmed') <> 'reversed'
      and (
          p_scope <> 'season'
          or activity_records.season_id = p_season_id
      );

    return jsonb_build_object(
        'activityCount', coalesce(v_activity_count, 0),
        'attendanceCount', coalesce(v_attendance_count, 0),
        'spotlightCount', coalesce(v_spotlight_count, 0),
        'uniqueActivityTypeCount', coalesce(v_unique_activity_types, 0),
        'evidenceCount', coalesce(v_evidence_count, 0),
        'activeDayCount', coalesce(v_active_days, 0),
        'totalPoints', coalesce(v_total_points, 0)
    );
end;
$$;

create or replace function public.badge_criteria_met(
    p_criteria jsonb,
    p_metrics jsonb
)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
declare
    v_criteria jsonb := coalesce(p_criteria, '{}'::jsonb);
    v_metric_key text;
    v_target integer;
begin
    if jsonb_typeof(v_criteria) <> 'object' or v_criteria = '{}'::jsonb then
        return false;
    end if;

    for v_metric_key, v_target in
        select key, value::integer
        from jsonb_each_text(v_criteria)
    loop
        if coalesce((p_metrics ->> v_metric_key)::integer, 0) < v_target then
            return false;
        end if;
    end loop;

    return true;
end;
$$;

create or replace function public.get_member_team_ids(
    p_member_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        array_agg(team_id order by sort_rank asc, sort_created_at asc),
        '{}'::uuid[]
    )
    from (
        select
            team_rows.team_id,
            min(team_rows.sort_rank) as sort_rank,
            min(team_rows.sort_created_at) as sort_created_at
        from (
            select
                members.team_id,
                0 as sort_rank,
                members.created_at as sort_created_at
            from public.members
            where members.id = p_member_id
              and members.team_id is not null

            union all

            select
                member_team_links.team_id,
                1 as sort_rank,
                member_team_links.created_at as sort_created_at
            from public.member_team_links
            where member_team_links.member_id = p_member_id
        ) as team_rows
        group by team_rows.team_id
    ) as ordered_teams;
$$;

create or replace function public.recalculate_member_primary_team(
    p_member_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_next_team_id uuid;
begin
    select member_team_links.team_id
    into v_next_team_id
    from public.member_team_links
    where member_team_links.member_id = p_member_id
    order by member_team_links.created_at asc
    limit 1;

    update public.members
    set team_id = v_next_team_id
    where members.id = p_member_id
      and members.team_id is distinct from v_next_team_id;

    return v_next_team_id;
end;
$$;

create or replace function public.refresh_member_badges_for_members(
    p_member_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_id uuid;
    v_normalized_member_ids uuid[];
    v_awarded_count integer := 0;
begin
    if not public.can_manage_admin_tables() then
        raise exception '배지 상태를 갱신할 권한이 없습니다.';
    end if;

    select coalesce(
        array_agg(distinct member_id),
        '{}'::uuid[]
    )
    into v_normalized_member_ids
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as member_id;

    if coalesce(array_length(v_normalized_member_ids, 1), 0) = 0 then
        return 0;
    end if;

    foreach v_member_id in array v_normalized_member_ids loop
        v_awarded_count := v_awarded_count + coalesce(public.award_member_badges(v_member_id), 0);
    end loop;

    return v_awarded_count;
end;
$$;

create or replace function public.refresh_all_member_badges()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_id uuid;
    v_awarded_count integer := 0;
begin
    if not public.can_manage_admin_tables() then
        raise exception '배지를 전체 갱신할 권한이 없습니다.';
    end if;

    for v_member_id in
        select members.id
        from public.members
    loop
        v_awarded_count := v_awarded_count + coalesce(public.award_member_badges(v_member_id), 0);
    end loop;

    return v_awarded_count;
end;
$$;

create or replace function public.replace_team_members(
    p_team_id uuid,
    p_member_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_requested_member_ids uuid[];
    v_current_member_ids uuid[];
    v_primary_member_ids uuid[];
    v_team_name text;
    v_added_count integer := 0;
    v_removed_count integer := 0;
begin
    if not public.can_manage_admin_tables() then
        raise exception '팀원을 저장할 권한이 없습니다.';
    end if;

    select teams.name
    into v_team_name
    from public.teams
    where teams.id = p_team_id
    limit 1;

    if v_team_name is null then
        raise exception '팀 정보를 찾지 못했습니다.';
    end if;

    select coalesce(array_agg(distinct member_id), '{}'::uuid[])
    into v_requested_member_ids
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as member_id;

    if coalesce(array_length(v_requested_member_ids, 1), 0) > 0 then
        if (
            select count(*)
            from public.members
            where members.id = any(v_requested_member_ids)
        ) <> array_length(v_requested_member_ids, 1) then
            raise exception '존재하지 않는 멤버가 포함되어 있습니다.';
        end if;
    end if;

    select coalesce(array_agg(member_id), '{}'::uuid[])
    into v_current_member_ids
    from (
        select distinct member_team_links.member_id
        from public.member_team_links
        where member_team_links.team_id = p_team_id

        union

        select members.id as member_id
        from public.members
        where members.team_id = p_team_id
    ) as current_members;

    select coalesce(array_agg(members.id), '{}'::uuid[])
    into v_primary_member_ids
    from public.members
    where members.team_id = p_team_id;

    select count(*)
    into v_added_count
    from unnest(v_requested_member_ids) as member_id
    where not (member_id = any(v_current_member_ids));

    select count(*)
    into v_removed_count
    from unnest(v_current_member_ids) as member_id
    where not (member_id = any(v_requested_member_ids));

    delete from public.member_team_links
    where member_team_links.team_id = p_team_id
      and not (member_team_links.member_id = any(v_requested_member_ids));

    if coalesce(array_length(v_requested_member_ids, 1), 0) > 0 then
        insert into public.member_team_links (member_id, team_id)
        select member_id, p_team_id
        from unnest(v_requested_member_ids) as member_id
        on conflict (member_id, team_id) do nothing;
    end if;

    if coalesce(array_length(v_primary_member_ids, 1), 0) > 0 then
        update public.members
        set team_id = (
            select member_team_links.team_id
            from public.member_team_links
            where member_team_links.member_id = members.id
            order by member_team_links.created_at asc
            limit 1
        )
        where members.id = any(v_primary_member_ids)
          and not (members.id = any(v_requested_member_ids));
    end if;

    update public.members
    set team_id = p_team_id
    where members.id = any(v_requested_member_ids)
      and members.team_id is null;

    perform public.create_audit_log(
        'team',
        p_team_id,
        'members_replaced',
        jsonb_build_object(
            'summary', concat(v_team_name, ' 팀원 배정 저장'),
            'teamName', v_team_name,
            'memberCount', coalesce(array_length(v_requested_member_ids, 1), 0),
            'addedCount', v_added_count,
            'removedCount', v_removed_count
        )
    );

    return jsonb_build_object(
        'teamId', p_team_id,
        'teamName', v_team_name,
        'memberCount', coalesce(array_length(v_requested_member_ids, 1), 0),
        'addedCount', v_added_count,
        'removedCount', v_removed_count
    );
end;
$$;

create or replace function public.delete_team(
    p_team_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_team_name text;
    v_team_type public.team_type;
    v_primary_member_ids uuid[];
    v_affected_member_count integer := 0;
begin
    if not public.can_manage_admin_tables() then
        raise exception '팀을 삭제할 권한이 없습니다.';
    end if;

    select
        teams.name,
        teams.type
    into
        v_team_name,
        v_team_type
    from public.teams
    where teams.id = p_team_id
    limit 1;

    if v_team_name is null then
        raise exception '삭제할 팀을 찾지 못했습니다.';
    end if;

    select count(*)
    into v_affected_member_count
    from (
        select member_team_links.member_id
        from public.member_team_links
        where member_team_links.team_id = p_team_id

        union

        select members.id as member_id
        from public.members
        where members.team_id = p_team_id
    ) as affected_members;

    select coalesce(array_agg(members.id), '{}'::uuid[])
    into v_primary_member_ids
    from public.members
    where members.team_id = p_team_id;

    delete from public.member_team_links
    where member_team_links.team_id = p_team_id;

    if coalesce(array_length(v_primary_member_ids, 1), 0) > 0 then
        update public.members
        set team_id = (
            select member_team_links.team_id
            from public.member_team_links
            where member_team_links.member_id = members.id
            order by member_team_links.created_at asc
            limit 1
        )
        where members.id = any(v_primary_member_ids);
    end if;

    delete from public.teams
    where teams.id = p_team_id;

    perform public.create_audit_log(
        'team',
        p_team_id,
        'deleted',
        jsonb_build_object(
            'summary', concat(v_team_name, ' 팀 삭제'),
            'teamName', v_team_name,
            'teamType', v_team_type,
            'affectedMemberCount', v_affected_member_count
        )
    );

    return jsonb_build_object(
        'teamId', p_team_id,
        'teamName', v_team_name,
        'teamType', v_team_type,
        'affectedMemberCount', v_affected_member_count
    );
end;
$$;

create or replace function public.reset_activity_data_current_season()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_season_id uuid;
    v_season_name text;
    v_record_count integer := 0;
    v_ledger_count integer := 0;
    v_correction_count integer := 0;
    v_recap_count integer := 0;
    v_badge_refresh_count integer := 0;
    v_affected_member_ids uuid[];
begin
    if not public.can_manage_admin_tables() then
        raise exception '활동 내역을 초기화할 권한이 없습니다.';
    end if;

    select
        seasons.id,
        seasons.name
    into
        v_season_id,
        v_season_name
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    if v_season_id is null then
        raise exception '현재 진행 중인 시즌이 없습니다.';
    end if;

    select coalesce(array_agg(distinct activity_records.member_id), '{}'::uuid[])
    into v_affected_member_ids
    from public.activity_records
    where activity_records.season_id = v_season_id;

    select count(*)
    into v_record_count
    from public.activity_records
    where activity_records.season_id = v_season_id;

    select count(*)
    into v_ledger_count
    from public.point_ledgers
    join public.activity_records on activity_records.id = point_ledgers.record_id
    where activity_records.season_id = v_season_id;

    select count(*)
    into v_correction_count
    from public.correction_requests
    join public.activity_records on activity_records.id = correction_requests.activity_record_id
    where activity_records.season_id = v_season_id;

    select count(*)
    into v_recap_count
    from public.recap_snapshots
    where recap_snapshots.season_id = v_season_id;

    delete from public.recap_snapshots
    where recap_snapshots.season_id = v_season_id;

    delete from public.activity_records
    where activity_records.season_id = v_season_id;

    v_badge_refresh_count := public.refresh_member_badges_for_members(v_affected_member_ids);

    perform public.create_audit_log(
        'season',
        v_season_id,
        'activity_data_reset',
        jsonb_build_object(
            'summary', concat(v_season_name, ' 시즌 활동 내역 초기화'),
            'seasonId', v_season_id,
            'seasonName', v_season_name,
            'activityRecordCount', v_record_count,
            'pointLedgerCount', v_ledger_count,
            'correctionRequestCount', v_correction_count,
            'recapSnapshotCount', v_recap_count,
            'affectedMemberCount', coalesce(array_length(v_affected_member_ids, 1), 0),
            'badgeRefreshCount', v_badge_refresh_count,
            'scope', 'current_season'
        )
    );

    return jsonb_build_object(
        'seasonId', v_season_id,
        'seasonName', v_season_name,
        'activityRecordCount', v_record_count,
        'pointLedgerCount', v_ledger_count,
        'correctionRequestCount', v_correction_count,
        'recapSnapshotCount', v_recap_count,
        'affectedMemberCount', coalesce(array_length(v_affected_member_ids, 1), 0),
        'badgeRefreshCount', v_badge_refresh_count
    );
end;
$$;

create or replace function public.reset_attendance_data_current_season()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_season_id uuid;
    v_season_name text;
    v_session_count integer := 0;
    v_session_member_count integer := 0;
    v_record_count integer := 0;
    v_ledger_count integer := 0;
    v_recap_count integer := 0;
    v_badge_refresh_count integer := 0;
    v_affected_member_ids uuid[];
begin
    if not public.can_manage_admin_tables() then
        raise exception '출석 세션을 초기화할 권한이 없습니다.';
    end if;

    select
        seasons.id,
        seasons.name
    into
        v_season_id,
        v_season_name
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    if v_season_id is null then
        raise exception '현재 진행 중인 시즌이 없습니다.';
    end if;

    select count(*)
    into v_session_count
    from public.attendance_sessions
    where attendance_sessions.season_id = v_season_id;

    select count(*)
    into v_session_member_count
    from public.attendance_session_members
    join public.attendance_sessions on attendance_sessions.id = attendance_session_members.session_id
    where attendance_sessions.season_id = v_season_id;

    select coalesce(array_agg(distinct activity_records.member_id), '{}'::uuid[])
    into v_affected_member_ids
    from public.activity_records
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and activity_types.group_name = 'attendance';

    select count(*)
    into v_record_count
    from public.activity_records
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and activity_types.group_name = 'attendance';

    select count(*)
    into v_ledger_count
    from public.point_ledgers
    join public.activity_records on activity_records.id = point_ledgers.record_id
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and activity_types.group_name = 'attendance';

    select count(*)
    into v_recap_count
    from public.recap_snapshots
    where recap_snapshots.season_id = v_season_id;

    delete from public.recap_snapshots
    where recap_snapshots.season_id = v_season_id;

    delete from public.attendance_sessions
    where attendance_sessions.season_id = v_season_id;

    delete from public.activity_records
    using public.activity_types
    where activity_records.activity_type_id = activity_types.id
      and activity_records.season_id = v_season_id
      and activity_types.group_name = 'attendance';

    v_badge_refresh_count := public.refresh_member_badges_for_members(v_affected_member_ids);

    perform public.create_audit_log(
        'season',
        v_season_id,
        'attendance_data_reset',
        jsonb_build_object(
            'summary', concat(v_season_name, ' 시즌 출석 세션 초기화'),
            'seasonId', v_season_id,
            'seasonName', v_season_name,
            'attendanceSessionCount', v_session_count,
            'attendanceSessionMemberCount', v_session_member_count,
            'activityRecordCount', v_record_count,
            'pointLedgerCount', v_ledger_count,
            'recapSnapshotCount', v_recap_count,
            'affectedMemberCount', coalesce(array_length(v_affected_member_ids, 1), 0),
            'badgeRefreshCount', v_badge_refresh_count,
            'scope', 'current_season'
        )
    );

    return jsonb_build_object(
        'seasonId', v_season_id,
        'seasonName', v_season_name,
        'attendanceSessionCount', v_session_count,
        'attendanceSessionMemberCount', v_session_member_count,
        'activityRecordCount', v_record_count,
        'pointLedgerCount', v_ledger_count,
        'recapSnapshotCount', v_recap_count,
        'affectedMemberCount', coalesce(array_length(v_affected_member_ids, 1), 0),
        'badgeRefreshCount', v_badge_refresh_count
    );
end;
$$;

create or replace function public.reset_manual_activity_data_current_season()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_season_id uuid;
    v_season_name text;
    v_record_count integer := 0;
    v_ledger_count integer := 0;
    v_correction_count integer := 0;
    v_recap_count integer := 0;
    v_badge_refresh_count integer := 0;
    v_affected_member_ids uuid[];
begin
    if not public.can_manage_admin_tables() then
        raise exception '일반 활동 기록을 초기화할 권한이 없습니다.';
    end if;

    select
        seasons.id,
        seasons.name
    into
        v_season_id,
        v_season_name
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    if v_season_id is null then
        raise exception '현재 진행 중인 시즌이 없습니다.';
    end if;

    select coalesce(array_agg(distinct activity_records.member_id), '{}'::uuid[])
    into v_affected_member_ids
    from public.activity_records
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and coalesce(activity_types.group_name, 'general') <> 'attendance';

    select count(*)
    into v_record_count
    from public.activity_records
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and coalesce(activity_types.group_name, 'general') <> 'attendance';

    select count(*)
    into v_ledger_count
    from public.point_ledgers
    join public.activity_records on activity_records.id = point_ledgers.record_id
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and coalesce(activity_types.group_name, 'general') <> 'attendance';

    select count(*)
    into v_correction_count
    from public.correction_requests
    join public.activity_records on activity_records.id = correction_requests.activity_record_id
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.season_id = v_season_id
      and coalesce(activity_types.group_name, 'general') <> 'attendance';

    select count(*)
    into v_recap_count
    from public.recap_snapshots
    where recap_snapshots.season_id = v_season_id;

    delete from public.recap_snapshots
    where recap_snapshots.season_id = v_season_id;

    delete from public.activity_records
    using public.activity_types
    where activity_records.activity_type_id = activity_types.id
      and activity_records.season_id = v_season_id
      and coalesce(activity_types.group_name, 'general') <> 'attendance';

    v_badge_refresh_count := public.refresh_member_badges_for_members(v_affected_member_ids);

    perform public.create_audit_log(
        'season',
        v_season_id,
        'manual_activity_data_reset',
        jsonb_build_object(
            'summary', concat(v_season_name, ' 시즌 일반 활동 기록 초기화'),
            'seasonId', v_season_id,
            'seasonName', v_season_name,
            'activityRecordCount', v_record_count,
            'pointLedgerCount', v_ledger_count,
            'correctionRequestCount', v_correction_count,
            'recapSnapshotCount', v_recap_count,
            'affectedMemberCount', coalesce(array_length(v_affected_member_ids, 1), 0),
            'badgeRefreshCount', v_badge_refresh_count,
            'scope', 'current_season'
        )
    );

    return jsonb_build_object(
        'seasonId', v_season_id,
        'seasonName', v_season_name,
        'activityRecordCount', v_record_count,
        'pointLedgerCount', v_ledger_count,
        'correctionRequestCount', v_correction_count,
        'recapSnapshotCount', v_recap_count,
        'affectedMemberCount', coalesce(array_length(v_affected_member_ids, 1), 0),
        'badgeRefreshCount', v_badge_refresh_count
    );
end;
$$;

drop function if exists public.get_my_member_badges();

create function public.get_my_member_badges()
returns table (
    id uuid,
    member_id uuid,
    badge_id uuid,
    badge_code text,
    badge_name text,
    badge_description text,
    icon_key text,
    image_url text,
    tone text,
    evaluation_scope text,
    criteria_json jsonb,
    awarded_at timestamptz,
    season_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_id uuid;
begin
    v_member_id := public.current_actor_member_id();

    if v_member_id is null then
        return;
    end if;

    perform public.award_member_badges(v_member_id);

    return query
    select
        member_badges.id,
        member_badges.member_id,
        member_badges.badge_id,
        badges.code as badge_code,
        badges.name as badge_name,
        badges.description as badge_description,
        badges.icon_key,
        badges.image_url,
        badges.tone,
        badges.evaluation_scope,
        badges.criteria_json,
        member_badges.awarded_at,
        member_badges.season_id
    from public.member_badges
    join public.badges on badges.id = member_badges.badge_id
    where member_badges.member_id = v_member_id
      and badges.is_active = true
    order by badges.sort_order asc, member_badges.awarded_at desc;
end;
$$;

drop function if exists public.get_my_member_overview();

create function public.get_my_member_overview()
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
    is_visible boolean,
    auth_user_id uuid,
    auth_provisioned_at timestamptz,
    password_reset_required boolean
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
        m.is_visible,
        m.auth_user_id,
        m.auth_provisioned_at,
        m.password_reset_required
    from public.members m
    left join public.roles r on r.id = m.role_id
    left join public.teams t on t.id = m.team_id
    left join public.point_ledgers pl on pl.member_id = m.id
    where m.id = public.current_actor_member_id()
      and m.is_visible = true
    group by
        m.id,
        m.name,
        m.is_approved,
        m.role_id,
        r.name,
        m.team_id,
        t.name,
        m.status,
        m.joined_at,
        m.is_visible,
        m.auth_user_id,
        m.auth_provisioned_at,
        m.password_reset_required;
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

    perform public.award_member_badges(v_original_ledger.member_id);

    return v_reversal_ledger_id;
end;
$$;

create or replace function public.submit_correction_request(
    p_record_id uuid,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_member_id uuid;
    v_target_member_id uuid;
    v_request_id uuid;
    v_member_name text;
    v_activity_name text;
    v_trimmed_reason text;
begin
    v_actor_member_id := public.current_actor_member_id();

    if v_actor_member_id is null then
        raise exception '회원 프로필이 연결되지 않아 정정 요청을 제출할 수 없습니다.';
    end if;

    v_trimmed_reason := nullif(btrim(coalesce(p_reason, '')), '');

    if v_trimmed_reason is null then
        raise exception '정정 요청 사유를 입력해 주세요.';
    end if;

    select
        activity_records.member_id,
        members.name,
        activity_types.name
    into
        v_target_member_id,
        v_member_name,
        v_activity_name
    from public.activity_records
    join public.members on members.id = activity_records.member_id
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.id = p_record_id
    limit 1;

    if v_target_member_id is null then
        raise exception '대상 활동 기록을 찾지 못했습니다.';
    end if;

    if v_target_member_id <> v_actor_member_id then
        raise exception '본인 활동 기록에 대해서만 정정 요청을 제출할 수 있습니다.';
    end if;

    if exists (
        select 1
        from public.correction_requests
        where correction_requests.requester_member_id = v_actor_member_id
          and correction_requests.activity_record_id = p_record_id
          and correction_requests.status in ('pending', 'reviewing')
    ) then
        raise exception '이미 처리 중인 정정 요청이 있습니다.';
    end if;

    insert into public.correction_requests (
        requester_member_id,
        activity_record_id,
        status,
        reason
    )
    values (
        v_actor_member_id,
        p_record_id,
        'pending',
        v_trimmed_reason
    )
    returning id into v_request_id;

    perform public.create_audit_log(
        'correction_request',
        v_request_id,
        'submitted',
        jsonb_build_object(
            'summary', concat(coalesce(v_member_name, '알 수 없는 회원'), ' · ', coalesce(v_activity_name, '활동'), ' 정정 요청 제출'),
            'requestId', v_request_id,
            'requesterMemberId', v_actor_member_id,
            'memberName', v_member_name,
            'recordId', p_record_id,
            'activityName', v_activity_name,
            'status', 'pending',
            'reason', v_trimmed_reason
        )
    );

    return v_request_id;
end;
$$;

create or replace function public.update_correction_request_status(
    p_request_id uuid,
    p_status public.correction_request_status,
    p_review_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor_member_id uuid;
    v_request public.correction_requests%rowtype;
    v_member_name text;
    v_activity_name text;
    v_trimmed_review_note text;
begin
    if not public.can_manage_activities() then
        raise exception '정정 요청을 검토할 권한이 없습니다.';
    end if;

    v_actor_member_id := public.current_actor_member_id();

    if v_actor_member_id is null then
        raise exception '운영진 회원 정보가 연결되지 않았습니다.';
    end if;

    if p_status not in ('reviewing', 'resolved', 'rejected') then
        raise exception '지원하지 않는 정정 요청 상태입니다.';
    end if;

    select correction_requests.*
    into v_request
    from public.correction_requests
    where correction_requests.id = p_request_id
    limit 1;

    if v_request.id is null then
        raise exception '정정 요청을 찾지 못했습니다.';
    end if;

    if not public.can_access_member(v_request.requester_member_id) then
        raise exception '이 정정 요청을 검토할 범위 권한이 없습니다.';
    end if;

    select
        members.name,
        activity_types.name
    into
        v_member_name,
        v_activity_name
    from public.activity_records
    join public.members on members.id = activity_records.member_id
    join public.activity_types on activity_types.id = activity_records.activity_type_id
    where activity_records.id = v_request.activity_record_id
    limit 1;

    v_trimmed_review_note := nullif(btrim(coalesce(p_review_note, '')), '');

    update public.correction_requests
    set
        status = p_status,
        review_note = v_trimmed_review_note,
        reviewed_by = v_actor_member_id,
        reviewed_at = now(),
        updated_at = now()
    where correction_requests.id = p_request_id;

    perform public.create_audit_log(
        'correction_request',
        p_request_id,
        p_status::text,
        jsonb_build_object(
            'summary', concat(coalesce(v_member_name, '알 수 없는 회원'), ' · ', coalesce(v_activity_name, '활동'), ' 정정 요청 ', p_status::text),
            'requestId', p_request_id,
            'requesterMemberId', v_request.requester_member_id,
            'memberName', v_member_name,
            'recordId', v_request.activity_record_id,
            'activityName', v_activity_name,
            'status', p_status,
            'reviewNote', v_trimmed_review_note
        )
    );

    return p_request_id;
end;
$$;

create index if not exists idx_members_visible on public.members (is_visible, status);
create unique index if not exists idx_members_login_email_unique on public.members (lower(login_email)) where login_email is not null;
create unique index if not exists idx_members_auth_user_id_unique on public.members (auth_user_id) where auth_user_id is not null;
create index if not exists idx_activity_records_member on public.activity_records (member_id, occurred_at desc);
create index if not exists idx_point_ledgers_member on public.point_ledgers (member_id, created_at desc);
create index if not exists idx_point_rules_activity_type on public.point_rules (activity_type_id, is_active);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create unique index if not exists idx_correction_requests_open_unique on public.correction_requests (requester_member_id, activity_record_id) where status in ('pending', 'reviewing');
create index if not exists idx_correction_requests_created_at on public.correction_requests (created_at desc);
create unique index if not exists idx_badges_code_unique on public.badges (code);
create unique index if not exists idx_member_badges_member_badge_unique on public.member_badges (member_id, badge_id);
create index if not exists idx_member_badges_member on public.member_badges (member_id, awarded_at desc);
create index if not exists idx_recap_snapshots_scope_created on public.recap_snapshots (snapshot_scope, created_at desc);
create index if not exists idx_recap_snapshots_member_created on public.recap_snapshots (member_id, created_at desc);
create unique index if not exists idx_attendance_checkins_session_member_unique on public.attendance_checkins (session_id, member_id);
create index if not exists idx_attendance_sessions_active on public.attendance_sessions (is_active, starts_at desc);
create unique index if not exists idx_attendance_session_members_unique on public.attendance_session_members (session_id, member_id);
create index if not exists idx_attendance_session_members_member on public.attendance_session_members (member_id, updated_at desc);

insert into public.badges (code, name, description, icon_key, tone, evaluation_scope, criteria_json, sort_order, is_active)
values
    ('first_step', '첫 발자국', '첫 활동 기록을 남겼습니다.', 'bandi-core', 'gold', 'season', jsonb_build_object('activityCount', 1), 10, true),
    ('steady_rhythm', '꾸준한 리듬', '서로 다른 날짜에 3회 이상 활동을 이어갔습니다.', 'bandi-orbit', 'emerald', 'season', jsonb_build_object('activeDayCount', 3), 20, true),
    ('attendance_radar', '출석 레이더', '출석 계열 활동을 5회 이상 기록했습니다.', 'school-signal', 'sky', 'season', jsonb_build_object('attendanceCount', 5), 30, true),
    ('spotlight', '스포트라이트', '발표 또는 고점수 기여를 남겼습니다.', 'bandi-flash', 'rose', 'season', jsonb_build_object('spotlightCount', 1), 40, true),
    ('multi_tool', '멀티 플레이어', '서로 다른 활동 유형 4개 이상을 경험했습니다.', 'didi-toolkit', 'sky', 'season', jsonb_build_object('uniqueActivityTypeCount', 4), 50, true),
    ('archive_keeper', '기록 보관자', '증빙 링크가 포함된 활동을 2건 이상 남겼습니다.', 'didi-archive', 'emerald', 'season', jsonb_build_object('evidenceCount', 2), 60, true)
on conflict (code) do update
set
    name = excluded.name,
    description = excluded.description,
    icon_key = excluded.icon_key,
    evaluation_scope = excluded.evaluation_scope,
    criteria_json = excluded.criteria_json,
    tone = excluded.tone,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

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
