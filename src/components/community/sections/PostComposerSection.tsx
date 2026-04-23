import React, { useEffect, useState } from 'react';
import { createPost, updatePost } from '../../../lib/api/community';
import type { CommunityPost } from '../../../types';

interface PostComposerSectionProps {
    authorMemberId: string;
    editingPost?: CommunityPost | null;
    onSuccess: (post: CommunityPost, isEdit: boolean) => void;
    onCancel: () => void;
}

const MAX_TITLE = 200;
const MAX_BODY = 5000;

export const PostComposerSection: React.FC<PostComposerSectionProps> = ({
    authorMemberId,
    editingPost,
    onSuccess,
    onCancel,
}) => {
    const [title, setTitle] = useState(editingPost?.title ?? '');
    const [body, setBody] = useState(editingPost?.body ?? '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setTitle(editingPost?.title ?? '');
        setBody(editingPost?.body ?? '');
        setError(null);
    }, [editingPost]);

    const isEdit = Boolean(editingPost);
    const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !isSaving;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit) return;
        setIsSaving(true);
        setError(null);
        try {
            let saved: CommunityPost;
            if (isEdit && editingPost) {
                saved = await updatePost(editingPost.id, { title: title.trim(), body: body.trim() });
            } else {
                saved = await createPost({ title: title.trim(), body: body.trim(), authorMemberId });
            }
            onSuccess(saved, isEdit);
        } catch (err) {
            setError(err instanceof Error ? err.message : '게시글을 저장하지 못했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
                {isEdit ? '게시글 수정' : '새 글 작성'}
            </h3>

            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">제목</span>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                        maxLength={MAX_TITLE}
                        placeholder="제목을 입력하세요"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-right text-xs text-slate-400">{title.length}/{MAX_TITLE}</p>
                </label>

                <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">내용</span>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
                        maxLength={MAX_BODY}
                        rows={10}
                        placeholder="내용을 입력하세요"
                        className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-right text-xs text-slate-400">{body.length}/{MAX_BODY}</p>
                </label>

                <div className="flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSaving}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSaving ? '저장 중…' : isEdit ? '수정 완료' : '글 등록'}
                    </button>
                </div>
            </form>
        </div>
    );
};
