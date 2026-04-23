import React, { useState } from 'react';
import { AppDialog } from '../../shared/AppDialog';

interface PostModerateDialogProps {
    isOpen: boolean;
    postTitle: string;
    onClose: () => void;
    onConfirm: (reason: string) => Promise<void>;
}

export const PostModerateDialog: React.FC<PostModerateDialogProps> = ({
    isOpen,
    postTitle,
    onClose,
    onConfirm,
}) => {
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClose = () => {
        if (isSubmitting) return;
        setReason('');
        setError(null);
        onClose();
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            await onConfirm(reason.trim());
            setReason('');
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : '게시글을 숨기지 못했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AppDialog
            isOpen={isOpen}
            title="게시글 숨김"
            description={`"${postTitle}" 게시글을 숨깁니다.`}
            size="md"
            onClose={handleClose}
        >
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
                {error && (
                    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}
                <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                        숨김 이유 <span className="text-slate-400 font-normal">(선택)</span>
                    </span>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value.slice(0, 200))}
                        placeholder="숨김 처리 이유를 입력하세요…"
                        rows={3}
                        maxLength={200}
                        className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="text-right text-xs text-slate-400">{reason.length}/200</p>
                </label>
                <div className="flex flex-wrap justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                        {isSubmitting ? '숨기는 중…' : '숨기기'}
                    </button>
                </div>
            </form>
        </AppDialog>
    );
};
