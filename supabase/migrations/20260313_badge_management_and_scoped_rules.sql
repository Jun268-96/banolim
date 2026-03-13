alter table public.badges
    add column if not exists image_url text,
    add column if not exists evaluation_scope text not null default 'season',
    add column if not exists criteria_json jsonb not null default '{}'::jsonb;

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

update public.badges
set
    evaluation_scope = 'season',
    criteria_json = case code
        when 'first_step' then jsonb_build_object('activityCount', 1)
        when 'steady_rhythm' then jsonb_build_object('activeDayCount', 3)
        when 'attendance_radar' then jsonb_build_object('attendanceCount', 5)
        when 'spotlight' then jsonb_build_object('spotlightCount', 1)
        when 'multi_tool' then jsonb_build_object('uniqueActivityTypeCount', 4)
        when 'archive_keeper' then jsonb_build_object('evidenceCount', 2)
        else coalesce(criteria_json, '{}'::jsonb)
    end
where code in (
    'first_step',
    'steady_rhythm',
    'attendance_radar',
    'spotlight',
    'multi_tool',
    'archive_keeper'
);

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
    v_awarded_count integer := 0;
    v_normalized_member_ids uuid[];
begin
    if not public.can_manage_admin_tables() then
        raise exception '배지 상태를 갱신할 권한이 없습니다.';
    end if;

    select coalesce(array_agg(distinct member_id), '{}'::uuid[])
    into v_normalized_member_ids
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as member_id;

    foreach v_member_id in array v_normalized_member_ids
    loop
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

grant select, insert, update, delete on public.badges to authenticated;
grant execute on function public.refresh_all_member_badges() to authenticated;
