do $$
begin
    create type public.correction_request_status as enum ('pending', 'reviewing', 'resolved', 'rejected');
exception
    when duplicate_object then null;
end
$$;

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

alter table public.correction_requests enable row level security;

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

create unique index if not exists idx_correction_requests_open_unique
on public.correction_requests (requester_member_id, activity_record_id)
where status in ('pending', 'reviewing');

create index if not exists idx_correction_requests_created_at
on public.correction_requests (created_at desc);

grant select on public.correction_requests to authenticated;
grant execute on function public.submit_correction_request(uuid, text) to authenticated;
grant execute on function public.update_correction_request_status(uuid, public.correction_request_status, text) to authenticated;

drop policy if exists correction_requests_select_authenticated on public.correction_requests;
create policy correction_requests_select_authenticated
on public.correction_requests
for select
to authenticated
using (
    requester_member_id = public.current_actor_member_id()
    or (public.can_manage_activities() and public.can_access_member(requester_member_id))
);
