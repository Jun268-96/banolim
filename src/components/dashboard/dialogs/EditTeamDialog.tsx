import React from 'react';
import type { Member, TeamSummary, TeamType } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface EditTeamDialogProps {
  isOpen: boolean;
  editingTeam: TeamSummary | null;
  editingTeamName: string;
  editingTeamType: TeamType;
  isSaving: boolean;
  allMembers: Member[];
  teamTypeOptions: TeamType[];
  teamTypeLabels: Record<TeamType, string>;
  onClose: () => void;
  onSave: () => void;
  onChangeTeamName: (value: string) => void;
  onChangeTeamType: (value: TeamType) => void;
}

export const EditTeamDialog: React.FC<EditTeamDialogProps> = ({
  isOpen,
  editingTeam,
  editingTeamName,
  editingTeamType,
  isSaving,
  allMembers,
  teamTypeOptions,
  teamTypeLabels,
  onClose,
  onSave,
  onChangeTeamName,
  onChangeTeamType,
}) => (
  <AppDialog
    isOpen={isOpen && Boolean(editingTeam)}
    title={editingTeam ? `${editingTeam.name} 팀 수정` : '팀 수정'}
    description="팀 이름과 팀 유형을 수정할 수 있습니다."
    size="md"
    onClose={onClose}
  >
    {editingTeam && (
      <div className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">팀 이름</span>
          <input
            type="text"
            value={editingTeamName}
            onChange={(event) => onChangeTeamName(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">팀 유형</span>
          <select
            value={editingTeamType}
            onChange={(event) => onChangeTeamType(event.target.value as TeamType)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {teamTypeOptions.map((teamType) => (
              <option key={teamType} value={teamType}>
                {teamTypeLabels[teamType]}
              </option>
            ))}
          </select>
        </label>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
          현재 배정 인원 {allMembers.filter((member) => (member.teamIds ?? []).includes(editingTeam.id) || member.teamId === editingTeam.id).length}명
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !editingTeamName.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    )}
  </AppDialog>
);
