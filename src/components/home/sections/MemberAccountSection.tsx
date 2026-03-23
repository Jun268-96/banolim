import React from 'react';
import { ShieldCheck, UserRound } from 'lucide-react';
import type { Member } from '../../../types';

interface MemberAccountSectionProps {
  member: Member;
  roleLabel: string;
  memberTeamLabel: string;
  joinedAtLabel: string;
  latestActivityLabel: string;
  statusLabel: string;
  statusClass: string;
  accountStatus: {
    label: string;
    className: string;
  };
  loginEmail: string;
}

export const MemberAccountSection: React.FC<MemberAccountSectionProps> = ({
  member,
  roleLabel,
  memberTeamLabel,
  joinedAtLabel,
  latestActivityLabel,
  statusLabel,
  statusClass,
  accountStatus,
  loginEmail,
}) => (
  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <UserRound size={18} className="text-indigo-600" />
        내 프로필
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">이름</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{member.name}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">직책</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{roleLabel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">소속 팀</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{memberTeamLabel}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">가입일</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{joinedAtLabel}</div>
        </div>
      </div>
    </section>

    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <ShieldCheck size={18} className="text-indigo-600" />
        계정 상태
      </div>
      <div className="mt-5 space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">회원 상태</span>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">계정 상태</span>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${accountStatus.className}`}>
            {accountStatus.label}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">로그인 이메일</span>
          <span className="text-sm font-medium text-slate-900">{loginEmail}</span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-500">최근 활동</span>
          <span className="text-sm font-medium text-slate-900">{latestActivityLabel}</span>
        </div>
      </div>
    </section>
  </div>
);
