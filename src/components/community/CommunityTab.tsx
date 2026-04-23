import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import type { CommunityPost } from '../../types';
import { useAuth } from '../auth/auth-context';
import { hidePost, hideComment } from '../../lib/api/community';
import { useCommunityResources } from './hooks/useCommunityResources';
import { PostListSection } from './sections/PostListSection';
import { PostDetailSection } from './sections/PostDetailSection';
import { PostComposerSection } from './sections/PostComposerSection';

type CommunityView = 'list' | 'detail' | 'compose' | 'edit';

export const CommunityTab: React.FC = () => {
    const { profile, permissions } = useAuth();
    const currentMemberId = profile?.memberId ?? null;

    const {
        posts,
        commentsByPost,
        nextCursor,
        isLoading,
        memberNameMap,
        refreshData,
        loadMore,
        loadComments,
        optimisticallyHidePost,
        optimisticallyHideComment,
        appendPost,
        appendComment,
        updatePostInState,
    } = useCommunityResources();

    const [view, setView] = useState<CommunityView>('list');
    const [activePostId, setActivePostId] = useState<string | null>(null);
    const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);

    const activePost = activePostId ? posts.find((p) => p.id === activePostId) ?? null : null;
    const activeComments = activePostId ? (commentsByPost[activePostId] ?? []) : [];

    const handleSelectPost = (id: string) => {
        setActivePostId(id);
        setView('detail');
    };

    const handleBackToList = () => {
        setActivePostId(null);
        setView('list');
    };

    const handleCompose = () => {
        setEditingPost(null);
        setView('compose');
    };

    const handleEdit = (post: CommunityPost) => {
        setEditingPost(post);
        setView('edit');
    };

    const handleComposeSave = (post: CommunityPost, isEdit: boolean) => {
        if (isEdit) {
            updatePostInState(post);
            setEditingPost(null);
            setActivePostId(post.id);
            setView('detail');
        } else {
            appendPost(post);
            setActivePostId(post.id);
            setView('detail');
        }
    };

    const handleComposeCancel = () => {
        if (view === 'edit' && activePostId) {
            setView('detail');
        } else {
            setView('list');
        }
        setEditingPost(null);
    };

    const handleHidePost = async (id: string, reason?: string) => {
        const rollback = optimisticallyHidePost(id);
        try {
            await hidePost(id, reason);
        } catch (err) {
            rollback();
            throw err;
        }
    };

    const handleHideComment = async (postId: string, commentId: string) => {
        const rollback = optimisticallyHideComment(postId, commentId);
        try {
            await hideComment(commentId);
        } catch (err) {
            rollback();
            throw err;
        }
    };

    const handlePostPinToggled = (updatedPost: CommunityPost) => {
        updatePostInState(updatedPost);
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex animate-pulse flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100" />
                    <div className="font-medium text-indigo-600">커뮤니티를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            {/* 헤더 — 목록 뷰에서만 표시 */}
            {view === 'list' && (
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <MessageSquare className="text-indigo-600" />
                            커뮤니티
                        </h2>
                        <p className="mt-1 text-slate-500">멤버들이 자유롭게 이야기를 나누는 공간입니다.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void refreshData()}
                        className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        새로고침
                    </button>
                </header>
            )}

            {/* 목록 뷰 */}
            {view === 'list' && (
                <PostListSection
                    posts={posts}
                    nextCursor={nextCursor}
                    canPost={permissions.canPostToCommunity}
                    memberNameMap={memberNameMap}
                    onSelectPost={handleSelectPost}
                    onCompose={handleCompose}
                    onLoadMore={() => void loadMore()}
                />
            )}

            {/* 상세 뷰 */}
            {view === 'detail' && activePost && (
                <PostDetailSection
                    post={activePost}
                    comments={activeComments}
                    currentMemberId={currentMemberId}
                    canModerate={permissions.canModerateCommunity}
                    canPost={permissions.canPostToCommunity}
                    memberNameMap={memberNameMap}
                    onBack={handleBackToList}
                    onEdit={handleEdit}
                    onHidePost={handleHidePost}
                    onHideComment={handleHideComment}
                    onCommentAdded={appendComment}
                    onLoadComments={loadComments}
                    onPostPinToggled={handlePostPinToggled}
                />
            )}

            {/* 글 작성 뷰 */}
            {view === 'compose' && currentMemberId && (
                <PostComposerSection
                    authorMemberId={currentMemberId}
                    editingPost={null}
                    onSuccess={handleComposeSave}
                    onCancel={handleComposeCancel}
                />
            )}

            {/* 글 수정 뷰 */}
            {view === 'edit' && currentMemberId && (
                <PostComposerSection
                    authorMemberId={currentMemberId}
                    editingPost={editingPost}
                    onSuccess={handleComposeSave}
                    onCancel={handleComposeCancel}
                />
            )}
        </div>
    );
};
