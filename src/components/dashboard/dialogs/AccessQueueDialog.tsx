import React from 'react';
import { Clock3, KeyRound, Mail, XCircle } from 'lucide-react';
import type { Member } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface AccessPreparationStats {
  missingEmail: number;
  missingAccount: number;
  dormantOrInactive: number;
}

interface AccessTag {
  label: string;
  className: string;
}

interface AccessQueueDialogProps {
  isOpen: boolean;
  approvalQueue: Member[];
  accessPreparation: AccessPreparationStats;
  savingMemberId: string | null;
  provisioningMemberId: string | null;
  onClose: () => void;
  onProvisionMemberAccount: (member: Member) => void;
  onMarkDormant: (memberId: string) => void;
  onMarkInactive: (memberId: string) => void;
  getAccessPrepTags: (member: Member) => AccessTag[];
  getMemberTeamLabels: (member: Member) => string[];
  formatDate: (value?: string | null) => string;
}

export const AccessQueueDialog: React.FC<AccessQueueDialogProps> = ({
  isOpen,
  approvalQueue,
  accessPreparation,
  savingMemberId,
  provisioningMemberId,
  onClose,
  onProvisionMemberAccount,
  onMarkDormant,
  onMarkInactive,
  getAccessPrepTags,
  getMemberTeamLabels,
  formatDate,
}) => (
  <AppDialog
    isOpen={isOpen}
    title="접근 준비 큐"
    description="로그인 이메일, 계정 발급, 회원 상태가 아직 맞지 않은 멤버만 따로 모아 둔 목록입니다."
    size="xl"
    onClose={onClose}
  >
    <div className="mb-4 grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">이메일 미등록</div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.missingEmail}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">계정 미발급</div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.missingAccount}</div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">보류/비활성</div>
        <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.dormantOrInactive}</div>
      </div>
    </div>

    <div className="space-y-4">
      {approvalQueue.length === 0 ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
          <div className="text-lg font-semibold text-emerald-800">현재 처리할 접근 준비 대상이 없습니다.</div>
          <div className="mt-2 text-sm text-emerald-700">로그인 이메일과 계정 발급이 완료된 회원은 즉시 서비스에 접근할 수 있습니다.</div>
        </div>
      ) : (
        approvalQueue.map((member) => {
          const approvalTags = getAccessPrepTags(member);
          const isSavingRow = savingMemberId === member.id;
          const canProvision = Boolean(member.loginEmail);

          return (
            <div key={member.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{member.name}</div>
                    <div className="mt-1 text-sm text-slate-500">{member.loginEmail ?? '로그인 이메일이 아직 등록되지 않았습니다.'}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {approvalTags.map((tag) => (
                      <span key={tag.label} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tag.className}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>

                  <div className="text-sm text-slate-500">
                    직책 {member.roleName ?? '미지정'} · 팀 {getMemberTeamLabels(member).join(', ') || '미지정'} · 가입일 {formatDate(member.joinedAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 lg:justify-end">
                  <button
                    type="button"
                    disabled={!canProvision || provisioningMemberId === member.id}
                    onClick={() => onProvisionMemberAccount(member)}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <KeyRound size={16} />
                    {provisioningMemberId === member.id ? '발급 중' : member.authUserId ? '재발급' : '계정 발급'}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingRow}
                    onClick={() => onMarkDormant(member.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Clock3 size={16} />
                    보류
                  </button>
                  <button
                    type="button"
                    disabled={isSavingRow}
                    onClick={() => onMarkInactive(member.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    반려
                  </button>
                </div>
              </div>

              {!canProvision && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                  <Mail size={14} />
                  로그인 이메일을 먼저 입력해야 계정을 발급할 수 있습니다.
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  </AppDialog>
);
