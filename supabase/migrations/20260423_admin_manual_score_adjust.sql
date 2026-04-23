-- 관리자 수동 점수 조정 기능
-- super_admin/operator가 임의 delta를 회원에게 즉시 부여/차감할 수 있도록 한다.
-- 기존 append-only ledger 구조를 재사용: activity_records + point_ledgers 직접 insert.
-- team_lead/member는 본 RPC를 호출할 수 없다.
-- 2026-04-23

-- ============================================================
-- 1. Seed: 수동 조정용 activity_type + placeholder point_rules 행
-- ============================================================

insert into public.activity_types (code, name, group_name)
values ('manual-adjustment', '관리자 수동 조정', 'manual')
on conflict (code) do nothing;

-- point_ledgers.point_rule_id 는 not null 이므로 더미 규칙 행을 하나 둔다.
-- is_active=false 이므로 PointRulesManager UI (is_active=true 필터)에 노출되지 않는다.
-- version=0 으로 두어 일반 규칙과 섞이지 않게 한다.
insert into public.point_rules (activity_type_id, base_point, penalty_point, condition_json, is_active, version)
select activity_types.id, 0, 0, '{"internal": "manual-adjustment"}'::jsonb, false, 0
from public.activity_types
where activity_types.code = 'manual-adjustment'
  and not exists (
    select 1 from public.point_rules pr
    where pr.activity_type_id = activity_types.id
  );

-- ============================================================
-- 2. RPC: 단건 수동 조정
-- ============================================================

create or replace function public.admin_adjust_member_points(
    p_member_id uuid,
    p_delta integer,
    p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_app_role text;
    v_actor_member_id uuid;
    v_manual_type_id uuid;
    v_manual_rule_id uuid;
    v_season_id uuid;
    v_member_name text;
    v_reason_trimmed text;
    v_record_id uuid;
begin
    -- 권한: super_admin, operator 만 허용 (team_lead 제외)
    v_app_role := coalesce(public.current_app_role(), 'member');
    if v_app_role not in ('super_admin', 'operator') then
        raise exception '점수를 수동 조정할 권한이 없습니다.';
    end if;

    -- 유효성 검사
    if p_delta is null or p_delta = 0 then
        raise exception '점수 변화량(delta)은 0이 아닌 정수여야 합니다.';
    end if;

    if p_delta < -100 or p_delta > 100 then
        raise exception '한 번에 조정할 수 있는 점수는 -100 ~ +100 범위입니다.';
    end if;

    v_reason_trimmed := btrim(coalesce(p_reason, ''));
    if length(v_reason_trimmed) < 2 then
        raise exception '사유는 2자 이상 입력해야 합니다.';
    end if;

    -- 대상 멤버 존재 확인
    select members.name
    into v_member_name
    from public.members
    where members.id = p_member_id
    limit 1;

    if v_member_name is null then
        raise exception '대상 멤버 %를 찾을 수 없습니다.', p_member_id;
    end if;

    -- 수동 조정용 activity_type / point_rule 조회
    select activity_types.id
    into v_manual_type_id
    from public.activity_types
    where activity_types.code = 'manual-adjustment'
    limit 1;

    if v_manual_type_id is null then
        raise exception '수동 조정 activity_type 이 seed 되지 않았습니다.';
    end if;

    select point_rules.id
    into v_manual_rule_id
    from public.point_rules
    where point_rules.activity_type_id = v_manual_type_id
    order by point_rules.version asc
    limit 1;

    if v_manual_rule_id is null then
        raise exception '수동 조정 point_rules 더미 행이 seed 되지 않았습니다.';
    end if;

    -- 현재 활성 시즌
    select seasons.id
    into v_season_id
    from public.seasons
    where seasons.status = 'active'
    order by seasons.start_date desc
    limit 1;

    v_actor_member_id := public.current_actor_member_id();

    -- activity_records 생성
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
        v_manual_type_id,
        now(),
        'confirmed',
        v_reason_trimmed,
        null,
        v_actor_member_id
    )
    returning id into v_record_id;

    -- point_ledgers 생성 (delta 를 그대로 기록)
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
        v_manual_rule_id,
        p_delta,
        v_reason_trimmed,
        v_actor_member_id
    );

    -- 감사 로그
    perform public.create_audit_log(
        'activity_record',
        v_record_id,
        'manual_adjusted',
        jsonb_build_object(
            'summary', concat(v_member_name, ' 점수 ', case when p_delta > 0 then '+' else '' end, p_delta, ' 수동 조정'),
            'memberId', p_member_id,
            'memberName', v_member_name,
            'delta', p_delta,
            'reason', v_reason_trimmed,
            'adjustmentType', 'manual'
        )
    );

    -- 뱃지 갱신
    perform public.award_member_badges(p_member_id);

    return v_record_id;
end;
$$;

-- ============================================================
-- 3. RPC: 벌크 수동 조정
-- ============================================================

create or replace function public.admin_adjust_member_points_bulk(
    p_member_ids uuid[],
    p_delta integer,
    p_reason text
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
        raise exception '대상 멤버가 선택되지 않았습니다.';
    end if;

    if array_length(p_member_ids, 1) > 200 then
        raise exception '한 번에 조정할 수 있는 멤버 수는 200명 이하입니다.';
    end if;

    -- 단건 RPC 를 루프로 호출 → 개별 검증·감사 로그 모두 일관된 경로 사용.
    -- plpgsql 트랜잭션 내에서 exception 발생 시 전체 롤백.
    foreach v_member_id in array p_member_ids loop
        v_record_id := public.admin_adjust_member_points(v_member_id, p_delta, p_reason);
        v_record_ids := array_append(v_record_ids, v_record_id);
    end loop;

    return v_record_ids;
end;
$$;

-- ============================================================
-- 4. 권한 부여 (RLS 는 security definer 로 우회되지만 execute 권한은 명시)
-- ============================================================

grant execute on function public.admin_adjust_member_points(uuid, integer, text) to authenticated;
grant execute on function public.admin_adjust_member_points_bulk(uuid[], integer, text) to authenticated;

-- anon 에는 부여하지 않음 (authenticated 만). RPC 내부에서 role 재검사.
