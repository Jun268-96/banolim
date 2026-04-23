# 반올림 커뮤니티 기능 설계 문서

> 작성일: 2026-04-22
> 대상: 반올림 연구회 운영 웹앱 (Vite + React 19 + TS + Supabase + PWA)
> 전제: [`ANALYSIS.md`](./ANALYSIS.md)에서 식별된 5대 위험(RLS anon·snapshot 버그·alert/confirm·db.ts 확장·테스트 부재)을 처음부터 회피

---

## 1. 개요·목표

- **목적**: 로그인된 모든 회원이 자유롭게 글·댓글을 올릴 수 있는 조직 내부 커뮤니티 공간 제공.
- **범위 v1**: 텍스트 게시글(제목+본문), 1-depth 댓글, 고정글, 숨김(soft delete), 페이지네이션, PWA 푸시 연동. 이미지·파일 첨부·대댓글·신고 기능 제외.
- **비기능 목표**: 기존 `members`/`roles` 권한 체계 재사용, RLS로 최종 권위, 낙관적 업데이트는 `useRef` 패턴으로 안전, 테스트 먼저.

---

## 2. 데이터 모델

### 2.1 마이그레이션 파일

`supabase/migrations/20260422_community_posts_and_comments.sql`

### 2.2 DDL

```sql
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

comment on table public.community_posts is '커뮤니티 게시글 (텍스트 전용, 첨부 없음)';
comment on column public.community_posts.is_hidden is 'soft delete / 관리자 숨김. 90일 경과 시 purge 대상.';
comment on column public.community_posts.hidden_by is '숨김 처리한 멤버. 본인이면 self 숨김, 아니면 운영진 처리.';

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

comment on table public.community_comments is '커뮤니티 댓글 (1-depth, 대댓글 없음)';

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

-- purge 효율화 (부분 인덱스)
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
```

### 2.3 권한(grant)

```sql
-- ★ anon에 일체 허용하지 않음 (ANALYSIS.md P0 회피)
grant select, insert, update on public.community_posts to authenticated;
grant select, insert, update, delete on public.community_comments to authenticated;
```

### 2.4 RLS 정책

```sql
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;

-- SELECT: 숨김 아니거나, 본인이거나, 운영진
drop policy if exists community_posts_select on public.community_posts;
create policy community_posts_select on public.community_posts
    for select to authenticated
    using (
        is_hidden = false
        or author_member_id = public.current_actor_member_id()
        or public.can_manage_admin_tables()
    );

-- INSERT: 본인 member_id로만, 핀·숨김 상태 기본값 강제
drop policy if exists community_posts_insert on public.community_posts;
create policy community_posts_insert on public.community_posts
    for insert to authenticated
    with check (
        author_member_id = public.current_actor_member_id()
        and is_pinned = false
        and is_hidden = false
    );

-- UPDATE: 본인 또는 운영진. 컬럼 제한은 RPC로 강제
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

-- DELETE: 사용하지 않음. soft delete(is_hidden=true)만.
drop policy if exists community_posts_delete on public.community_posts;
-- (create 생략 — RLS enabled + 정책 없음 → delete 차단)
comment on table public.community_posts is
    '커뮤니티 게시글. 물리 삭제 금지, community_moderate_post RPC로 soft delete.';

-- ===== comments =====
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
```

> **참고 — comments delete 정책**: `community_comments_delete` 정책을 `can_manage_admin_tables()`로 허용해 둠. 사유: 운영진 purge/수동 정리 시 개별 댓글 삭제가 필요할 수 있고, 부모 post가 `on delete cascade`로 물리 삭제될 때 하위 댓글이 함께 사라져야 하는데 이 경로를 RLS가 막지 않도록 하기 위함. 일반 flow에서는 항상 soft delete(`community_moderate_comment`) 사용.

### 2.5 RPC (핀/숨김/purge)

```sql
-- 고정글 토글 (운영진만)
create or replace function public.community_pin_post(p_post_id uuid, p_pinned boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
    if not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;
    update public.community_posts set is_pinned = p_pinned where id = p_post_id;
end;
$$;
grant execute on function public.community_pin_post(uuid, boolean) to authenticated;

-- 게시글 숨김/복원 (본인 또는 운영진)
create or replace function public.community_moderate_post(
    p_post_id uuid, p_hide boolean, p_reason text default null
) returns void
language plpgsql security definer set search_path = public as $$
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
       set is_hidden = p_hide,
           hidden_by = case when p_hide then v_actor else null end,
           hidden_reason = case when p_hide then p_reason else null end,
           hidden_at = case when p_hide then now() else null end
     where id = p_post_id;
end;
$$;
grant execute on function public.community_moderate_post(uuid, boolean, text) to authenticated;

-- 댓글 숨김/복원
create or replace function public.community_moderate_comment(
    p_comment_id uuid, p_hide boolean
) returns void
language plpgsql security definer set search_path = public as $$
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

-- 숨김 후 N일 경과 purge (운영진만)
create or replace function public.community_purge_hidden_after(p_days integer default 90)
returns table (deleted_posts integer, deleted_comments integer)
language plpgsql security definer set search_path = public as $$
declare
    v_posts int; v_comments int;
begin
    if not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    with d as (
        delete from public.community_comments
         where is_hidden = true and hidden_at < now() - (p_days || ' days')::interval
         returning 1
    ) select count(*) into v_comments from d;

    with d as (
        delete from public.community_posts
         where is_hidden = true and hidden_at < now() - (p_days || ' days')::interval
         returning 1
    ) select count(*) into v_posts from d;

    return query select v_posts, v_comments;
end;
$$;
grant execute on function public.community_purge_hidden_after(integer) to authenticated;
```

