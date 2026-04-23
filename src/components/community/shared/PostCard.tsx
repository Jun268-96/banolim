import React from 'react';
import { MessageCircle, Pin } from 'lucide-react';
import type { CommunityPost } from '../../../types';

interface PostCardProps {
    post: CommunityPost;
    authorName?: string;
    onClick: (id: string) => void;
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

export const PostCard: React.FC<PostCardProps> = ({ post, authorName, onClick }) => {
    const summary = post.body.length > 100 ? `${post.body.slice(0, 100)}…` : post.body;
    const displayName = authorName ?? '(알 수 없음)';

    return (
        <button
            type="button"
            onClick={() => onClick(post.id)}
            className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/30 active:bg-indigo-50/60"
        >
            <div className="flex items-start gap-2">
                {post.isPinned && (
                    <span className="mt-0.5 shrink-0 rounded-lg bg-indigo-100 p-1 text-indigo-600">
                        <Pin size={12} />
                    </span>
                )}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{post.title}</p>
                        {post.isPinned && (
                            <span className="shrink-0 rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                                고정
                            </span>
                        )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500 whitespace-pre-wrap">{summary}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                        <span>{displayName}</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                        <span className="flex items-center gap-1">
                            <MessageCircle size={12} />
                            {post.commentCount}
                        </span>
                    </div>
                </div>
            </div>
        </button>
    );
};
