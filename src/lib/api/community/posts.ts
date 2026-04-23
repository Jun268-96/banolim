import { isSupabaseConfigured } from '../../supabase';
import { getSupabaseClient } from '../shared/client';
import { getErrorMessage } from '../shared/errors';
import { localState } from '../shared/localState';
import type { CommunityPost, PostListFilters, Cursor } from '../../../types';
import { mapPostRow } from './mappers';

const PAGE_SIZE = 20;

const sortPostsForList = (items: CommunityPost[]): CommunityPost[] =>
    [...items].sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAt.localeCompare(a.createdAt);
    });

const paginateLocal = (
    items: CommunityPost[],
    cursor?: Cursor,
): { items: CommunityPost[]; nextCursor: Cursor | null } => {
    const sorted = sortPostsForList(items);
    const startIndex = cursor
        ? sorted.findIndex((p) => p.createdAt < cursor.createdAt)
        : 0;
    const pool = startIndex === -1 ? [] : sorted.slice(startIndex);
    const page = pool.slice(0, PAGE_SIZE);
    const nextCursor =
        pool.length > PAGE_SIZE
            ? { createdAt: page[page.length - 1].createdAt }
            : null;
    return { items: page, nextCursor };
};

export const listPosts = async (
    filters: PostListFilters = {},
    cursor?: Cursor,
): Promise<{ items: CommunityPost[]; nextCursor: Cursor | null }> => {
    if (!isSupabaseConfigured) {
        const all = localState.communityPosts.filter((post) => {
            if (filters.includeHidden !== true && post.isHidden) return false;
            if (filters.authorMemberId && post.authorMemberId !== filters.authorMemberId) return false;
            return true;
        });
        return paginateLocal(all, cursor);
    }

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
    if (!isSupabaseConfigured) {
        const found = localState.communityPosts.find((post) => post.id === id);
        return found ? { ...found } : null;
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .eq('id', id)
        .maybeSingle();
    if (error) throw new Error(getErrorMessage(error));
    return data ? mapPostRow(data) : null;
};

export const createPost = async (input: {
    title: string;
    body: string;
    authorMemberId: string;
}): Promise<CommunityPost> => {
    const now = new Date().toISOString();
    const title = input.title.trim();
    const body = input.body.trim();

    if (!isSupabaseConfigured) {
        const post: CommunityPost = {
            id: `post_local_${Date.now()}`,
            authorMemberId: input.authorMemberId,
            title,
            body,
            isPinned: false,
            isHidden: false,
            hiddenBy: null,
            hiddenReason: null,
            hiddenAt: null,
            commentCount: 0,
            createdAt: now,
            updatedAt: now,
        };
        localState.communityPosts = [post, ...localState.communityPosts];
        return { ...post };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('community_posts')
        .insert({
            title,
            body,
            author_member_id: input.authorMemberId,
        })
        .select('*')
        .single();
    if (error) throw new Error(getErrorMessage(error));
    return mapPostRow(data);
};

export const updatePost = async (
    id: string,
    input: { title?: string; body?: string },
): Promise<CommunityPost> => {
    if (!isSupabaseConfigured) {
        const idx = localState.communityPosts.findIndex((post) => post.id === id);
        if (idx === -1) throw new Error('게시글을 찾지 못했습니다.');
        const current = localState.communityPosts[idx];
        const next: CommunityPost = {
            ...current,
            title: input.title !== undefined ? input.title.trim() : current.title,
            body: input.body !== undefined ? input.body.trim() : current.body,
            updatedAt: new Date().toISOString(),
        };
        localState.communityPosts = [
            ...localState.communityPosts.slice(0, idx),
            next,
            ...localState.communityPosts.slice(idx + 1),
        ];
        return { ...next };
    }

    const supabase = getSupabaseClient();
    const patch: Record<string, string> = {};
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.body !== undefined) patch.body = input.body.trim();
    const { data, error } = await supabase
        .from('community_posts')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw new Error(getErrorMessage(error));
    return mapPostRow(data);
};

const mutateLocalPostFlags = (
    id: string,
    mutator: (post: CommunityPost) => CommunityPost,
): void => {
    let found = false;
    localState.communityPosts = localState.communityPosts.map((post) => {
        if (post.id !== id) return post;
        found = true;
        return mutator(post);
    });
    if (!found) throw new Error('게시글을 찾지 못했습니다.');
};

export const hidePost = async (id: string, reason?: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        const now = new Date().toISOString();
        mutateLocalPostFlags(id, (post) => ({
            ...post,
            isHidden: true,
            hiddenReason: reason ?? null,
            hiddenAt: now,
            updatedAt: now,
        }));
        return;
    }

    const { error } = await getSupabaseClient().rpc('community_moderate_post', {
        p_post_id: id,
        p_hide: true,
        p_reason: reason ?? undefined,
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const unhidePost = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        mutateLocalPostFlags(id, (post) => ({
            ...post,
            isHidden: false,
            hiddenReason: null,
            hiddenAt: null,
            updatedAt: new Date().toISOString(),
        }));
        return;
    }

    const { error } = await getSupabaseClient().rpc('community_moderate_post', {
        p_post_id: id,
        p_hide: false,
    });
    if (error) throw new Error(getErrorMessage(error));
};

export const pinPost = async (id: string, pinned: boolean): Promise<void> => {
    if (!isSupabaseConfigured) {
        mutateLocalPostFlags(id, (post) => ({
            ...post,
            isPinned: pinned,
            updatedAt: new Date().toISOString(),
        }));
        return;
    }

    const { error } = await getSupabaseClient().rpc('community_pin_post', {
        p_post_id: id,
        p_pinned: pinned,
    });
    if (error) throw new Error(getErrorMessage(error));
};