---

## 3. API 레이어

`src/lib/api/community/` 신설 — `src/lib/db.ts`를 일체 건드리지 않음.

### 3.1 `posts.ts`

```ts
import { getSupabaseClient } from '../shared/client';
import { getErrorMessage } from '../shared/errors';
import type { CommunityPost, PostListFilters, Cursor } from '../../../types';
import { mapPostRow } from './mappers';

const PAGE_SIZE = 20;

export const listPosts = async (
  filters: PostListFilters = {},
  cursor?: Cursor,
): Promise<{ items: CommunityPost[]; nextCursor: Cursor | null }> => {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('community_posts')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (cursor) query = query.lt('created_at', cursor.createdAt);
  if (filters.authorMemberId) query = query.eq('author_member_id', filters.authorMemberId);
  if (filters.includeHidden !== true) query = query.eq('is_hidden', false);

  const { data, error } = await query;
  if (error) throw new Error(getErrorMessage(error));

  const rows = data ?? [];
  const hasNext = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map(mapPostRow);
  const nextCursor = hasNext ? { createdAt: rows[PAGE_SIZE - 1].created_at } : null;
  return { items, nextCursor };
};

export const getPost = async (id: string): Promise<CommunityPost | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('community_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(getErrorMessage(error));
  return data ? mapPostRow(data) : null;
};

export const createPost = async (input: {
  title: string; body: string; authorMemberId: string;
}): Promise<CommunityPost> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      title: input.title.trim(),
      body: input.body.trim(),
      author_member_id: input.authorMemberId,
    })
    .select('*').single();
  if (error) throw new Error(getErrorMessage(error));
  return mapPostRow(data);
};

export const updatePost = async (
  id: string, input: { title?: string; body?: string },
): Promise<CommunityPost> => {
  const supabase = getSupabaseClient();
  const patch: Record<string, string> = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.body !== undefined) patch.body = input.body.trim();
  const { data, error } = await supabase
    .from('community_posts').update(patch).eq('id', id).select('*').single();
  if (error) throw new Error(getErrorMessage(error));
  return mapPostRow(data);
};

export const hidePost = async (id: string, reason?: string): Promise<void> => {
  const { error } = await getSupabaseClient()
    .rpc('community_moderate_post', { p_post_id: id, p_hide: true, p_reason: reason ?? null });
  if (error) throw new Error(getErrorMessage(error));
};

export const unhidePost = async (id: string): Promise<void> => {
  const { error } = await getSupabaseClient()
    .rpc('community_moderate_post', { p_post_id: id, p_hide: false });
  if (error) throw new Error(getErrorMessage(error));
};

export const pinPost = async (id: string, pinned: boolean): Promise<void> => {
  const { error } = await getSupabaseClient()
    .rpc('community_pin_post', { p_post_id: id, p_pinned: pinned });
  if (error) throw new Error(getErrorMessage(error));
};
```

### 3.2 `comments.ts`

```ts
import { getSupabaseClient } from '../shared/client';
import { getErrorMessage } from '../shared/errors';
import type { CommunityComment } from '../../../types';
import { mapCommentRow } from './mappers';

export const listComments = async (postId: string): Promise<CommunityComment[]> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: true });
  if (error) throw new Error(getErrorMessage(error));
  return (data ?? []).map(mapCommentRow);
};

export const createComment = async (input: {
  postId: string; body: string; authorMemberId: string;
}): Promise<CommunityComment> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('community_comments')
    .insert({
      post_id: input.postId,
      body: input.body.trim(),
      author_member_id: input.authorMemberId,
    })
    .select('*').single();
  if (error) throw new Error(getErrorMessage(error));
  return mapCommentRow(data);
};

export const updateComment = async (id: string, body: string): Promise<CommunityComment> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('community_comments').update({ body: body.trim() }).eq('id', id).select('*').single();
  if (error) throw new Error(getErrorMessage(error));
  return mapCommentRow(data);
};

export const hideComment = async (id: string): Promise<void> => {
  const { error } = await getSupabaseClient()
    .rpc('community_moderate_comment', { p_comment_id: id, p_hide: true });
  if (error) throw new Error(getErrorMessage(error));
};
```

### 3.3 `mappers.ts`

