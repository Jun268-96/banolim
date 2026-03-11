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

create unique index if not exists idx_attendance_checkins_session_member_unique on public.attendance_checkins (session_id, member_id);
create index if not exists idx_attendance_sessions_active on public.attendance_sessions (is_active, starts_at desc);

grant select, insert, update on public.attendance_sessions to authenticated;
grant select on public.attendance_checkins to authenticated;
grant execute on function public.create_attendance_session(text, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.submit_attendance_checkin(text) to authenticated;

alter table public.attendance_sessions enable row level security;
alter table public.attendance_checkins enable row level security;

drop policy if exists attendance_sessions_select_authenticated on public.attendance_sessions;
create policy attendance_sessions_select_authenticated
on public.attendance_sessions
for select
to authenticated
using (public.can_manage_activities());

drop policy if exists attendance_sessions_insert_authenticated on public.attendance_sessions;
create policy attendance_sessions_insert_authenticated
on public.attendance_sessions
for insert
to authenticated
with check (public.can_manage_activities());

drop policy if exists attendance_sessions_update_authenticated on public.attendance_sessions;
create policy attendance_sessions_update_authenticated
on public.attendance_sessions
for update
to authenticated
using (public.can_manage_activities())
with check (public.can_manage_activities());

drop policy if exists attendance_checkins_select_authenticated on public.attendance_checkins;
create policy attendance_checkins_select_authenticated
on public.attendance_checkins
for select
to authenticated
using (
    public.can_manage_activities()
    or member_id = public.current_actor_member_id()
);
