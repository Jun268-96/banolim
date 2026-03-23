import React from 'react';
import { Activity, Link2, MessageSquareWarning, Send } from 'lucide-react';
import type { ActivityLog, CorrectionRequest, CorrectionRequestStatus } from '../../../types';

type TimelineRange = '30d' | '90d' | 'all';

interface TimelineGroup {
  monthKey: string;
  monthLabel: string;
  items: ActivityLog[];
}

interface MemberActivitySectionProps {
  timelineRange: TimelineRange;
  timelineRangeOptions: Array<{ id: TimelineRange; label: string }>;
  timelineGroups: TimelineGroup[];
  timelineLogsCount: number;
  correctionRequests: CorrectionRequest[];
  openCorrectionRequestsByRecordId: Record<string, CorrectionRequest>;
  correctionRequestStatusLabels: Record<CorrectionRequestStatus, string>;
  correctionRequestStatusClasses: Record<CorrectionRequestStatus, string>;
  selectedRequestLog: ActivityLog | null;
  requestReason: string;
  requestError: string | null;
  isSubmittingRequest: boolean;
  onChangeTimelineRange: (range: TimelineRange) => void;
  onSelectRequestLog: (log: ActivityLog) => void;
  onChangeRequestReason: (value: string) => void;
  onSubmitCorrectionRequest: (event: React.FormEvent<HTMLFormElement>) => void;
  onCloseRequestForm: () => void;
  formatDayLabel: (value: string) => string;
  formatDateTime: (value?: string | null) => string;
}

export const MemberActivitySection: React.FC<MemberActivitySectionProps> = ({
  timelineRange,
  timelineRangeOptions,
  timelineGroups,
  timelineLogsCount,
  correctionRequests,
  openCorrectionRequestsByRecordId,
  correctionRequestStatusLabels,
  correctionRequestStatusClasses,
  selectedRequestLog,
  requestReason,
  requestError,
  isSubmittingRequest,
  onChangeTimelineRange,
  onSelectRequestLog,
  onChangeRequestReason,
  onSubmitCorrectionRequest,
  onCloseRequestForm,
  formatDayLabel,
  formatDateTime,
}) => (
  <div className="space-y-6">
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Activity size={18} className="text-indigo-600" />
              개인 활동 타임라인
            </div>
            <div className="mt-1 text-sm text-slate-500">저장된 활동을 시간순으로 묶어 보고, 바로 정정 요청까지 이어집니다.</div>
          </div>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            {timelineRangeOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onChangeTimelineRange(option.id)}
                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                  timelineRange === option.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8 px-6 py-6">
        {timelineGroups.map((group) => (
          <div key={group.monthKey} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="text-sm font-semibold text-slate-900">{group.monthLabel}</div>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-3">
              {group.items.map((log) => {
                const openRequest = openCorrectionRequestsByRecordId[log.recordId ?? ''];

                return (
                  <div
                    key={log.id}
                    className="rounded-[24px] border border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                            {formatDayLabel(log.timestamp)}
                          </span>
                          {log.evidenceUrl && (
                            <a
                              href={log.evidenceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                            >
                              <Link2 size={13} />
                              증빙 링크
                            </a>
                          )}
                        </div>

                        <div>
                          <div className="font-semibold text-slate-950">{log.categoryName ?? '알 수 없는 규칙'}</div>
                          <div className="mt-1 text-sm leading-6 text-slate-600">
                            {log.reason ?? '기록 사유 없음'}
                            {log.note ? <span className="text-slate-300"> · {log.note}</span> : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${log.pointDelta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                          {log.pointDelta > 0 ? '+' : ''}
                          {log.pointDelta}점
                        </span>
                        <div className="text-sm text-slate-500">{formatDateTime(log.timestamp)}</div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="text-sm text-slate-600">
                        {openRequest ? '이미 정정 요청이 접수되어 운영진이 확인 중입니다.' : '기록이 다르면 바로 정정 요청을 보낼 수 있습니다.'}
                      </div>
                      {openRequest ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[openRequest.status]}`}>
                          {correctionRequestStatusLabels[openRequest.status]}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelectRequestLog(log)}
                          disabled={!log.recordId}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                        >
                          <MessageSquareWarning size={16} />
                          정정 요청
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {timelineLogsCount === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
            <div className="text-base font-semibold text-slate-900">아직 타임라인에 표시할 활동이 없습니다.</div>
            <div className="mt-2 text-sm text-slate-500">기록이 저장되면 이곳에 월별 흐름과 정정 요청 버튼이 함께 표시됩니다.</div>
          </div>
        )}
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <MessageSquareWarning size={18} className="text-indigo-600" />
        정정 요청
      </div>
      <div className="mt-5 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-medium text-slate-700">최근 요청 내역</div>
          <div className="mt-3 space-y-3">
            {correctionRequests.slice(0, 4).map((request) => (
              <div key={request.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">{request.activitySummary ?? '활동 기록'}</div>
                    <div className="mt-1 text-sm text-slate-500">{formatDateTime(request.createdAt)}</div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[request.status]}`}>
                    {correctionRequestStatusLabels[request.status]}
                  </span>
                </div>
                <div className="mt-3 text-sm leading-6 text-slate-600">{request.reason}</div>
                {request.reviewNote && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    운영진 답변: {request.reviewNote}
                  </div>
                )}
              </div>
            ))}

            {correctionRequests.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                아직 제출한 정정 요청이 없습니다.
              </div>
            )}
          </div>
        </div>

        {selectedRequestLog && (
          <form onSubmit={onSubmitCorrectionRequest} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Send size={16} className="text-indigo-600" />
              {selectedRequestLog.categoryName ?? '활동 기록'} 정정 요청 작성
            </div>
            <div className="mt-2 text-sm text-slate-600">
              {formatDateTime(selectedRequestLog.timestamp)} 기록에 대해 운영진에게 검토를 요청합니다.
            </div>
            <textarea
              value={requestReason}
              onChange={(event) => onChangeRequestReason(event.target.value)}
              rows={4}
              placeholder="어떤 부분이 잘못되었는지 구체적으로 남겨 주세요."
              className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            {requestError && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {requestError}
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!requestReason.trim() || isSubmittingRequest}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmittingRequest ? '제출 중...' : '정정 요청 제출'}
              </button>
              <button
                type="button"
                onClick={onCloseRequestForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  </div>
);
