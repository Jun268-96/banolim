import React from 'react';
import type { SeasonStatus } from '../../../types';
import { SettingsDialog } from '../SettingsDialog';

interface SeasonCreateDialogProps {
  isOpen: boolean;
  seasonName: string;
  seasonStartDate: string;
  seasonEndDate: string;
  seasonStatus: SeasonStatus;
  seasonStatusOptions: SeasonStatus[];
  seasonStatusLabels: Record<SeasonStatus, string>;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChangeSeasonName: (value: string) => void;
  onChangeSeasonStartDate: (value: string) => void;
  onChangeSeasonEndDate: (value: string) => void;
  onChangeSeasonStatus: (value: SeasonStatus) => void;
}

export const SeasonCreateDialog: React.FC<SeasonCreateDialogProps> = ({
  isOpen,
  seasonName,
  seasonStartDate,
  seasonEndDate,
  seasonStatus,
  seasonStatusOptions,
  seasonStatusLabels,
  onClose,
  onSubmit,
  onChangeSeasonName,
  onChangeSeasonStartDate,
  onChangeSeasonEndDate,
  onChangeSeasonStatus,
}) => (
  <SettingsDialog
    isOpen={isOpen}
    onClose={onClose}
    title="새 시즌 추가"
    description="시즌은 통계와 출석 세션의 기준 기간으로 사용됩니다."
    size="lg"
  >
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">시즌 이름</span>
          <input
            type="text"
            value={seasonName}
            onChange={(event) => onChangeSeasonName(event.target.value)}
            placeholder="예: 2026 상반기"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">상태</span>
          <select
            value={seasonStatus}
            onChange={(event) => onChangeSeasonStatus(event.target.value as SeasonStatus)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            {seasonStatusOptions.map((status) => (
              <option key={status} value={status}>
                {seasonStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">시작일</span>
          <input
            type="date"
            value={seasonStartDate}
            onChange={(event) => onChangeSeasonStartDate(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">종료일</span>
          <input
            type="date"
            value={seasonEndDate}
            onChange={(event) => onChangeSeasonEndDate(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
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
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          시즌 추가
        </button>
      </div>
    </form>
  </SettingsDialog>
);