```ts
import type { Database } from '../../../types/database';
import type { CommunityPost, CommunityComment } from '../../../types';

type PostRow = Database['public']['Tables']['community_posts']['Row'];
type CommentRow = Database['public']['Tables']['community_comments']['Row'];

export const mapPostRow = (row: PostRow): CommunityPost => ({
  id: row.id,
  authorMemberId: row.author_member_id,
  title: row.title,
  body: row.body,
  isPinned: row.is_pinned,
  isHidden: row.is_hidden,
  hiddenBy: row.hidden_by,
  hiddenReason: row.hidden_reason,
  hiddenAt: row.hidden_at,
  commentCount: row.comment_count,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const mapCommentRow = (row: CommentRow): CommunityComment => ({
  id: row.id,
  postId: row.post_id,
  authorMemberId: row.author_member_id,
  body: row.body,
  isHidden: row.is_hidden,
  hiddenBy: row.hidden_by,
  hiddenAt: row.hidden_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
```

### 3.4 `index.ts`

```ts
export * from './posts';
export * from './comments';
```

---

## 4. 타입 정의 (`src/types/index.ts`에 추가)

```ts
export interface CommunityPost {
    id: string;
    authorMemberId: string;
    title: string;
    body: string;
    isPinned: boolean;
    isHidden: boolean;
    hiddenBy: string | null;
    hiddenReason: string | null;
    hiddenAt: string | null;
    commentCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface CommunityComment {
    id: string;
    postId: string;
    authorMemberId: string;
    body: string;
    isHidden: boolean;
    hiddenBy: string | null;
    hiddenAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface PostListFilters {
    authorMemberId?: string;
    includeHidden?: boolean;   // 운영진 전체 뷰/본인 뷰에서만 true
}

export interface Cursor {
    createdAt: string;
}
```

`src/types/database.ts`는 `supabase gen types`로 재생성되며 자동 반영.

---

## 5. 상태 훅 — snapshot 버그 회피 패턴

`src/components/community/hooks/useCommunityResources.ts` — **`useRef<Map>` 토큰 기반**으로 `ANALYSIS.md` P0 버그를 처음부터 회피.

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CommunityPost, CommunityComment, Cursor } from '../../../types';
import { listPosts, listComments } from '../../../lib/api/community';

interface CommunityState {
  posts: CommunityPost[];
  commentsByPost: Record<string, CommunityComment[]>;
  nextCursor: Cursor | null;
}

interface Snapshot {
  posts?: CommunityPost[];
  comments?: { postId: string; items: CommunityComment[] };
}

const initialState: CommunityState = { posts: [], commentsByPost: {}, nextCursor: null };

export const useCommunityResources = () => {
  const [state, setState] = useState<CommunityState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  // ★ snapshot은 setter 바깥 ref에 보관 → React StrictMode의 setter 2회 호출에도 안전
  const rollbackRef = useRef<Map<string, Snapshot>>(new Map());

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      const { items, nextCursor } = await listPosts();
      if (!isMounted) return;
      setState({ posts: items, commentsByPost: {}, nextCursor });
      setIsLoading(false);
    })();
    return () => { isMounted = false; };
  }, []);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    const { items, nextCursor } = await listPosts();
    setState({ posts: items, commentsByPost: {}, nextCursor });
    setIsLoading(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!state.nextCursor) return;
    const { items, nextCursor } = await listPosts({}, state.nextCursor);
    setState((prev) => ({ ...prev, posts: [...prev.posts, ...items], nextCursor }));
  }, [state.nextCursor]);

  const loadComments = useCallback(async (postId: string) => {
    const items = await listComments(postId);
    setState((prev) => ({
      ...prev,
      commentsByPost: { ...prev.commentsByPost, [postId]: items },
    }));
  }, []);

  // ★★ 낙관적 숨김 — 토큰으로 snapshot을 ref에 저장
  const optimisticallyHidePost = useCallback((id: string) => {
    const token = `post:${id}:${Date.now()}:${Math.random()}`;
    setState((prev) => {
      // 첫 저장만 유지 (StrictMode 2회 호출 시 덮어쓰기 방지)
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, { posts: prev.posts });
      }
      return { ...prev, posts: prev.posts.filter((p) => p.id !== id) };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.posts) return;
      setState((prev) => ({ ...prev, posts: snap.posts! }));
    };
  }, []);

  const optimisticallyHideComment = useCallback((postId: string, commentId: string) => {
    const token = `comment:${commentId}:${Date.now()}:${Math.random()}`;
    setState((prev) => {
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, {
          comments: { postId, items: prev.commentsByPost[postId] ?? [] },
        });
      }
      return {
        ...prev,
        commentsByPost: {
          ...prev.commentsByPost,
          [postId]: (prev.commentsByPost[postId] ?? []).filter((c) => c.id !== commentId),
        },
      };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.comments) return;
      setState((prev) => ({
        ...prev,
        commentsByPost: { ...prev.commentsByPost, [snap.comments!.postId]: snap.comments!.items },
      }));
    };
  }, []);

  const appendPost = useCallback((post: CommunityPost) => {
    setState((prev) => ({ ...prev, posts: [post, ...prev.posts] }));
  }, []);

  const appendComment = useCallback((comment: CommunityComment) => {
    setState((prev) => ({
      ...prev,
      commentsByPost: {
        ...prev.commentsByPost,
        [comment.postId]: [...(prev.commentsByPost[comment.postId] ?? []), comment],
      },
      posts: prev.posts.map((p) =>
        p.id === comment.postId ? { ...p, commentCount: p.commentCount + 1 } : p,
      ),
    }));
  }, []);

  const updatePostInState = useCallback((post: CommunityPost) => {
    setState((prev) => ({ ...prev, posts: prev.posts.map((p) => (p.id === post.id ? post : p)) }));
  }, []);

  return {
    ...state,
    isLoading,
    refreshData,
    loadMore,
    loadComments,
    optimisticallyHidePost,
    optimisticallyHideComment,
    appendPost,
    appendComment,
    updatePostInState,
  };
};
```

**핵심 차별점** (`useSettingsResources.ts:124-181` 대비):

| 항목 | 기존 settings 훅 | 커뮤니티 훅 (권장) |
|---|---|---|
| snapshot 저장 | setter 내부 `let snapshot` | setter 바깥 `useRef<Map>` |
| 토큰 | 없음 (변수 하나 덮어씀) | `post:<id>:<ts>:<rand>` 고유 키 |
| StrictMode 2회 호출 | snapshot이 **필터된 값**으로 덮어써짐 | `has()` 가드로 최초 값만 유지 |
| 동시 rollback | 충돌 가능 | Map 키로 분리 |

---

## 6. 컴포넌트 구조

```
src/components/community/
├── CommunityTab.tsx                 # 진입점. activePostId 상태로 리스트↔상세 전환
├── hooks/
│   └── useCommunityResources.ts     # 위 5장
├── sections/
│   ├── PostListSection.tsx          # 고정글 상단 + 일반글 + loadMore 트리거
│   ├── PostDetailSection.tsx        # 본문 + 작성자 정보 + 댓글 섹션
│   └── PostComposerSection.tsx      # 글 작성·수정 폼 (글자 수 카운터)
├── dialogs/
│   ├── PostModerateDialog.tsx       # 숨김/복원 (AppDialog 기반)
│   └── PostDeleteConfirmDialog.tsx  # confirm() 대체
└── shared/
    ├── PostCard.tsx                 # 리스트 카드 (제목·요약·메타)
    ├── CommentItem.tsx              # 댓글 한 줄 (본인 수정/숨김 메뉴)
    └── CommentComposer.tsx          # 댓글 입력
