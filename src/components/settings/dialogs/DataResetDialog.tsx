import React from 'react';
import { SettingsDialog } from '../SettingsDialog';

interface DataResetDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmationText: string;
  confirmationInput: string;
  isResetting: boolean;
  onClose: () => void;
  onChangeConfirmationInput: (value: string) => void;
  onExecute: () => void;
}

export const DataResetDialog: React.FC<DataResetDialogProps> = ({
  isOpen,
  title,
  description,
  confirmationText,
  confirmationInput,
  isResetting,
  onClose,
  onChangeConfirmationInput,
  onExecute,
}) => (
  <SettingsDialog
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    description={description}
    size="md"
  >
    <div className="space-y-5">
      <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
        현재 시즌 기준으로만 삭제되며, 실행 뒤에는 되돌릴 수 없습니다. 감사 로그는 서버에서 별도로 남깁니다.
      </div>
      <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="text-sm font-semibold text-slate-900">확인 문구 입력</div>
        <div className="mt-2 text-sm text-slate-600">
          아래 문구를 정확히 입력해야 실행할 수 있습니다:
          <span className="ml-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
            {confirmationText}
          </span>
        </div>
        <input
          type="text"
          value={confirmationInput}
          onChange={(event) => onChangeConfirmationInput(event.target.value)}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
          placeholder={confirmationText}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={isResetting || confirmationInput.trim() !== confirmationText}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isResetting ? '초기화 중...' : '초기화 실행'}
        </button>
      </div>
    </div>
  </SettingsDialog>
);
