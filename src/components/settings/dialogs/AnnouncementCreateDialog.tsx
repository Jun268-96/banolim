import React from 'react';
import { SettingsDialog } from '../SettingsDialog';

interface AnnouncementCreateDialogProps {
  isOpen: boolean;
  title: string;
  body: string;
  startAt: string;
  endAt: string;
  isPinned: boolean;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onChangeTitle: (value: string) => void;
  onChangeBody: (value: string) => void;
  onChangeStartAt: (value: string) => void;
  onChangeEndAt: (value: string) => void;
  onChangePinned: (value: boolean) => void;
}

export const AnnouncementCreateDialog: React.FC<AnnouncementCreateDialogProps> = ({
  isOpen,
  title,
  body,
  startAt,
  endAt,
  isPinned,
  onClose,
  onSubmit,
  onChangeTitle,
  onChangeBody,
  onChangeStartAt,
  onChangeEndAt,
  onChangePinned,
}) => (
  <SettingsDialog
    isOpen={isOpen}
    onClose={onClose}
    title="공지 등록"
    description="홈과 내 상태에 노출될 공지를 입력합니다."
    size="lg"
  >
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">공지 제목</span>
        <input
          type="text"
          value={title}
          onChange={(event) => onChangeTitle(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-slate-700">공지 내용</span>
        <textarea
          value={body}
          onChange={(event) => onChangeBody(event.target.value)}
          rows={5}
          className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">노출 시작</span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => onChangeStartAt(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-slate-700">노출 종료</span>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => onChangeEndAt(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <input
          type="checkbox"
          checked={isPinned}
          onChange={(event) => onChangePinned(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-sm font-medium text-slate-700">상단 고정 공지로 노출</span>
      </label>

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
          공지 등록
        </button>
      </div>
    </form>
  </SettingsDialog>
);
