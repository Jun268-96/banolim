import React from 'react';
import { AppDialog } from '../../shared/AppDialog';

interface ProvisionedAccount {
  memberName: string;
  email: string;
  isExistingAccount: boolean;
  inviteSent: boolean;
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
    title="초대 이메일 발송 완료"
    description="초대 링크가 회원 이메일로 발송됐습니다. 링크를 클릭하면 비밀번호를 직접 설정할 수 있습니다."
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
          <div className="text-sm text-slate-500">발송된 이메일</div>
          <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.email}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
          {provisionedAccount.isExistingAccount
            ? '기존 계정으로 비밀번호 재설정 링크를 발송했습니다.'
            : '새 계정을 만들고 초대 링크를 발송했습니다.'}
        </div>
      </div>
    )}
  </AppDialog>
);