```

- 탭 라우팅은 `App.tsx`의 `activeTab` state 패턴을 그대로 따른다 — URL 기반 라우터 도입 없음.
- `AppDialog`와 토스트 훅(미존재 시 이 단계에서 도입)으로 **`alert`/`confirm` 없이** 상호작용.
- `PostComposerSection`은 `max={5000}`과 `{body.length}/5000` 카운터 제공. DB check와 이중 방어.

---

## 7. 권한 매트릭스

### 7.1 프런트 `AppPermissions` 확장 (`src/lib/permissions.ts`)

```ts
export interface AppPermissions {
    canViewHome: boolean;
    canViewMembers: boolean;
    canViewActivities: boolean;
    canManageMembers: boolean;
    canManageSettings: boolean;
    canViewStats: boolean;
    // 신규 — 커뮤니티
    canViewCommunity: boolean;
    canPostToCommunity: boolean;
    canModerateCommunity: boolean;
}

export const buildPermissions = (role: AppRole): AppPermissions => ({
    canViewHome: true,
    canViewMembers: role !== 'member',
    canViewActivities: role === 'super_admin' || role === 'operator' || role === 'team_lead',
    canManageMembers: role === 'super_admin' || role === 'operator',
    canManageSettings: role === 'super_admin' || role === 'operator',
    canViewStats: role !== 'member',
    // 커뮤니티는 전 역할에 열림, 운영 권한은 admin 테이블 관리 권한에 연동
    canViewCommunity: true,
    canPostToCommunity: true,
    canModerateCommunity: role === 'super_admin' || role === 'operator',
});
```

### 7.2 프런트 × DB 정책 1:1 대응 표

| 작업 | super_admin | operator | team_lead | member | DB 최종 강제 |
|---|:---:|:---:|:---:|:---:|---|
| 게시글 목록 조회 | ✅ | ✅ | ✅ | ✅ | `community_posts_select` |
| 숨김 포함 조회 | ✅ | ✅ | 본인만 | 본인만 | RLS `is_hidden=false OR author=self OR can_manage_admin_tables()` |
| 게시글 작성 | ✅ | ✅ | ✅ | ✅ | `community_posts_insert` (author=self, is_pinned=false, is_hidden=false) |
| 본인 글 본문 수정 | ✅ | ✅ | ✅ | ✅ | `community_posts_update` using author=self |
| 남의 글 본문 수정 | ❌ | ❌ | ❌ | ❌ | RLS 차단 |
| 본인 글 숨김/복원 | ✅ | ✅ | ✅ | ✅ | `community_moderate_post` (v_actor=v_author) |
| 남의 글 숨김/복원 | ✅ | ✅ | ❌ | ❌ | `community_moderate_post` + `can_manage_admin_tables()` |
| 글 고정/해제 | ✅ | ✅ | ❌ | ❌ | `community_pin_post` + `can_manage_admin_tables()` |
| 댓글 목록 | ✅ | ✅ | ✅ | ✅ | `community_comments_select` |
| 댓글 작성 | ✅ | ✅ | ✅ | ✅ | `community_comments_insert` (post.is_hidden=false 필수) |
| 본인 댓글 수정/숨김 | ✅ | ✅ | ✅ | ✅ | `community_moderate_comment` (self) |
| 남의 댓글 숨김 | ✅ | ✅ | ❌ | ❌ | `community_moderate_comment` + admin |
| 90일 경과 purge | ✅ | ✅ | ❌ | ❌ | `community_purge_hidden_after` + admin |

**원칙**: DB가 최종 권위. 프런트 플래그는 UI 렌더링 용도일 뿐, 우회 시도는 DB에서 차단된다.

### 7.3 `Sidebar.tsx` 탭 등록

```ts
// src/components/layout/Sidebar.tsx
import { MessageSquare } from 'lucide-react';

