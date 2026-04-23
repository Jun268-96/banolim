-- 커뮤니티 작성자 이름 폴백 버그 해소 — members RLS는 본인 1명만 허용해 일반 멤버에게
-- 타인 이름이 UUID 앞 4자리로 폴백되던 문제를 security definer RPC로 해결.
-- 설계: {id, name}만 공개. 민감 컬럼(email, auth_user_id, status 등)은 여전히 보호.
-- 2026-04-23

-- =====================================================================
-- RPC: 커뮤니티용 공개 멤버 이름 목록
-- =====================================================================
drop function if exists public.community_list_member_names();

create or replace function public.community_list_member_names()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
    select m.id, m.name
      from public.members m
     where m.is_visible = true;
$$;

revoke all on function public.community_list_member_names() from public, anon;
grant execute on function public.community_list_member_names() to authenticated;

comment on function public.community_list_member_names() is
    '커뮤니티용 공개 멤버 이름 목록. {id, name}만 반환. members RLS 우회(security definer). anon 금지.';
