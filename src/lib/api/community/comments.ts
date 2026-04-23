import { isSupabaseConfigured } from '../../supabase';
import { getSupabaseClient } from '../shared/client';
import { getErrorMessage } from '../shared/errors';
import { localState } from '../shared/localState';
import type { CommunityComment } from '../../../types';
import { mapCommentRow } from './mappers';

const bumpLocalPostCommentCount = (postId: string, delta: number): void => {
    localState.communityPosts = localState.communityPosts.map((post) =>
        post.id === postId
            ? { ...post, commentCount: Math.max(0, post.commentCount + delta) }
            : post,
    );
};

export const listComments = async (postId: string): Promise<CommunityComment[]> => {
    if (!isSupabaseConfigured) {
        return localState.communityComments
            .filter((comment) => comment.postId === postId && !comment.isHidden)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
            .map((comment) => ({ ...comment }));
    }

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
    postId: string;
    body: string;
    authorMemberId: string;
}): Promise<CommunityComment> => {
    const now = new Date().toISOString();
    const body = input.body.trim();

    if (!isSupabaseConfigured) {
        const comment: CommunityComment = {
            id: `comment_local_${Date.now()}`,
            postId: input.postId,
            authorMemberId: input.authorMemberId,
            body,
            isHidden: false,
            hiddenBy: null,
            hiddenAt: null,
            createdAt: now,
            updatedAt: now,
        };
        localState.communityComments = [...localState.communityComments, comment];
        bumpLocalPostCommentCount(input.postId, 1);
        return { ...comment };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('community_comments')
        .insert({
            post_id: input.postId,
            body,
            author_member_id: input.authorMemberId,
        })
        .select('*')
        .single();
    if (error) throw new Error(getErrorMessage(error));
    return mapCommentRow(data);
};

export const updateComment = async (id: string, body: string): Promise<CommunityComment> => {
    const trimmed = body.trim();

    if (!isSupabaseConfigured) {
        const idx = localState.communityComments.findIndex((comment) => comment.id === id);
        if (idx === -1) throw new Error('댓글을 찾지 못했습니다.');
        const current = localState.communityComments[idx];
        const next: CommunityComment = { ...current, body: trimmed, updatedAt: new Date().toISOString() };
        localState.communityComments = [
            ...localState.communityComments.slice(0, idx),
            next,
            ...localState.communityComments.slice(idx + 1),
        ];
        return { ...next };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
        .from('community_comments')
        .update({ body: trimmed })
        .eq('id', id)
        .select('*')
        .single();
    if (error) throw new Error(getErrorMessage(error));
    return mapCommentRow(data);
};

export const hideComment = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        let affectedPostId: string | null = null;
        localState.communityComments = localState.communityComments.map((comment) => {
            if (comment.id !== id) return comment;
            if (!comment.isHidden) affectedPostId = comment.postId;
            return { ...comment, isHidden: true, hiddenAt: new Date().toISOString() };
        });
        if (affectedPostId) bumpLocalPostCommentCount(affectedPostId, -1);
        return;
    }

    const { error } = await getSupabaseClient().rpc('community_moderate_comment', {
        p_comment_id: id,
        p_hide: true,
    });
    if (error) throw new Error(getErrorMessage(error));
};
