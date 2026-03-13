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
    select coalesce(
        array_agg(distinct member_id),
        '{}'::uuid[]
    )
    into v_normalized_member_ids
    from unnest(coalesce(p_member_ids, '{}'::uuid[])) as member_id;

    if coalesce(array_length(v_normalized_member_ids, 1), 0) = 0 then
        return 0;
    end if;

    delete from public.member_badges
    where member_badges.member_id = any(v_normalized_member_ids);

    foreach v_member_id in array v_normalized_member_ids loop
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

grant execute on function public.replace_team_members(uuid, uuid[]) to authenticated;
grant execute on function public.delete_team(uuid) to authenticated;
grant execute on function public.reset_activity_data_current_season() to authenticated;
grant execute on function public.reset_attendance_data_current_season() to authenticated;
grant execute on function public.reset_manual_activity_data_current_season() to authenticated;
