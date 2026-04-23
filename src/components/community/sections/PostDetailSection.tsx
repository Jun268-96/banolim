import React, { useEffect, useState } from 'react';
import { ArrowLeft, Pencil, EyeOff, Pin, PinOff } from 'lucide-react';
import type { CommunityPost, CommunityComment } from '../../../types';
import { createComment, pinPost, updateComment } from '../../../lib/api/community';
import { CommentItem } from '../shared/CommentItem';
import { CommentComposer } from '../shared/CommentComposer';
import { PostModerateDialog } from '../dialogs/PostModerateDialog';

interface PostDetailSectionProps {
    post: CommunityPost;
    comments: CommunityComment[];
    currentMemberId: string | null | undefined;
    canModerate: boolean;
    canPost: boolean;
    memberNameMap: Record<string, string>;
    onBack: () => void;
    onEdit: (post: CommunityPost) => void;
    onHidePost: (id: string, reason?: string) => Promise<void>;
    onHideComment: (postId: string, commentId: string) => Promise<void>;
    onCommentAdded: (comment: CommunityComment) => void;
    onLoadComments: (postId: string) => Promise<void>;
    onPostPinToggled: (post: CommunityPost) => void;
}

const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}일 전`;
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(iso));
};

export const PostDetailSection: React.FC<PostDetailSectionProps> = ({
    post,
    comments,
    currentMemberId,
    canModerate,
    canPost,
    memberNameMap,
    onBack,
    onEdit,
    onHidePost,
    onHideComment,
    onCommentAdded,
    onLoadComments,
    onPostPinToggled,
}) => {
    const [moderateOpen, setModerateOpen] = useState(false);
    const [pinning, setPinning] = useState(false);
    const [pinError, setPinError] = useState<string | null>(null);
    const [editingComment, setEditingComment] = useState<CommunityComment | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const isOwner = currentMemberId === post.authorMemberId;

    useEffect(() => {
        void onLoadComments(post.id);
    }, [post.id, onLoadComments]);

    const handleSubmitComment = async (body: string) => {
        if (!currentMemberId) return;
        const comment = await createComment({
            postId: post.id,
            body,
            authorMemberId: currentMemberId,
        });
        onCommentAdded(comment);
    };

    const handleHideComment = async (commentId: string) => {
        await onHideComment(post.id, commentId);
    };

    const handleModerateConfirm = async (reason: string) => {
        await onHidePost(post.id, reason);
        setModerateOpen(false);
        onBack();
    };

    const handlePinToggle = async () => {
        setPinning(true);
        setPinError(null);
        try {
            await pinPost(post.id, !post.isPinned);
            onPostPinToggled({ ...post, isPinned: !post.isPinned });
        } catch (err) {
            setPinError(err instanceof Error ? err.message : '고정 상태를 변경하지 못했습니다.');
        } finally {
            setPinning(false);
        }
    };

    const handleStartEditComment = (comment: CommunityComment) => {
        setEditingComment(comment);
        setEditingCommentBody(comment.body);
        setEditError(null);
    };

    const handleSaveCommentEdit = async () => {
        if (!editingComment) return;
        setIsSavingEdit(true);
        setEditError(null);
        try {
            await updateComment(editingComment.id, editingCommentBody.trim());
            await onLoadComments(post.id);
            setEditingComment(null);
        } catch (err) {
            setEditError(err instanceof Error ? err.message : '댓글을 수정하지 못했습니다.');
        } finally {
            setIsSavingEdit(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* 헤더 */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                    aria-label="목록으로"
                >
                    <ArrowLeft size={16} />
                </button>
                <h3 className="flex-1 truncate text-lg font-bold text-slate-900">게시글</h3>
                <div className="flex gap-2">
                    {canModerate && (
                        <button
                            type="button"
                            onClick={() => void handlePinToggle()}
                            disabled={pinning}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                            aria-label={post.isPinned ? '고정 해제' : '고정'}
                        >
                            {post.isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                            {post.isPinned ? '고정 해제' : '고정'}
                        </button>
                    )}
                    {(isOwner || canModerate) && !post.isHidden && (
                        <button
                            type="button"
                            onClick={() => setModerateOpen(true)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-200 px-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                            <EyeOff size={14} />
                            숨김
                        </button>
                    )}
                    {isOwner && !post.isHidden && (
                        <button
                            type="button"
                            onClick={() => onEdit(post)}
                            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <Pencil size={14} />
                            수정
                        </button>
                    )}
                </div>
            </div>

            {pinError && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {pinError}
                </div>
            )}

            {/* 본문 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        {post.isPinned && (
                            <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                                고정
                            </span>
                        )}
                        {post.isHidden && canModerate && (
                            <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                                숨김
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">{post.title}</h2>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{memberNameMap[post.authorMemberId] ?? post.authorMemberId.slice(0, 4)}</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                        {post.updatedAt !== post.createdAt && <span>(수정됨)</span>}
                    </div>
                </div>
                <hr className="border-slate-100" />
                <p className="text-sm text-slate-800 leading-7 whitespace-pre-wrap">{post.body}</p>
            </div>

            {/* 댓글 목록 */}
            <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-700">
                    댓글 {post.commentCount > 0 ? `${post.commentCount}개` : ''}
                </h4>

                {comments.length === 0 ? (
                    <p className="text-sm text-slate-400">아직 댓글이 없습니다.</p>
                ) : (
                    <div className="space-y-4">
                        {comments.map((comment) =>
                            editingComment?.id === comment.id ? (
                                <div key={comment.id} className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4">
                                    {editError && (
                                        <p className="text-xs text-red-600">{editError}</p>
                                    )}
                                    <textarea
                                        value={editingCommentBody}
                                        onChange={(e) => setEditingCommentBody(e.target.value.slice(0, 1000))}
                                        rows={3}
                                        maxLength={1000}
                                        className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-slate-400">{editingCommentBody.length}/1000</span>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setEditingComment(null)}
                                                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                            >
                                                취소
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleSaveCommentEdit()}
                                                disabled={!editingCommentBody.trim() || isSavingEdit}
                                                className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {isSavingEdit ? '저장 중…' : '저장'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <CommentItem
                                    key={comment.id}
                                    comment={comment}
                                    currentMemberId={currentMemberId}
                                    canModerate={canModerate}
                                    authorName={memberNameMap[comment.authorMemberId]}
                                    onHide={handleHideComment}
                                    onEdit={handleStartEditComment}
                                />
                            ),
                        )}
                    </div>
                )}

                {/* 댓글 작성 */}
                {canPost && !post.isHidden && (
                    <div className="pt-2 border-t border-slate-100">
                        <CommentComposer onSubmit={handleSubmitComment} />
                    </div>
                )}
            </div>

            <PostModerateDialog
                isOpen={moderateOpen}
                postTitle={post.title}
                onClose={() => setModerateOpen(false)}
                onConfirm={handleModerateConfirm}
            />
        </div>
    );
};
