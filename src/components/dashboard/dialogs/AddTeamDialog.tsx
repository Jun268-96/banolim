import React from 'react';
import type { TeamType } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface AddTeamDialogProps {
  isOpen: boolean;
  teamName: string;
  teamType: TeamType;
  teamTypeOptions: TeamType[];
  teamTypeLabels: Record<TeamType, string>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChangeTeamName: (value: string) => void;
  onChangeTeamType: (value: TeamType) => void;
}

export const AddTeamDialog: React.FC<AddTeamDialogProps> = ({
  isOpen,
  teamName,
  teamType,
  teamTypeOptions,
  teamTypeLabels,
  onClose,
  onSubmit,
  onChangeTeamName,
  onChangeTeamType,
}) => (
  <AppDialog
    isOpen={isOpen}
    title="팀 추가"
    description="새 팀을 만들면 곧바로 팀 지정 화면에서 멤버를 배정할 수 있습니다."
    size="md"
    onClose={onClose}
  >
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">팀 이름</span>
        <input
          type="text"
          value={teamName}
          onChange={(event) => onChangeTeamName(event.target.value)}
          placeholder="예: 운영팀, AI 스터디"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">팀 유형</span>
        <select
          value={teamType}
          onChange={(event) => onChangeTeamType(event.target.value as TeamType)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        >
          {teamTypeOptions.map((value) => (
            <option key={value} value={value}>
              {teamTypeLabels[value]}
            </option>
          ))}
        </select>
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
          disabled={!teamName.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          팀 만들기
        </button>
      </div>
    </form>
  </AppDialog>
);
