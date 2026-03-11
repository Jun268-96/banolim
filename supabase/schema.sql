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
    role_id uuid references public.roles(id) on delete set null,
    team_id uuid references public.teams(id) on delete set null,
    status public.member_status not null default 'active',
    joined_at date not null default current_date,
    avatar_key text,
    is_visible boolean not null default true,
    is_approved boolean not null default true,
    created_at timestamptz not null default now()
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
create index if not exists idx_activity_records_member on public.activity_records (member_id, occurred_at desc);
create index if not exists idx_point_ledgers_member on public.point_ledgers (member_id, created_at desc);
create index if not exists idx_point_rules_activity_type on public.point_rules (activity_type_id, is_active);
create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create unique index if not exists idx_correction_requests_open_unique on public.correction_requests (requester_member_id, activity_record_id) where status in ('pending', 'reviewing');
create index if not exists idx_correction_requests_created_at on public.correction_requests (created_at desc);

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
