import React from 'react';
import { AppDialog } from '../../shared/AppDialog';

interface AddMemberDialogProps {
  isOpen: boolean;
  memberName: string;
  memberLoginEmail: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChangeMemberName: (value: string) => void;
  onChangeMemberLoginEmail: (value: string) => void;
}

export const AddMemberDialog: React.FC<AddMemberDialogProps> = ({
  isOpen,
  memberName,
  memberLoginEmail,
  onClose,
  onSubmit,
  onChangeMemberName,
  onChangeMemberLoginEmail,
}) => (
  <AppDialog
    isOpen={isOpen}
    title="새 멤버 등록"
    description="이름과 로그인 이메일을 먼저 등록하고, 저장 뒤 표에서 직책과 팀을 바로 조정할 수 있습니다."
    size="md"
    onClose={onClose}
  >
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">이름</span>
        <input
          type="text"
          placeholder="새 멤버 이름"
          value={memberName}
          onChange={(event) => onChangeMemberName(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">로그인 이메일</span>
        <input
          type="email"
          placeholder="example@school.kr"
          value={memberLoginEmail}
          onChange={(event) => onChangeMemberLoginEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!memberName.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          저장
        </button>
      </div>
    </form>
  </AppDialog>
);