export type TabType = 'home' | 'dashboard' | 'activities' | 'settings' | 'stats' | 'community';

const navItems = [
  // ... 기존 5개
  { id: 'community', label: '커뮤니티', icon: MessageSquare, visible: permissions.canViewCommunity },
] as const;
```

`src/App.tsx`의 `allowedTabs` useMemo·`getFirstAllowedTab`·render 분기에도 동일 추가.

---

## 8. DB 용량 분석

### 8.1 가정

| 변수 | 값 |
|---|---|
| 활성 회원 | 100명 |
| 주당 글 수 | 3 글/인 → **300 글/주** |
| 연간 글 수 | **~15,600 글** |
| 글 평균 본문 | 한글 1,000자 (최대 5,000자) |
| 글 평균 제목 | 한글 30자 |
| 글당 댓글 평균 | 5 개 |
| 댓글 평균 본문 | 한글 200자 |

### 8.2 바이트 계산 (PostgreSQL UTF-8, 한글 3 B/문자)

| 컬럼 | 평균 바이트 |
|---|---|
| 글 `title` 30자 | 90 |
| 글 `body` 1,000자 | 3,000 |
| 글 메타 (uuid × 3 + bool × 2 + ts × 3 + int) | ~150 |
| 행 오버헤드 (heap tuple header 등) | ~70 |
| **글 1행 합** | **≈ 3,310 B (3.3 KB)** |
| 댓글 `body` 200자 | 600 |
| 댓글 메타 + 오버헤드 | ~200 |
| **댓글 1행 합** | **≈ 800 B** |

### 8.3 연간 예상

- 글 저장: 15,600 × 3.3 KB ≈ **51 MB**
- 댓글 저장: 15,600 × 5 × 0.8 KB ≈ **62 MB**
- 인덱스 (6개, 평균 row 크기의 40%): ≈ **45 MB**
- **합계: 연 ≈ 160 MB**

Supabase Free(500 MB) 기준 **2~3년 여유**, Pro(8 GB) 기준 수십 년. 다만 선제 대응은 아래 3전략.

### 8.4 용량 관리 전략

**① 자동 purge — 운영자 데이터 관리 UI 또는 cron**

```sql
-- 즉시 실행 (운영자)
select * from public.community_purge_hidden_after(90);

-- pg_cron 설치 환경에서 스케줄
select cron.schedule(
  'community_purge_daily',
  '0 3 * * *',
  $$ select public.community_purge_hidden_after(90); $$
);
```

**② 시즌 아카이브 — 연 1회 JSONB 압축 이관**

```sql
create table if not exists public.community_archive (
    id uuid primary key default gen_random_uuid(),
    season_id uuid not null references public.seasons(id) on delete restrict,
    archived_at timestamptz not null default now(),
    payload jsonb not null
);

create or replace function public.community_archive_season(p_season_id uuid)
returns table (archived_posts integer, archived_comments integer)
language plpgsql security definer set search_path = public as $$
declare
    v_start timestamptz; v_end timestamptz;
    v_posts int; v_comments int;
begin
    if not public.can_manage_admin_tables() then
        raise exception 'forbidden' using errcode = '42501';
    end if;

    select start_date, end_date into v_start, v_end
      from public.seasons where id = p_season_id;

    insert into public.community_archive (season_id, payload)
    values (p_season_id, jsonb_build_object(
      'posts', (select coalesce(jsonb_agg(to_jsonb(p.*)), '[]'::jsonb)
                  from public.community_posts p where p.created_at between v_start and v_end),
      'comments', (select coalesce(jsonb_agg(to_jsonb(c.*)), '[]'::jsonb)
                     from public.community_comments c
                     join public.community_posts p on p.id = c.post_id
                    where p.created_at between v_start and v_end)
    ));

    with d as (
      delete from public.community_posts
       where created_at between v_start and v_end returning 1
    ) select count(*) into v_posts from d;
    get diagnostics v_comments = row_count;  -- comments는 cascade로 함께 삭제됨

    return query select v_posts, v_comments;
