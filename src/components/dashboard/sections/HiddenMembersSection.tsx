import React from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Trash2, XCircle } from 'lucide-react';
import type { Member, MemberStatus } from '../../../types';

interface HiddenMembersSectionProps {
  isOpen: boolean;
  hiddenMembers: Member[];
  savingMemberId: string | null;
  hardDeletingMemberId: string | null;
  memberStatusLabels: Record<MemberStatus, string>;
  onToggle: () => void;
  onRestoreMember: (memberId: string) => void;
  onRequestDeleteMember: (memberId: string) => void;
  getMemberTeamLabels: (member: Member) => string[];
  formatDate: (value?: string | null) => string;
}

export const HiddenMembersSection: React.FC<HiddenMembersSectionProps> = ({
  isOpen,
  hiddenMembers,
  savingMemberId,
  hardDeletingMemberId,
  memberStatusLabels,
  onToggle,
  onRestoreMember,
  onRequestDeleteMember,
  getMemberTeamLabels,
  formatDate,
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50"
    >
      <div>
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <XCircle size={18} className="text-slate-500" />
          숨김 멤버 보기/복구
        </div>
        <div className="mt-1 text-sm text-slate-500">
          목록에서 숨긴 멤버를 확인하고 다시 복구할 수 있습니다.
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
          {hiddenMembers.length}명
        </span>
        {isOpen ? (
          <ChevronUp size={18} className="text-slate-400" />
        ) : (
          <ChevronDown size={18} className="text-slate-400" />
        )}
      </div>
    </button>

    {isOpen && (
      <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
        {hiddenMembers.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            현재 숨김 처리된 멤버가 없습니다.
          </div>
        ) : (
          <div className="space-y-3">
            {hiddenMembers.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-4 rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-semibold text-slate-900">{member.name}</div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {member.roleName ?? '직책 미지정'}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {memberStatusLabels[member.status ?? 'inactive']}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-500">
                    {member.loginEmail ?? '로그인 이메일 없음'}
                    <span className="mx-2 text-slate-300">·</span>
                    팀 {getMemberTeamLabels(member).join(', ') || '미지정'}
                    <span className="mx-2 text-slate-300">·</span>
                    가입일 {formatDate(member.joinedAt)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingMemberId === member.id}
                    onClick={() => onRestoreMember(member.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw size={16} />
                    {savingMemberId === member.id ? '복구 중' : '복구'}
                  </button>
                  <button
                    type="button"
                    disabled={hardDeletingMemberId === member.id}
                    onClick={() => onRequestDeleteMember(member.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 size={16} />
                    {hardDeletingMemberId === member.id ? '삭제 중' : '영구 삭제'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </section>
);
