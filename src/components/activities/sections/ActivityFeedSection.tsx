import React from 'react';
import {
    BadgeCheck,
    CalendarClock,
    CircleSlash,
    Clock3,
    History,
    Link2,
    MessageSquareWarning,
    RotateCcw,
} from 'lucide-react';
import type {
    ActivityLog,
    AuditLogEntry,
    CorrectionRequest,
    CorrectionRequestStatus,
} from '../../../types';

const correctionRequestStatusLabels: Record<CorrectionRequestStatus, string> = {
    pending: '접수됨',
    reviewing: '검토 중',
    resolved: '해결 완료',
    rejected: '반려',
};

const correctionRequestStatusClasses: Record<CorrectionRequestStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    reviewing: 'border-sky-200 bg-sky-50 text-sky-700',
    resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
};

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

const getActivityStateInfo = (log: ActivityLog) => {
    if (log.isReversal) {
        return {
            label: '취소 로그',
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
    }

    if (log.recordStatus === 'reversed') {
        return {
            label: '취소됨',
            className: 'border-slate-200 bg-slate-100 text-slate-700',
        };
    }

    return {
        label: '정상',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
};

const getAuditDelta = (auditLog: AuditLogEntry) =>
    typeof auditLog.diff?.delta === 'number' ? auditLog.diff.delta : null;

interface ActivityFeedSectionProps {
    logs: ActivityLog[];
    reversingRecordId: string | null;
    onReverseLog: (log: ActivityLog) => void | Promise<void>;
    correctionRequests: CorrectionRequest[];
    correctionRequestCounts: Record<CorrectionRequestStatus, number>;
    updatingCorrectionRequestId: string | null;
    reviewNotes: Record<string, string>;
    onReviewNoteChange: (requestId: string, value: string) => void;
    onUpdateCorrectionRequestStatus: (
        request: CorrectionRequest,
        status: CorrectionRequestStatus,
    ) => void | Promise<void>;
    auditLogs: AuditLogEntry[];
}

export const ActivityFeedSection: React.FC<ActivityFeedSectionProps> = ({
    logs,
    reversingRecordId,
    onReverseLog,
    correctionRequests,
    correctionRequestCounts,
    updatingCorrectionRequestId,
    reviewNotes,
    onReviewNoteChange,
    onUpdateCorrectionRequestStatus,
    auditLogs,
}) => (
    <section className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">
                <CalendarClock size={18} className="text-indigo-600" />
                최근 활동 피드
            </div>
            <div className="divide-y divide-slate-100">
                {logs.map((log) => {
                    const activityState = getActivityStateInfo(log);
                    const canReverse = Boolean(log.recordId) && !log.isReversal && log.recordStatus !== 'reversed';
                    const isReversing = reversingRecordId === log.recordId;

                    return (
                        <article
                            key={log.id}
                            className="grid gap-4 px-6 py-5 transition-colors hover:bg-slate-50/60 lg:grid-cols-[170px_minmax(0,1fr)_auto]"
                        >
                            <div className="text-sm text-slate-500">
                                <div className="font-medium text-slate-700">기록 시각</div>
                                <div className="mt-1 leading-6">{formatDateTime(log.timestamp)}</div>
                            </div>

                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-base font-semibold text-slate-950">
                                        {log.memberName ?? log.memberId}
                                    </h4>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-sm font-medium text-slate-700">
                                        {log.categoryName ?? log.categoryId}
                                    </span>
                                    <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                            log.pointDelta >= 0
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : 'border-rose-200 bg-rose-50 text-rose-700'
                                        }`}
                                    >
                                        {log.pointDelta > 0 ? '+' : ''}
                                        {log.pointDelta}점
                                    </span>
                                    <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${activityState.className}`}
                                    >
                                        {activityState.label}
                                    </span>
                                </div>

                                {log.reason ? (
                                    <p className="mt-2 text-sm leading-6 text-slate-600">{log.reason}</p>
                                ) : null}

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    {log.note ? (
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                                            메모 · {log.note}
                                        </span>
                                    ) : (
                                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-400">
                                            메모 없음
                                        </span>
                                    )}

                                    {log.evidenceUrl ? (
                                        <a
                                            href={log.evidenceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-sky-700 transition-colors hover:bg-sky-100"
                                        >
                                            <Link2 size={12} />
                                            증빙 링크
                                        </a>
                                    ) : (
                                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-400">
                                            증빙 없음
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-start lg:justify-end">
                                {canReverse ? (
                                    <button
                                        type="button"
                                        onClick={() => void onReverseLog(log)}
                                        disabled={isReversing}
                                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                    >
                                        <RotateCcw size={14} />
                                        {isReversing ? '취소 중...' : '기록 취소'}
                                    </button>
                                ) : (
                                    <span className="inline-flex rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400">
                                        관리 없음
                                    </span>
                                )}
                            </div>
                        </article>
                    );
                })}

                {logs.length === 0 && (
                    <div className="py-12 text-center text-slate-500">
                        아직 활동 기록이 없습니다.
                    </div>
                )}
            </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <MessageSquareWarning size={18} className="text-indigo-600" />
                    정정 요청 검토
                </div>
                <div className="flex flex-wrap gap-2">
                    {(['pending', 'reviewing', 'resolved', 'rejected'] as CorrectionRequestStatus[]).map((status) => (
                        <span key={status} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${correctionRequestStatusClasses[status]}`}>
                            {correctionRequestStatusLabels[status]} {correctionRequestCounts[status]}건
                        </span>
                    ))}
                </div>
            </div>
            <div className="divide-y divide-slate-100">
                {correctionRequests.slice(0, 8).map((request) => {
                    const isUpdating = updatingCorrectionRequestId === request.id;
                    const canReview = request.status === 'pending' || request.status === 'reviewing';

                    return (
                        <div key={request.id} className="space-y-4 px-6 py-5">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-medium text-slate-900">{request.requesterName ?? '알 수 없는 회원'}</div>
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[request.status]}`}>
                                            {correctionRequestStatusLabels[request.status]}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-sm text-slate-500">
                                        {request.activitySummary ?? '활동 기록'}
                                        {request.activityOccurredAt ? (
                                            <>
                                                <span className="text-slate-300"> · </span>
                                                {formatDateTime(request.activityOccurredAt)}
                                            </>
                                        ) : null}
                                        {typeof request.activityPointDelta === 'number' ? (
                                            <>
                                                <span className="text-slate-300"> · </span>
                                                {request.activityPointDelta > 0 ? '+' : ''}
                                                {request.activityPointDelta}점
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="text-sm text-slate-500">{formatDateTime(request.createdAt)}</div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                                {request.reason}
                            </div>

                            <textarea
                                value={reviewNotes[request.id] ?? request.reviewNote ?? ''}
                                onChange={(event) => onReviewNoteChange(request.id, event.target.value)}
                                rows={3}
                                placeholder="운영진 메모 또는 처리 결과를 남겨 주세요."
                                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />

                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="text-sm text-slate-500">
                                    {request.reviewedAt
                                        ? `${request.reviewedByName ?? '운영진'} · ${formatDateTime(request.reviewedAt)}`
                                        : '아직 검토 전입니다.'}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {canReview && (
                                        <button
                                            type="button"
                                            onClick={() => void onUpdateCorrectionRequestStatus(request, 'reviewing')}
                                            disabled={isUpdating}
                                            className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
                                        >
                                            <Clock3 size={15} />
                                            검토 시작
                                        </button>
                                    )}
                                    {canReview && (
                                        <button
                                            type="button"
                                            onClick={() => void onUpdateCorrectionRequestStatus(request, 'resolved')}
                                            disabled={isUpdating}
                                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                                        >
                                            <BadgeCheck size={15} />
                                            해결 완료
                                        </button>
                                    )}
                                    {canReview && (
                                        <button
                                            type="button"
                                            onClick={() => void onUpdateCorrectionRequestStatus(request, 'rejected')}
                                            disabled={isUpdating}
                                            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                                        >
                                            <CircleSlash size={15} />
                                            반려
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {correctionRequests.length === 0 && (
                    <div className="px-6 py-12 text-center text-slate-500">
                        아직 접수된 정정 요청이 없습니다.
                    </div>
                )}
            </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-4 font-semibold text-slate-900">
                <History size={18} className="text-indigo-600" />
                최근 운영 이력
            </div>
            <div className="divide-y divide-slate-100">
                {auditLogs.slice(0, 8).map((auditLog) => {
                    const delta = getAuditDelta(auditLog);

                    return (
                        <div key={auditLog.id} className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
                            <div>
                                <div className="font-medium text-slate-900">{auditLog.summary}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {auditLog.actorName ?? '시스템'}
                                    <span className="text-slate-300"> · </span>
                                    {formatDateTime(auditLog.createdAt)}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                    {auditLog.action === 'created' ? '생성' : auditLog.action === 'reversed' ? '취소' : auditLog.action}
                                </span>
                                {delta !== null && (
                                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                        delta >= 0
                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                            : 'border-rose-200 bg-rose-50 text-rose-700'
                                    }`}>
                                        {delta > 0 ? '+' : ''}
                                        {delta}점
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}

                {auditLogs.length === 0 && (
                    <div className="px-6 py-12 text-center text-slate-500">
                        아직 운영 이력이 없습니다.
                    </div>
                )}
            </div>
        </div>
    </section>
);
