import React, { useState } from 'react';
import { MoreHorizontal, Pencil, EyeOff } from 'lucide-react';
import type { CommunityComment } from '../../../types';

interface CommentItemProps {
    comment: CommunityComment;
    currentMemberId: string | null | undefined;
    canModerate: boolean;
    authorName?: string;
    onHide: (commentId: string) => Promise<void>;
    onEdit: (comment: CommunityComment) => void;
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

export const CommentItem: React.FC<CommentItemProps> = ({
    comment,
    currentMemberId,
    canModerate,
    authorName,
    onHide,
    onEdit,
}) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isHiding, setIsHiding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isOwner = currentMemberId === comment.authorMemberId;
    const showMenu = isOwner || canModerate;

    const handleHide = async () => {
        setMenuOpen(false);
        setIsHiding(true);
        setError(null);
        try {
            await onHide(comment.id);
        } catch (err) {
            setError(err instanceof Error ? err.message : '댓글을 숨기지 못했습니다.');
        } finally {
            setIsHiding(false);
        }
    };

    if (comment.isHidden && !canModerate) return null;

    const displayName = authorName ?? comment.authorMemberId.slice(0, 4);

    return (
        <div className="relative flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                {displayName.slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">{displayName}</span>
                    {comment.isHidden && canModerate && (
                        <span className="rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                            숨김
                        </span>
                    )}
                    <span className="text-xs text-slate-400">{formatRelativeTime(comment.createdAt)}</span>
                    {comment.updatedAt !== comment.createdAt && (
                        <span className="text-xs text-slate-400">(수정됨)</span>
                    )}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">{comment.body}</p>
                {error && (
                    <p className="text-xs text-red-600">{error}</p>
                )}
            </div>
            {showMenu && !isHiding && (
                <div className="relative shrink-0">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                        aria-label="댓글 메뉴"
                    >
                        <MoreHorizontal size={14} />
                    </button>
                    {menuOpen && (
                        <>
                            <button
                                type="button"
                                aria-label="메뉴 닫기"
                                className="fixed inset-0 z-10 cursor-default"
                                onClick={() => setMenuOpen(false)}
                            />
                            <div className="absolute right-0 top-8 z-20 min-w-[120px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                                {isOwner && (
                                    <button
                                        type="button"
                                        onClick={() => { setMenuOpen(false); onEdit(comment); }}
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        <Pencil size={13} />
                                        수정
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void handleHide()}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
                                >
                                    <EyeOff size={13} />
                                    숨김
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
            {isHiding && (
                <div className="shrink-0 text-xs text-slate-400">숨기는 중…</div>
            )}
        </div>
    );
};
