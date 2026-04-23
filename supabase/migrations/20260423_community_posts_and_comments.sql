-- 커뮤니티 게시글/댓글 + RLS + 핀/숨김 RPC
-- 설계: COMMUNITY_DESIGN.md, ANALYSIS.md 리스크(anon 노출·snapshot 버그) 회피
-- 2026-04-23

-- =====================================================================
-- community_posts
-- =====================================================================
create table if not exists public.community_posts (
    id uuid primary key default gen_random_uuid(),
    author_member_id uuid not null references public.members(id) on delete restrict,
    title text not null check (char_length(title) between 1 and 200),
    body text not null check (char_length(body) between 1 and 5000),
    is_pinned boolean not null default false,
    is_hidden boolean not null default false,
    hidden_by uuid null references public.members(id) on delete set null,
    hidden_reason text null check (hidden_reason is null or char_length(hidden_reason) <= 200),
    hidden_at timestamptz null,
    comment_count integer not null default 0 check (comment_count >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.community_posts is '커뮤니티 게시글 (텍스트 전용, 첨부 없음). 물리 삭제 금지 — community_moderate_post RPC로 soft delete.';
comment on column public.community_posts.is_hidden is 'soft delete / 관리자 숨김. 90일 경과 시 community_purge_hidden_after로 purge 대상.';
comment on column public.community_posts.hidden_by is '숨김 처리한 멤버. 본인=self 숨김, 타인=운영진 처리.';

-- =====================================================================
-- community_comments (1-depth only)
-- =====================================================================
create table if not exists public.community_comments (
    id uuid primary key default gen_random_uuid(),
    post_id uuid not null references public.community_posts(id) on delete cascade,
    author_member_id uuid not null references public.members(id) on delete restrict,
    body text not null check (char_length(body) between 1 and 1000),
    is_hidden boolean not null default false,
    hidden_by uuid null references public.members(id) on delete set null,
    hidden_at timestamptz null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

comment on table public.community_comments is '커뮤니티 댓글 (1-depth, 대댓글 없음).';

-- =====================================================================
-- 인덱스
-- =====================================================================
create index if not exists community_posts_list_idx
    on public.community_posts (is_hidden, is_pinned desc, created_at desc);

create index if not exists community_posts_author_idx
    on public.community_posts (author_member_id, created_at desc);

create index if not exists community_comments_post_idx
    on public.community_comments (post_id, is_hidden, created_at asc);

create index if not exists community_comments_author_idx
    on public.community_comments (author_member_id, created_at desc);

create index if not exists community_posts_purge_idx
    on public.community_posts (hidden_at) where is_hidden = true;

create index if not exists community_comments_purge_idx
    on public.community_comments (hidden_at) where is_hidden = true;

-- =====================================================================
-- updated_at 자동 터치 트리거
-- =====================================================================
create or replace function public.tg_community_posts_touch()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists community_posts_touch on public.community_posts;
create trigger community_posts_touch
    before update on public.community_posts
    for each row execute function public.tg_community_posts_touch();

create or replace function public.tg_community_comments_touch()
returns trigger language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists community_comments_touch on public.community_comments;
create trigger community_comments_touch
    before update on public.community_comments
    for each row execute function public.tg_community_comments_touch();

-- =====================================================================
-- comment_count 유지 트리거
-- =====================================================================
create or replace function public.tg_community_comment_count_sync()
returns trigger language plpgsql as $$
begin
    if tg_op = 'INSERT' then
        if new.is_hidden = false then
            update public.community_posts
               set comment_count = comment_count + 1
             where id = new.post_id;
        end if;
        return new;
    elsif tg_op = 'DELETE' then
        if old.is_hidden = false then
            update public.community_posts
               set comment_count = greatest(comment_count - 1, 0)
             where id = old.post_id;
        end if;
        return old;
    elsif tg_op = 'UPDATE' then
        if old.is_hidden = false and new.is_hidden = true then
            update public.community_posts
               set comment_count = greatest(comment_count - 1, 0)
             where id = new.post_id;
        elsif old.is_hidden = true and new.is_hidden = false then
            update public.community_posts
               set comment_count = comment_count + 1
             where id = new.post_id;
        end if;
        return new;
    end if;
    return null;
end;
$$;

drop trigger if exists community_comments_count_sync on public.community_comments;
create trigger community_comments_count_sync
    after insert or update or delete on public.community_comments
    for each row execute function public.tg_community_comment_count_sync();

-- =====================================================================
-- 권한 (anon 일체 불허)
-- =====================================================================
grant select, insert, update on public.community_posts to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts
    for select to authenticated
    using (
        is_hidden = false
        or author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    );

drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
    for insert to authenticated
    with check (
        author_member_id = public.current_actor_member_id()
        and is_pinned = false
        and is_hidden = false
    );

drop policy if exists community_posts_update on public.community_posts;
create policy community_posts_update on public.community_posts
    for update to authenticated
    using (
        author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    )
    with check (
        author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    );

-- delete 정책 없음 — RLS enabled + 정책 없음 = 물리 삭제 차단. soft delete만 허용.
drop policy if exists community_posts_delete on public.community_posts;

drop policy if exists community_comments_select on public.community_comments;
create policy community_comments_select on public.community_comments
    for select to authenticated
    using (
        is_hidden = false
        or author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    );

drop policy if exists community_comments_insert on public.community_comments;
create policy community_comments_insert on public.community_comments
    for insert to authenticated
    with check (
        author_member_id = public.current_actor_member_id()
        and is_hidden = false
        and exists (
            select 1 from public.community_posts p
             where p.id = post_id and p.is_hidden = false
        )
    );

drop policy if exists community_comments_update on public.community_comments;
create policy community_comments_update on public.community_comments
    for update to authenticated
    using (
        author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    )
    with check (
        author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    );

-- community_comments의 delete 정책은 cascade 삭제용(부모 posts purge 시). 개별 delete는 앱에서 호출하지 않음.
drop policy if exists community_comments_delete on public.community_comments;
create policy community_comments_delete on public.community_comments
    for delete to authenticated
    using (public.can_manage_admin_tables());

-- =====================================================================
-- RPC: 고정 (운영진만)
-- =====================================================================
drop function if exists public.community_pin_post(uuid, boolean);
create or replace function public.community_pin_post(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    update public.community_posts set is_pinned = p_pinned where id = p_post_id;

    if not found then
        raise exception 'not found' using errcode = 'P0002';
    end if;
end;
$$;

grant execute on function public.community_pin_post(uuid, boolean) to authenticated;

-- =====================================================================
-- RPC: 게시글 숨김/복원 (본인 또는 운영진)
-- =====================================================================
drop function if exists public.community_moderate_post(uuid, boolean, text);
create or replace function public.community_moderate_post(
    p_post_id uuid,
    p_hide boolean,
    p_reason text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor uuid := public.current_actor_member_id();
    v_author uuid;
begin
    select author_member_id into v_author from public.community_posts where id = p_post_id;

    if v_author is null then
        raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_actor is distinct from v_author and not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    update public.community_posts
       set is_hidden     = p_hide,
           hidden_by     = case when p_hide then v_actor else null end,
           hidden_reason = case when p_hide then p_reason else null end,
           hidden_at     = case when p_hide then now() else null end
     where id = p_post_id;
end;
$$;

grant execute on function public.community_moderate_post(uuid, boolean, text) to authenticated;

-- =====================================================================
-- RPC: 댓글 숨김/복원
-- =====================================================================
drop function if exists public.community_moderate_comment(uuid, boolean);
create or replace function public.community_moderate_comment(
    p_comment_id uuid,
    p_hide boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_actor uuid := public.current_actor_member_id();
    v_author uuid;
begin
    select author_member_id into v_author from public.community_comments where id = p_comment_id;

    if v_author is null then
        raise exception 'not found' using errcode = 'P0002';
    end if;

    if v_actor is distinct from v_author and not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    update public.community_comments
       set is_hidden = p_hide,
           hidden_by = case when p_hide then v_actor else null end,
           hidden_at = case when p_hide then now() else null end
     where id = p_comment_id;
end;
$$;

grant execute on function public.community_moderate_comment(uuid, boolean) to authenticated;

-- =====================================================================
-- RPC: purge (운영진만, 수동 호출)
-- =====================================================================
drop function if exists public.community_purge_hidden_after(integer);
create or replace function public.community_purge_hidden_after(p_days integer default 90)
returns table (deleted_posts integer, deleted_comments integer)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_posts int;
    v_comments int;
begin
    if not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    with d as (
        delete from public.community_comments
         where is_hidden = true and hidden_at < now() - (p_days || ' days')::interval
         returning 1
    ) select count(*)::int into v_comments from d;

    with d as (
        delete from public.community_posts
         where is_hidden = true and hidden_at < now() - (p_days || ' days')::interval
         returning 1
    ) select count(*)::int into v_posts from d;

    return query select v_posts, v_comments;
end;
$$;

grant execute on function public.community_purge_hidden_after(integer) to authenticated;
