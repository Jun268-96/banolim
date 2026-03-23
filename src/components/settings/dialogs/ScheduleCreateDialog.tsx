import React from 'react';
import type { SeasonSummary } from '../../../types';
import { SettingsDialog } from '../SettingsDialog';

interface ScheduleCreateDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  seasonId: string;
  seasons: SeasonSummary[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChangeTitle: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeLocation: (value: string) => void;
  onChangeStartAt: (value: string) => void;
  onChangeEndAt: (value: string) => void;
  onChangeSeasonId: (value: string) => void;
}

export const ScheduleCreateDialog: React.FC<ScheduleCreateDialogProps> = ({
  isOpen,
  title,
  description,
  location,
  startAt,
  endAt,
  seasonId,
  seasons,
  onClose,
  onSubmit,
  onChangeTitle,
  onChangeDescription,
  onChangeLocation,
  onChangeStartAt,
  onChangeEndAt,
  onChangeSeasonId,
}) => (
  <SettingsDialog
    isOpen={isOpen}
    onClose={onClose}
    title="일정 등록"
    description="모임, 세션, 제출 마감 같은 일정은 상세 정보까지 입력하고 시즌과 연결할 수 있습니다."
    size="lg"
  >
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">일정 제목</span>
        <input
          type="text"
          value={title}
          onChange={(event) => onChangeTitle(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">설명</span>
        <textarea
          value={description}
          onChange={(event) => onChangeDescription(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">시작 일시</span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => onChangeStartAt(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">종료 일시</span>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => onChangeEndAt(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">장소</span>
          <input
            type="text"
            value={location}
            onChange={(event) => onChangeLocation(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">연결 시즌</span>
          <select
            value={seasonId}
            onChange={(event) => onChangeSeasonId(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">시즌 미지정</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
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
          일정 등록
        </button>
      </div>
    </form>
  </SettingsDialog>
);