end;
$$;
grant execute on function public.community_archive_season(uuid) to authenticated;
```

JSONB는 TOAST 압축으로 raw 대비 60~70% 축소. 아카이브 읽기는 읽기 전용 뷰 또는 운영 화면 전용.

**③ 인덱스 비용 관리** — 제시된 6개 인덱스 합 연 45 MB. 추가 인덱스는 실제 slow query 확인 후 결정.

---

## 9. PWA 푸시 연동

> **v1 배포 상태**: 현재 Supabase 프로젝트에 `pg_net` extension이 설치되어 있지 않아 DB trigger 방식 push는 적용하지 않았다. 대신 프론트 API 레이어에서 기존 `sendPushNotification` 함수 패턴을 따라 edge function을 호출하는 방식을 향후 연결한다. 본 §9는 확장 시 참고 설계.

기존 `supabase/functions/send-push-notification` edge function과 `src/sw.ts:24-40` push handler를 **재사용**. 트리거는 DB 측에 배치해 앱-서버 결합 최소화.

### 9.1 게시글 생성 푸시 (audience=all)

```sql
create or replace function public.tg_community_post_notify()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
    perform net.http_post(
        url := current_setting('app.push_fn_url', true),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.anon_key', true)
        ),
        body := jsonb_build_object(
            'title', '새 커뮤니티 글',
            'body', new.title,
            'url', '/?tab=community&post=' || new.id::text,
            'audience', 'all'
        )
    );
    return new;
exception
    when others then
        -- fire-and-forget: 알림 실패가 글 작성을 막지 않도록
        return new;
end;
$$;

drop trigger if exists community_post_notify on public.community_posts;
create trigger community_post_notify
    after insert on public.community_posts
    for each row execute function public.tg_community_post_notify();
```

### 9.2 댓글 생성 푸시 (원글 작성자 1인)

```sql
create or replace function public.tg_community_comment_notify()
returns trigger language plpgsql security definer
set search_path = public as $$
declare v_author uuid;
begin
    select author_member_id into v_author from public.community_posts where id = new.post_id;
    if v_author is null or v_author = new.author_member_id then
        return new;  -- 셀프 댓글은 알림 없음
    end if;

    perform net.http_post(
        url := current_setting('app.push_fn_url', true),
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
            'title', '내 글에 댓글',
            'body', left(new.body, 60),
            'url', '/?tab=community&post=' || new.post_id::text,
            'audience', 'member:' || v_author::text
        )
    );
    return new;
exception when others then return new;
end;
$$;

drop trigger if exists community_comment_notify on public.community_comments;
create trigger community_comment_notify
    after insert on public.community_comments
    for each row execute function public.tg_community_comment_notify();
```

### 9.3 프런트 deeplink 처리

```ts
// src/App.tsx
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab') as TabType | null;
  const post = params.get('post');
  if (tab === 'community' && allowedTabs.includes('community')) {
    setActiveTab('community');
    if (post) {
      // CommunityTab 내부에서 URL parameter를 읽어 activePostId 설정
    }
  }
}, [allowedTabs]);
```

Service Worker의 `notificationclick` 핸들러(`src/sw.ts:42-58`)는 이미 `client.navigate(url)`을 호출하므로 추가 작업 없음.

### 9.4 edge function audience 확장

`supabase/functions/send-push-notification/index.ts`에 `audience` 파서 추가: `all` / `member:<uuid>` / `role:<role>`. 현재 공지 기능이 어떤 포맷을 쓰는지 확인 후 일치시켜야 한다 (`supabase/migrations/20260403_push_subscriptions.sql` 참조).

---

## 10. 테스트 계획

### 10.1 mapper (`src/lib/api/community/mappers.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { mapPostRow, mapCommentRow } from './mappers';

describe('community mappers', () => {
  it('maps snake_case post row to camelCase CommunityPost', () => {
    const row = { id: 'p1', author_member_id: 'm1', title: 't', body: 'b',
      is_pinned: false, is_hidden: false, hidden_by: null, hidden_reason: null,
      hidden_at: null, comment_count: 0,
      created_at: '2026-04-22T00:00:00Z', updated_at: '2026-04-22T00:00:00Z' };
    expect(mapPostRow(row as any)).toMatchObject({
      id: 'p1', authorMemberId: 'm1', isPinned: false, commentCount: 0,
    });
  });

  it('preserves null hidden fields', () => {
    const row = { /* ... */ hidden_by: null, hidden_reason: null, hidden_at: null };
    expect(mapPostRow(row as any).hiddenBy).toBeNull();
  });
});
```

### 10.2 훅 — **rollback 회귀 방지 (분석 보고서 P0 연결)**

```ts
// src/components/community/hooks/useCommunityResources.test.tsx
import { StrictMode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCommunityResources } from './useCommunityResources';

vi.mock('../../../lib/api/community', () => ({
  listPosts: vi.fn().mockResolvedValue({
    items: [{ id: 'p1', title: 'hi', /* ... */ }, { id: 'p2', title: 'there' /* ... */ }],
    nextCursor: null,
  }),
  listComments: vi.fn(),
}));

