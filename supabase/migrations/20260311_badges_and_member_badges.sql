create table if not exists public.badges (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    description text not null,
    icon_key text not null,
    tone text not null default 'sky',
    sort_order integer not null default 100,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.member_badges (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    badge_id uuid not null references public.badges(id) on delete cascade,
    awarded_at timestamptz not null default now(),
    season_id uuid references public.seasons(id) on delete set null
);

alter table public.badges add column if not exists tone text not null default 'sky';
alter table public.badges add column if not exists sort_order integer not null default 100;
alter table public.badges add column if not exists is_active boolean not null default true;

create unique index if not exists idx_badges_code_unique on public.badges (code);
create unique index if not exists idx_member_badges_member_badge_unique on public.member_badges (member_id, badge_id);
create index if not exists idx_member_badges_member on public.member_badges (member_id, awarded_at desc);

insert into public.badges (code, name, description, icon_key, tone, sort_order, is_active)
values
    ('first_step', '첫 발자국', '첫 활동 기록을 남겼습니다.', 'bandi-core', 'gold', 10, true),
    ('steady_rhythm', '꾸준한 리듬', '서로 다른 날짜에 3회 이상 활동을 이어갔습니다.', 'bandi-orbit', 'emerald', 20, true),
    ('attendance_radar', '출석 레이더', '출석 계열 활동을 5회 이상 기록했습니다.', 'school-signal', 'sky', 30, true),
    ('spotlight', '스포트라이트', '발표 또는 고점수 기여를 남겼습니다.', 'bandi-flash', 'rose', 40, true),
    ('multi_tool', '멀티 플레이어', '서로 다른 활동 유형 4개 이상을 경험했습니다.', 'didi-toolkit', 'sky', 50, true),
    ('archive_keeper', '기록 보관자', '증빙 링크가 포함된 활동을 2건 이상 남겼습니다.', 'didi-archive', 'emerald', 60, true)
on conflict (code) do update
set
    name = excluded.name,
    description = excluded.description,
    icon_key = excluded.icon_key,
    tone = excluded.tone,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

alter table public.badges enable row level security;
alter table public.member_badges enable row level security;

create or replace function public.award_member_badges(
    p_member_id uuid default public.current_actor_member_id()
)
returns integer
language plpgsql
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
    v_active_season_id uuid;
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

    select
        count(*)::integer,
        count(*) filter (where activity_types.name ~* '(출석|참석|지각|불참)')::integer,
        count(*) filter (where point_ledgers.delta >= 20 or activity_types.name ~* '(발표|세션|리딩)')::integer,
        count(distinct activity_records.activity_type_id)::integer,
        count(*) filter (where nullif(btrim(coalesce(activity_records.evidence_url, '')), '') is not null)::integer,
        count(distinct (activity_records.occurred_at::date))::integer
    into
        v_activity_count,
        v_attendance_count,
        v_spotlight_count,
        v_unique_activity_types,
        v_evidence_count,
        v_active_days
    from public.activity_records
    join public.point_ledgers on point_ledgers.record_id = activity_records.id
        and point_ledgers.member_id = activity_records.member_id
        and point_ledgers.reversal_of is null
    join public.point_rules on point_rules.id = point_ledgers.point_rule_id
    join public.activity_types on activity_types.id = point_rules.activity_type_id
    where activity_records.member_id = p_member_id
      and coalesce(activity_records.status, 'confirmed') <> 'reversed';

    if v_activity_count > 0 then
        insert into public.member_badges (member_id, badge_id, season_id)
        select p_member_id, badges.id, v_active_season_id
        from public.badges
        where badges.code = 'first_step'
          and badges.is_active = true
        on conflict (member_id, badge_id) do nothing;
        get diagnostics v_row_count = row_count;
        v_awarded := v_awarded + v_row_count;
    end if;

    if v_active_days >= 3 then
        insert into public.member_badges (member_id, badge_id, season_id)
        select p_member_id, badges.id, v_active_season_id
        from public.badges
        where badges.code = 'steady_rhythm'
          and badges.is_active = true
        on conflict (member_id, badge_id) do nothing;
        get diagnostics v_row_count = row_count;
        v_awarded := v_awarded + v_row_count;
    end if;

    if v_attendance_count >= 5 then
        insert into public.member_badges (member_id, badge_id, season_id)
        select p_member_id, badges.id, v_active_season_id
        from public.badges
        where badges.code = 'attendance_radar'
          and badges.is_active = true
        on conflict (member_id, badge_id) do nothing;
        get diagnostics v_row_count = row_count;
        v_awarded := v_awarded + v_row_count;
    end if;

    if v_spotlight_count >= 1 then
        insert into public.member_badges (member_id, badge_id, season_id)
        select p_member_id, badges.id, v_active_season_id
        from public.badges
        where badges.code = 'spotlight'
          and badges.is_active = true
        on conflict (member_id, badge_id) do nothing;
        get diagnostics v_row_count = row_count;
        v_awarded := v_awarded + v_row_count;
    end if;

    if v_unique_activity_types >= 4 then
        insert into public.member_badges (member_id, badge_id, season_id)
        select p_member_id, badges.id, v_active_season_id
        from public.badges
        where badges.code = 'multi_tool'
          and badges.is_active = true
        on conflict (member_id, badge_id) do nothing;
        get diagnostics v_row_count = row_count;
        v_awarded := v_awarded + v_row_count;
    end if;

    if v_evidence_count >= 2 then
        insert into public.member_badges (member_id, badge_id, season_id)
        select p_member_id, badges.id, v_active_season_id
        from public.badges
        where badges.code = 'archive_keeper'
          and badges.is_active = true
        on conflict (member_id, badge_id) do nothing;
        get diagnostics v_row_count = row_count;
        v_awarded := v_awarded + v_row_count;
    end if;

    return v_awarded;
end;
$$;

create or replace function public.get_my_member_badges()
returns table (
    id uuid,
    member_id uuid,
    badge_id uuid,
    badge_code text,
    badge_name text,
    badge_description text,
    icon_key text,
    tone text,
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
        badges.tone,
        member_badges.awarded_at,
        member_badges.season_id
    from public.member_badges
    join public.badges on badges.id = member_badges.badge_id
    where member_badges.member_id = v_member_id
      and badges.is_active = true
    order by badges.sort_order asc, member_badges.awarded_at desc;
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

grant select on public.badges to authenticated;
grant select on public.member_badges to authenticated;
grant execute on function public.award_member_badges(uuid) to authenticated;
grant execute on function public.get_my_member_badges() to authenticated;

drop policy if exists badges_select_authenticated on public.badges;
create policy badges_select_authenticated
on public.badges
for select
to authenticated
using (true);

drop policy if exists member_badges_select_authenticated on public.member_badges;
create policy member_badges_select_authenticated
on public.member_badges
for select
to authenticated
using (public.can_access_member(member_id));
