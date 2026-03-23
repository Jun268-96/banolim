import React from 'react';
import { AppDialog } from '../../shared/AppDialog';

interface OnboardingGuideDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingGuideDialog: React.FC<OnboardingGuideDialogProps> = ({ isOpen, onClose }) => (
  <AppDialog
    isOpen={isOpen}
    title="관리자 온보딩 가이드"
    description="새 회원을 실제 로그인 가능한 상태로 만들 때 필요한 최소 절차입니다."
    size="lg"
    onClose={onClose}
  >
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
        <div className="font-semibold text-slate-900">1. 로그인 이메일 등록</div>
        <div className="mt-2 text-sm leading-7 text-slate-600">실제로 로그인에 사용할 이메일을 입력합니다. 저장만으로는 접근이 열리지 않고, 계정 발급까지 해야 비밀번호 로그인이 가능합니다.</div>
      </div>
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
        <div className="font-semibold text-slate-900">2. 직책 선택</div>
        <div className="mt-2 text-sm leading-7 text-slate-600">직책 이름과 시스템 권한은 분리되어 있습니다. 회장과 개발 관리자는 서로 다른 이름이어도 같은 최고 권한을 가질 수 있습니다.</div>
      </div>
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
        <div className="font-semibold text-slate-900">3. 계정 발급</div>
        <div className="mt-2 text-sm leading-7 text-slate-600">관리 열의 `계정 발급` 버튼으로 임시 비밀번호를 만듭니다. 기존 계정이 있으면 새 임시 비밀번호로 재발급됩니다.</div>
      </div>
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
        <div className="font-semibold text-slate-900">4. 상태 확인</div>
        <div className="mt-2 text-sm leading-7 text-slate-600">계정 발급 뒤에는 `활동 중(active)` 상태만 유지하면 됩니다. 보류나 비활성 상태면 로그인은 되더라도 실제 접근이 제한됩니다.</div>
      </div>
    </div>
    <div className="mt-4 rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm leading-7 text-indigo-900">
      접근 준비 큐에 잡히는 이유는 이메일 미등록, 계정 미발급, 보류/비활성 상태 중 하나입니다. 표에서 바로 수정하거나 접근 준비 큐 팝업에서 일괄 처리할 수 있습니다.
    </div>
  </AppDialog>
);