describe('useCommunityResources rollback safety', () => {
  it('restores original posts when rollback runs under StrictMode 2x invocation', async () => {
    const { result } = renderHook(() => useCommunityResources(), { wrapper: StrictMode });
    await act(async () => {}); // initial load

    expect(result.current.posts).toHaveLength(2);

    let rollback: () => void = () => {};
    await act(async () => {
      rollback = result.current.optimisticallyHidePost('p1');
    });
    expect(result.current.posts).toHaveLength(1);

    await act(async () => { rollback(); });
    // ★ StrictMode setter 2회 호출에도 원본(2개) 복구
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });
});
```

### 10.3 API (`posts.test.ts`)

```ts
describe('listPosts', () => {
  it('applies cursor when provided', async () => {
    const chain = makeChain(); // supabase mock
    await listPosts({}, { createdAt: '2026-04-01T00:00:00Z' });
    expect(chain.lt).toHaveBeenCalledWith('created_at', '2026-04-01T00:00:00Z');
  });

  it('returns nextCursor when exactly PAGE_SIZE+1 rows returned', async () => { /* ... */ });
  it('returns null nextCursor when fewer rows', async () => { /* ... */ });
});
```

### 10.4 권한 (`src/lib/permissions.test.ts` 확장)

```ts
it('builds community permissions per role', () => {
  expect(buildPermissions('member').canPostToCommunity).toBe(true);
  expect(buildPermissions('member').canModerateCommunity).toBe(false);
  expect(buildPermissions('team_lead').canModerateCommunity).toBe(false);
  expect(buildPermissions('operator').canModerateCommunity).toBe(true);
  expect(buildPermissions('super_admin').canModerateCommunity).toBe(true);
});
```

### 10.5 통합 — UI 레벨 (선택)

- `CommunityTab.test.tsx`: member 계정 → 고정/숨김 버튼 미노출, operator → 노출
- 숨겨진 글은 member에게 리스트에서 제외, operator에게는 "숨김" 뱃지와 함께 표시

### 10.6 DB 계약 검증 (수동 SQL)

```sql
-- RLS 검증: 다른 member가 남의 글 수정 불가
set local role authenticated;
set local "request.jwt.claim.sub" to '<other_member_auth_id>';
update public.community_posts set title = 'HACK' where id = '<someone_else_post>';
-- 0 rows affected 이어야 함

