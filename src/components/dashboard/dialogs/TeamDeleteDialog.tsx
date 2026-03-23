import React from 'react';
import type { Member, TeamSummary } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface TeamDeleteDialogProps {
  teamPendingDelete: TeamSummary | null;
  members: Member[];
  hiddenMembers: Member[];
  isDeletingTeam: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const TeamDeleteDialog: React.FC<TeamDeleteDialogProps> = ({
  teamPendingDelete,
  members,
  hiddenMembers,
  isDeletingTeam,
  onClose,
  onDelete,
}) => (
  <AppDialog
    isOpen={Boolean(teamPendingDelete)}
    title={teamPendingDelete ? `${teamPendingDelete.name} 팀 삭제` : '팀 삭제'}
    description="팀을 삭제하면 팀 연결이 해제되고, 대표 팀은 남은 첫 팀으로 다시 계산됩니다."
    size="md"
    onClose={onClose}
  >
    {teamPendingDelete && (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          이 팀에 연결된 멤버가 있더라도 삭제할 수 있습니다. 배정된 멤버의 대표 팀은 남아 있는 팀 중 첫 번째 팀으로 자동 재계산됩니다.
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="text-sm font-semibold text-slate-900">삭제 영향</div>
          <div className="mt-2 text-sm text-slate-600">
            총 {members.filter((member) => (member.teamIds ?? []).includes(teamPendingDelete.id) || member.teamId === teamPendingDelete.id).length + hiddenMembers.filter((member) => (member.teamIds ?? []).includes(teamPendingDelete.id) || member.teamId === teamPendingDelete.id).length}명
            <span className="mx-2 text-slate-300">·</span>
            공개 {members.filter((member) => (member.teamIds ?? []).includes(teamPendingDelete.id) || member.teamId === teamPendingDelete.id).length}명
            <span className="mx-2 text-slate-300">·</span>
            숨김 {hiddenMembers.filter((member) => (member.teamIds ?? []).includes(teamPendingDelete.id) || member.teamId === teamPendingDelete.id).length}명
          </div>
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
            disabled={isDeletingTeam}
            className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            {isDeletingTeam ? '삭제 중...' : '팀 삭제'}
          </button>
        </div>
      </div>
    )}
  </AppDialog>
);
