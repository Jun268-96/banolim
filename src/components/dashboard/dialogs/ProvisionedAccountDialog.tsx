import React from 'react';
import { AppDialog } from '../../shared/AppDialog';

interface ProvisionedAccount {
  memberName: string;
  email: string;
  temporaryPassword: string;
  isExistingAccount: boolean;
}

interface ProvisionedAccountDialogProps {
  provisionedAccount: ProvisionedAccount | null;
  onClose: () => void;
}

export const ProvisionedAccountDialog: React.FC<ProvisionedAccountDialogProps> = ({
  provisionedAccount,
  onClose,
}) => (
  <AppDialog
    isOpen={Boolean(provisionedAccount)}
    title="임시 비밀번호 발급 완료"
    description="아래 비밀번호를 회원에게 안전하게 전달해 주세요. 첫 로그인 뒤에는 새 비밀번호 설정이 강제됩니다."
    size="md"
    onClose={onClose}
  >
    {provisionedAccount && (
      <div className="space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">회원</div>
          <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.memberName}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">로그인 이메일</div>
          <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.email}</div>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm text-indigo-700">임시 비밀번호</div>
          <div className="mt-2 break-all font-mono text-lg font-bold text-indigo-950">{provisionedAccount.temporaryPassword}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
          {provisionedAccount.isExistingAccount
            ? '기존 계정의 비밀번호를 새 임시 비밀번호로 재설정했습니다.'
            : '새 계정을 만들고 임시 비밀번호를 발급했습니다.'}
        </div>
      </div>
    )}
  </AppDialog>
);