-- anon 차단 검증
set local role anon;
select count(*) from public.community_posts;
-- permission denied 이어야 함
```

---

## 11. 마이그레이션 순서 — `docs/db-contracts.md` 준수 체크리스트

### Phase A: DB

- [ ] `supabase/migrations/20260422_community_posts_and_comments.sql` 작성 (2장 전체)
- [ ] `anon` grant 없음 재확인 (`grep -n anon supabase/migrations/20260422*`)
- [ ] 로컬 `supabase db reset` 또는 `migration up` 실행
- [ ] RLS 수동 검증 SQL 실행 (10.6)
- [ ] `supabase/schema.sql`에 신규 테이블·정책·함수·트리거 snapshot 반영

### Phase B: TS 타입

- [ ] `supabase gen types typescript` 재실행 → `src/types/database.ts` 갱신
- [ ] `community_posts`, `community_comments` Row/Insert/Update 타입 검증
- [ ] `src/types/index.ts`에 `CommunityPost`, `CommunityComment`, `PostListFilters`, `Cursor` 추가

### Phase C: API 레이어

- [ ] `src/lib/api/community/{posts,comments,mappers,index}.ts` 작성 (3장)
- [ ] `src/lib/db.ts`를 **수정하지 않음** 확인
- [ ] `npm run test -- community` mapper·API 단위 테스트 통과

### Phase D: 프런트 기반

- [ ] `src/lib/permissions.ts` 3개 플래그 추가 (7.1)
- [ ] `src/components/layout/Sidebar.tsx` TabType·navItems 업데이트 (7.3)
- [ ] `src/App.tsx` `allowedTabs`·`getFirstAllowedTab`·render 분기에 `'community'` 추가
- [ ] 공용 `AppDialog` 기반 Confirm 훅이 없다면 `src/components/shared/useConfirm.tsx` 신설 (`ANALYSIS.md` P1 항목과 함께 진행)

### Phase E: UI

- [ ] `src/components/community/` 구조 생성 (6장)
- [ ] `CommunityTab.tsx`에서 lazy load 연결 (`App.tsx`의 기존 패턴 따라)
- [ ] 글자 수 카운터·빈 상태·로딩 상태 구현

### Phase F: 푸시

- [ ] `20260422_community_posts_and_comments.sql` 하단에 notify trigger 추가 (9장)
- [ ] `supabase/functions/send-push-notification`의 `audience` 파서 기존 포맷과 일치 확인
- [ ] `src/App.tsx` URL deeplink 파싱 추가

### Phase G: 훅 테스트

- [ ] `useCommunityResources.test.tsx` rollback 회귀 테스트 (10.2)
- [ ] `permissions.test.ts` 확장 (10.4)

### Phase H: 배포

- [ ] staging에 마이그레이션 적용 → e2e 수동 검증 (작성/댓글/숨김/푸시 각 1회)
- [ ] production 마이그레이션
- [ ] `docs/db-contracts.md`에 `community_*` 주의사례 추가
- [ ] `refactoring.md`에 신규 모듈 위치·설계 기록

---

## 12. 위험·엣지 케이스

| # | 위험 | 방어 |
|:-:|---|---|
| 1 | **XSS — body에 `<script>`** | React 기본 escaping. `dangerouslySetInnerHTML` 절대 금지. 링크 렌더 시 `URL` 생성자 파싱 + `https:` 프로토콜만 허용. |
| 2 | **도배/스팸** | v1.5에서 rate-limit RPC 도입 (예: `check_post_rate_limit(member_id)` — 분당 3글, 일 20글). trigger `BEFORE INSERT`에서 검사. |
| 3 | **삭제된 글의 댓글** | FK `on delete cascade`. purge 시 함께 제거. soft hide는 부모만 숨겨도 댓글 UI는 부모 기준으로 숨김. |
| 4 | **권한 변경 후 과거 글 접근** | RLS가 `current_actor_member_id()` 런타임 평가 → member→operator 승격 즉시 모든 숨김 글 보임. 마이그레이션 불필요. |
| 5 | **단일 글 1000+ 댓글 성능** | v1은 전량 로드. `community_comments_post_idx` 덕분에 post_id 기준 1000 row 조회는 <10ms. 5000+ 시 댓글 페이지네이션 추가. |
| 6 | **낙관적 업데이트 중복 rollback** | `useRef<Map>` + `${id}:${ts}:${random}` 토큰. 동일 id에 대한 연속 숨김도 안전. 5장 참조. |
| 7 | **숨겨진 글의 댓글 표시** | 글 `is_hidden=true`면 `PostDetailSection`이 본문과 댓글 섹션 모두 숨김. 운영진 모드만 열람. |
| 8 | **푸시 폭주** | 글 푸시는 `audience=all`이 기본이지만 일반 글은 opt-in 플래그(`notify_all`) 도입 권장. v1은 전체 푸시 X, 운영 공지성만. 댓글은 원글 작성자 1인만. |
| 9 | **trigger의 HTTP 실패로 인한 insert 실패** | `exception when others then return new` 블록으로 fire-and-forget 유지. 기존 `sendPushNotification` 패턴과 동일. |
| 10 | **`BYPASS_AUTH` 모드** | Supabase 클라이언트 null → 커뮤니티도 로컬 mock. `src/lib/api/shared/localState.ts`에 `communityPosts`, `communityComments` 샘플 배열 추가 필요. |
| 11 | **프런트에서 길이 우회** | DB `check (char_length … between 1 and N)` 최종 방어. 프런트 검증 + zod schema 추가로 3중 방어. |
| 12 | **특정 사용자의 괴롭힘 댓글** | v1: 운영진 숨김만. v2에 `community_mutes` 테이블(본인이 특정 member 블록) 또는 신고 기능 설계 재검토. |
| 13 | **`comment_count` 드리프트** | 트리거로 유지하지만 혹시 모를 드리프트 감지: 관리자 대시보드에 `select p.id, p.comment_count, count(c.*) from ... group by p.id having p.comment_count != count(c.*)` 검증 쿼리 비치. |
| 14 | **동시 수정 충돌** | 글 수정 시 `updated_at` optimistic lock은 생략 (단일 작성자 수정이 일반적). 댓글은 수정 자체를 제한(본인만) + 짧은 본문이라 충돌 가능성 낮음. |
| 15 | **검색** | v1 제외. 연 15k 글 수준에서는 `ilike '%kw%'`로도 충분. v2에서 `pg_trgm` 인덱스 + `gin` 고려. |

---

## 부록 A. 설계가 `ANALYSIS.md`의 5대 위험을 회피한 방식 확인

| 분석 위험 | 이 설계의 대응 |
|---|---|
| RLS `anon` 과다 | `grant` 및 정책에서 `anon` 일절 없음. 2.3·2.4 참조 |
| snapshot 클로저 버그 | `useRef<Map>` + 토큰 기반 패턴. 5장 참조 |
| `alert/confirm` 남용 | 공용 `AppDialog` + Confirm 훅. 6장 참조 |
| `db.ts` 거대화 | 처음부터 `lib/api/community/` 분리. 3장 참조 |
| 테스트 부재 | mapper·API·훅·권한·통합까지 계획. 10장 참조 |

## 부록 B. v2 로드맵 (범위 밖이지만 기록)

- 신고(report) 테이블 + 운영진 워크플로
- 사용자 블록/뮤트 (`community_mutes`)
- 댓글 페이지네이션 (글당 5000+ 대비)
- `pg_trgm` 기반 검색
- 실시간 업데이트 (`supabase.channel('community:*')`)
- 읽은 표시 (`last_seen_at`) — 미읽음 배지
- rate limit trigger + 어뷰저 자동 차단
