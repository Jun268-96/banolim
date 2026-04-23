import React from 'react';
import { PlusCircle, RefreshCw } from 'lucide-react';
import type { CommunityPost } from '../../../types';
import { PostCard } from '../shared/PostCard';

interface PostListSectionProps {
    posts: CommunityPost[];
    nextCursor: { createdAt: string } | null;
    canPost: boolean;
    memberNameMap: Record<string, string>;
    onSelectPost: (id: string) => void;
    onCompose: () => void;
    onLoadMore: () => void;
}

export const PostListSection: React.FC<PostListSectionProps> = ({
    posts,
    nextCursor,
    canPost,
    memberNameMap,
    onSelectPost,
    onCompose,
    onLoadMore,
}) => {
    const pinnedPosts = posts.filter((p) => p.isPinned);
    const normalPosts = posts.filter((p) => !p.isPinned);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">커뮤니티</h3>
                {canPost && (
                    <button
                        type="button"
                        onClick={onCompose}
                        className="inline-flex h-10 items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                    >
                        <PlusCircle size={15} />
                        글 작성
                    </button>
                )}
            </div>

            {posts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
                    <p className="text-slate-500">아직 게시글이 없습니다.</p>
                    {canPost && (
                        <p className="mt-1 text-sm text-slate-400">첫 글을 작성해 보세요</p>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {pinnedPosts.length > 0 && (
                        <>
                            {pinnedPosts.map((post) => (
                                <PostCard key={post.id} post={post} authorName={memberNameMap[post.authorMemberId]} onClick={onSelectPost} />
                            ))}
                            {normalPosts.length > 0 && (
                                <div className="my-1 border-t border-slate-100" />
                            )}
                        </>
                    )}
                    {normalPosts.map((post) => (
                        <PostCard key={post.id} post={post} authorName={memberNameMap[post.authorMemberId]} onClick={onSelectPost} />
                    ))}
                </div>
            )}

            {nextCursor && (
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        onClick={onLoadMore}
                        className="inline-flex h-10 items-center gap-1.5 rounded-2xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <RefreshCw size={14} />
                        더 보기
                    </button>
                </div>
            )}
        </div>
    );
};
