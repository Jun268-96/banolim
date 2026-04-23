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
