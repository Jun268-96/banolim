import React from 'react';
import { ChevronDown, ChevronUp, History } from 'lucide-react';
import type { AuditLogEntry, Member, MemberStatus } from '../../../types';

interface HistorySectionProps {
  isOpen: boolean;
  historyMember: Member | null;
  historyMemberId: string | null;
  members: Member[];
  memberHistoryEntries: AuditLogEntry[];
  memberStatusLabels: Record<MemberStatus, string>;
  onToggle: () => void;
  onChangeHistoryMemberId: (memberId: string | null) => void;
  getChangeBadges: (entry: AuditLogEntry) => string[];
  formatDateTime: (value?: string | null) => string;
}

export const HistorySection: React.FC<HistorySectionProps> = ({
  isOpen,
  historyMember,
  historyMemberId,
  members,
  memberHistoryEntries,
  memberStatusLabels,
  onToggle,
  onChangeHistoryMemberId,
  getChangeBadges,
  formatDateTime,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50"
    >
      <div>
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <History size={18} className="text-indigo-600" />
          직책/접근 변경 이력
        </div>
        <div className="mt-1 text-sm text-slate-500">
          멤버 표와 팀 지정 화면에서 바뀐 로그인 이메일, 직책, 상태, 소속 변경을 감사 로그로 추적합니다.
        </div>
      </div>
      <div className="flex items-center gap-3">
        {historyMember && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            기준 멤버 {historyMember.name}
          </span>
        )}
        {isOpen ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </div>
    </button>

    {isOpen && (
      <>
        <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
          <label className="space-y-1.5 text-sm text-slate-600">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">이력 기준 멤버</span>
            <select
              value={historyMemberId ?? ''}
              onChange={(event) => onChangeHistoryMemberId(event.target.value || null)}
              className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-6 p-5 sm:p-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
            <div className="text-sm font-semibold text-slate-300">선택한 멤버</div>
            {historyMember ? (
              <>
                <div className="mt-3 text-2xl font-bold">{historyMember.name}</div>
                <div className="mt-2 text-sm text-slate-300">
                  직책 {historyMember.roleName ?? '미지정'}
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">로그인 이메일</div>
                    <div className="mt-2 break-all text-sm font-medium text-white">{historyMember.loginEmail ?? '아직 없음'}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">현재 상태</div>
                    <div className="mt-2 text-sm font-medium text-white">
                      {memberStatusLabels[historyMember.status ?? 'active']} · {historyMember.authUserId ? '계정 발급 완료' : '계정 미발급'}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">최근 변경</div>
                    <div className="mt-2 text-sm leading-6 text-slate-200">
                      {memberHistoryEntries[0]?.summary ?? '아직 멤버 변경 이력이 없습니다. 이번 버전 이후 변경부터 누적됩니다.'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-3 text-sm text-slate-300">먼저 멤버를 선택해 주세요.</div>
            )}
          </div>

          <div className="space-y-3">
            {memberHistoryEntries.map((entry) => {
              const changeBadges = getChangeBadges(entry);
              return (
                <div key={entry.id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{entry.summary}</div>
                      <div className="mt-1 text-sm text-slate-500">
                        {entry.actorName ?? '시스템'} · {formatDateTime(entry.createdAt)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {changeBadges.length > 0 ? changeBadges.map((badge) => (
                        <span key={`${entry.id}-${badge}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          {badge}
                        </span>
                      )) : (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                          변경 기록
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {historyMember && memberHistoryEntries.length === 0 && (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                {historyMember.name}의 역할 변경 이력이 아직 없습니다. 이번 버전 이후부터 직책, 이메일, 계정 상태, 소속 변경이 자동으로 누적됩니다.
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </section>
);
