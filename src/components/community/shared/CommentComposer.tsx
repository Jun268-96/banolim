import React, { useState } from 'react';
import { Send } from 'lucide-react';

interface CommentComposerProps {
    onSubmit: (body: string) => Promise<void>;
}

const MAX_BODY = 1000;

export const CommentComposer: React.FC<CommentComposerProps> = ({ onSubmit }) => {
    const [body, setBody] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed || isSubmitting) return;
        setIsSubmitting(true);
        setError(null);
        try {
            await onSubmit(trimmed);
            setBody('');
        } catch (err) {
            setError(err instanceof Error ? err.message : '댓글을 등록하지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2">
            {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                    {error}
                </div>
            )}
            <div className="relative">
                <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
                    placeholder="댓글을 입력하세요…"
                    rows={3}
                    maxLength={MAX_BODY}
                    className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 pr-12 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                    {body.length}/{MAX_BODY}
                </span>
                <button
                    type="submit"
                    disabled={!body.trim() || isSubmitting}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Send size={14} />
                    {isSubmitting ? '등록 중…' : '댓글 등록'}
                </button>
            </div>
        </form>
    );
};
