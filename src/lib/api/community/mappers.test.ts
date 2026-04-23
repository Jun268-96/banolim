import { describe, expect, it } from 'vitest';
import { mapPostRow, mapCommentRow } from './mappers';
import type { Database } from '../../../types/database';

type PostRow = Database['public']['Tables']['community_posts']['Row'];
type CommentRow = Database['public']['Tables']['community_comments']['Row'];

const basePostRow: PostRow = {
    id: 'post-1',
    author_member_id: 'member-1',
    title: '테스트 제목',
    body: '테스트 본문',
    is_pinned: false,
    is_hidden: false,
    hidden_by: null,
    hidden_reason: null,
    hidden_at: null,
    comment_count: 0,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
};

const baseCommentRow: CommentRow = {
    id: 'comment-1',
    post_id: 'post-1',
    author_member_id: 'member-1',
    body: '테스트 댓글',
    is_hidden: false,
    hidden_by: null,
    hidden_at: null,
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
};

describe('mapPostRow', () => {
    it('maps snake_case fields to camelCase', () => {
        const result = mapPostRow(basePostRow);
        expect(result).toEqual({
            id: 'post-1',
            authorMemberId: 'member-1',
            title: '테스트 제목',
            body: '테스트 본문',
            isPinned: false,
            isHidden: false,
            hiddenBy: null,
            hiddenReason: null,
            hiddenAt: null,
            commentCount: 0,
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
        });
    });

    it('preserves null for hidden_by, hidden_reason, hidden_at when not hidden', () => {
        const result = mapPostRow(basePostRow);
        expect(result.hiddenBy).toBeNull();
        expect(result.hiddenReason).toBeNull();
        expect(result.hiddenAt).toBeNull();
    });

    it('maps hidden post fields correctly', () => {
        const hiddenRow: PostRow = {
            ...basePostRow,
            is_hidden: true,
            hidden_by: 'member-99',
            hidden_reason: '부적절한 게시글',
            hidden_at: '2026-04-10T12:00:00Z',
        };
        const result = mapPostRow(hiddenRow);
        expect(result.isHidden).toBe(true);
        expect(result.hiddenBy).toBe('member-99');
        expect(result.hiddenReason).toBe('부적절한 게시글');
        expect(result.hiddenAt).toBe('2026-04-10T12:00:00Z');
    });

    it('maps pinned and comment count correctly', () => {
        const pinnedRow: PostRow = {
            ...basePostRow,
            is_pinned: true,
            comment_count: 42,
        };
        const result = mapPostRow(pinnedRow);
        expect(result.isPinned).toBe(true);
        expect(result.commentCount).toBe(42);
    });
});

describe('mapCommentRow', () => {
    it('maps snake_case comment fields to camelCase', () => {
        const result = mapCommentRow(baseCommentRow);
        expect(result).toEqual({
            id: 'comment-1',
            postId: 'post-1',
            authorMemberId: 'member-1',
            body: '테스트 댓글',
            isHidden: false,
            hiddenBy: null,
            hiddenAt: null,
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
        });
    });

    it('preserves null for hidden_by and hidden_at when not hidden', () => {
        const result = mapCommentRow(baseCommentRow);
        expect(result.hiddenBy).toBeNull();
        expect(result.hiddenAt).toBeNull();
    });

    it('maps hidden comment fields correctly', () => {
        const hiddenComment: CommentRow = {
            ...baseCommentRow,
            is_hidden: true,
            hidden_by: 'operator-1',
            hidden_at: '2026-04-15T09:00:00Z',
        };
        const result = mapCommentRow(hiddenComment);
        expect(result.isHidden).toBe(true);
        expect(result.hiddenBy).toBe('operator-1');
        expect(result.hiddenAt).toBe('2026-04-15T09:00:00Z');
    });

    it('maps postId from post_id correctly', () => {
        const commentWithPost: CommentRow = {
            ...baseCommentRow,
            post_id: 'post-xyz',
        };
        const result = mapCommentRow(commentWithPost);
        expect(result.postId).toBe('post-xyz');
    });
});
