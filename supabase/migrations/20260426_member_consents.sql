-- 개인정보 수집·이용 동의 기록 (PIPA 제15조·제22조 대응)
--
-- 회원이 비밀번호 설정 시 또는 동의 화면에서 체크한 동의 내역을 감사 로그로 누적 저장한다.
-- consent_type 별로 1회 보존(같은 type/version은 갱신), 철회 시 agreed=false 행으로 갱신.
--
-- consent_type 체계 (운영 정의):
--   required_v1        : 필수 — 회원 식별·활동기록·접속 로그 처리 (미동의 시 가입 불가)
--   push_token_v1      : 선택 — 푸시 알림용 디바이스 토큰
--   overseas_transfer_v1: 선택 — Supabase(미국) 등 국외 위탁 처리
--   marketing_v1       : 선택 — 광고성/이벤트 안내 수신 (현재 미사용, 향후 도입 대비)

create table if not exists public.member_consents (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    consent_type text not null,
    consent_version integer not null default 1,
    agreed boolean not null,
    agreed_at timestamptz not null default now(),
    user_agent_at_consent text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.member_consents is
    '회원이 동의한 개인정보 처리 항목별 기록. PIPA 제15조 동의 증빙용.';
comment on column public.member_consents.consent_type is
    '동의 유형 키. required_v1, push_token_v1, overseas_transfer_v1, marketing_v1 등.';
comment on column public.member_consents.consent_version is
    '처리방침 버전. 처리방침이 바뀌면 버전 올려서 재동의 받음.';
comment on column public.member_consents.agreed is
    'true=동의, false=거부/철회. 같은 회원·type·version은 한 행만 유지하며 갱신.';

create unique index if not exists idx_member_consents_unique
    on public.member_consents (member_id, consent_type, consent_version);

create index if not exists idx_member_consents_member_id
    on public.member_consents (member_id);

-- updated_at 자동 갱신
create or replace function public.tg_member_consents_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists set_updated_at on public.member_consents;
create trigger set_updated_at
    before update on public.member_consents
    for each row
    execute function public.tg_member_consents_set_updated_at();

-- RLS
alter table public.member_consents enable row level security;

drop policy if exists "member_consents_self_select" on public.member_consents;
create policy "member_consents_self_select"
    on public.member_consents
    for select
    to authenticated
    using (
        member_id = public.current_actor_member_id()
        or public.current_app_role() in ('super_admin', 'operator')
    );

-- INSERT/UPDATE/DELETE 정책은 의도적으로 만들지 않음 — RPC(security definer)만 사용

-- 본인 동의 기록 RPC (체크박스 ON/OFF 시 호출)
drop function if exists public.record_my_consent(text, integer, boolean);
create or replace function public.record_my_consent(
    p_consent_type text,
    p_consent_version integer,
    p_agreed boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_id uuid;
begin
    v_member_id := public.current_actor_member_id();

    if v_member_id is null then
        raise exception '회원 프로필이 연결되지 않았습니다.';
    end if;

    if p_consent_type is null or btrim(p_consent_type) = '' then
        raise exception 'consent_type은 비어 있을 수 없습니다.';
    end if;

    insert into public.member_consents (
        member_id, consent_type, consent_version, agreed
    ) values (
        v_member_id, p_consent_type, p_consent_version, p_agreed
    )
    on conflict (member_id, consent_type, consent_version) do update
    set agreed = excluded.agreed,
        agreed_at = now();
end;
$$;

grant execute on function public.record_my_consent(text, integer, boolean) to authenticated;

-- 본인 동의 현황 조회 RPC (AuthProvider 게이트 + 마이페이지 표시)
drop function if exists public.get_my_consent_status();
create or replace function public.get_my_consent_status()
returns table (
    consent_type text,
    consent_version integer,
    agreed boolean,
    agreed_at timestamptz
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

    return query
    select c.consent_type, c.consent_version, c.agreed, c.agreed_at
    from public.member_consents c
    where c.member_id = v_member_id
    order by c.created_at desc;
end;
$$;

grant execute on function public.get_my_consent_status() to authenticated;
