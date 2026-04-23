import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Shield, TriangleAlert } from 'lucide-react';
import type { Member } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';
import { SCORE_ADJUSTMENT_LIMITS } from '../../../lib/api/admin/scores';

interface MemberScoreAdjustDialogProps {
    isOpen: boolean;
    targets: Member[];
    onClose: () => void;
    onSubmit: (delta: number, reason: string) => Promise<void>;
}

const QUICK_DELTAS = [-10, -5, -1, 1, 5, 10];

export const MemberScoreAdjustDialog: React.FC<MemberScoreAdjustDialogProps> = ({
    isOpen,
    targets,
    onClose,
    onSubmit,
}) => {
    const [deltaInput, setDeltaInput] = useState<string>('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setDeltaInput('');
            setReason('');
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen]);

    const isBulk = targets.length > 1;
    const parsedDelta = useMemo(() => {
        const trimmed = deltaInput.trim();
        if (!trimmed) return null;
        const value = Number(trimmed);
        if (!Number.isFinite(value) || !Number.isInteger(value)) return null;
        return value;
    }, [deltaInput]);

    const deltaValid =
        parsedDelta !== null &&
        parsedDelta !== 0 &&
        parsedDelta >= SCORE_ADJUSTMENT_LIMITS.minDelta &&
        parsedDelta <= SCORE_ADJUSTMENT_LIMITS.maxDelta;
    const reasonValid = reason.trim().length >= SCORE_ADJUSTMENT_LIMITS.minReasonLength;
    const canSubmit = deltaValid && reasonValid && !isSubmitting && targets.length > 0;

    const handleQuickDelta = (value: number) => {
        setDeltaInput(String(value));
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canSubmit || parsedDelta === null) {
            return;
        }
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            await onSubmit(parsedDelta, reason.trim());
            onClose();
        } catch (error) {
            const message = error instanceof Error ? error.message : '점수 조정 중 오류가 발생했습니다.';
            setErrorMessage(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const title = isBulk ? `선택한 ${targets.length}명 점수 조정` : '점수 조정';
    const description = isBulk
        ? '선택한 멤버 모두에게 동일한 점수가 적용되며, 각 조정은 감사 로그에 기록됩니다.'
        : '단일 멤버의 점수를 즉시 조정합니다. 조정 내역은 감사 로그에 기록됩니다.';

    return (
        <AppDialog isOpen={isOpen} onClose={onClose} title={title} description={description} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <Shield size={14} /> 대상 멤버 ({targets.length}명)
                    </div>
                    <div className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                        {targets.map((member) => (
                            <span
                                key={member.id}
                                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700"
                            >
                                <span className="font-medium">{member.name}</span>
                                <span className="text-slate-400">· {member.score}점</span>
                            </span>
                        ))}
                    </div>
                </section>

                <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        점수 변화량 (delta)
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {QUICK_DELTAS.map((value) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => handleQuickDelta(value)}
                                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                    parsedDelta === value
                                        ? value > 0
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                                            : 'border-rose-300 bg-rose-50 text-rose-700'
                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {value > 0 ? <Plus size={12} /> : <Minus size={12} />}
                                {Math.abs(value)}
                            </button>
                        ))}
                    </div>
                    <input
                        type="number"
                        inputMode="numeric"
                        step={1}
                        min={SCORE_ADJUSTMENT_LIMITS.minDelta}
                        max={SCORE_ADJUSTMENT_LIMITS.maxDelta}
                        value={deltaInput}
                        onChange={(event) => setDeltaInput(event.target.value)}
                        placeholder={`예: 10 또는 -5 (범위 ${SCORE_ADJUSTMENT_LIMITS.minDelta} ~ ${SCORE_ADJUSTMENT_LIMITS.maxDelta})`}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    {deltaInput && !deltaValid && (
                        <p className="mt-1.5 text-xs text-rose-600">
                            {SCORE_ADJUSTMENT_LIMITS.minDelta} ~ +{SCORE_ADJUSTMENT_LIMITS.maxDelta} 사이의 0이 아닌 정수를 입력하세요.
                        </p>
                    )}
                </div>

                <div>
                    <label htmlFor="score-adjust-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
                        사유 <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                        id="score-adjust-reason"
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={3}
                        placeholder="예: 4월 월간 보너스, 지각 누적 감점 등"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                    <p className="mt-1.5 text-xs text-slate-500">
                        감사 로그에 기록되는 내용입니다. 최소 {SCORE_ADJUSTMENT_LIMITS.minReasonLength}자 이상.
                    </p>
                </div>

                {errorMessage && (
                    <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isSubmitting
                            ? '적용 중...'
                            : parsedDelta !== null && deltaValid
                                ? `${parsedDelta > 0 ? '+' : ''}${parsedDelta}점 적용`
                                : '적용'}
                    </button>
                </div>
            </form>
        </AppDialog>
    );
};
