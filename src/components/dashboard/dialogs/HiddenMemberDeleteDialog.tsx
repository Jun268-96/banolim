import React from 'react';
import type { Member } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface HiddenMemberDeleteDialogProps {
  hiddenMemberPendingDelete: Member | null;
  hardDeletingMemberId: string | null;
  onClose: () => void;
  onDelete: () => void;
}

export const HiddenMemberDeleteDialog: React.FC<HiddenMemberDeleteDialogProps> = ({
  hiddenMemberPendingDelete,
  hardDeletingMemberId,
  onClose,
  onDelete,
}) => (
  <AppDialog
    isOpen={Boolean(hiddenMemberPendingDelete)}
    title={hiddenMemberPendingDelete ? `${hiddenMemberPendingDelete.name} 영구 삭제` : '영구 삭제'}
    description="활동 기록이 남아 있는 숨김 멤버는 영구 삭제할 수 없습니다."
    size="md"
    onClose={onClose}
  >
    {hiddenMemberPendingDelete && (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          멤버 정보, 팀 연결, 배지, 계정 연결 정보가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          활동 기록이 하나라도 있으면 서버에서 삭제를 거부하고 숨김 상태만 유지됩니다.
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={hardDeletingMemberId === hiddenMemberPendingDelete.id}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {hardDeletingMemberId === hiddenMemberPendingDelete.id ? '삭제 중...' : '영구 삭제'}
          </button>
        </div>
      </div>
    )}
  </AppDialog>
);
