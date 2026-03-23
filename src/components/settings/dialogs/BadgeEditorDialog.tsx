import React from 'react';
import type { BadgeCriteria, BadgeEvaluationScope, BadgeTone, BadgeUpsertInput } from '../../../types';
import {
  badgeArtworkOptions,
  badgeScopeLabels,
  badgeToneLabels,
  getBadgeArtworkUrl,
  getBadgeCriteriaSummary,
  normalizeBadgeCode,
} from '../../../lib/badges';
import { SettingsDialog } from '../SettingsDialog';

type BadgeDialogMode = 'create' | 'edit';

const badgeToneOptions: BadgeTone[] = ['gold', 'sky', 'emerald', 'rose'];
const badgeScopeOptions: BadgeEvaluationScope[] = ['season', 'lifetime'];
const badgeTonePreviewClasses: Record<BadgeTone, string> = {
  gold: 'border-amber-200 bg-amber-50 text-amber-800',
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
};

const badgeCriteriaFields: Array<{
  key: keyof BadgeCriteria;
  label: string;
  hint: string;
  unit: string;
}> = [
  { key: 'activityCount', label: '활동 기록', hint: '활동 로그 총 개수', unit: '건' },
  { key: 'attendanceCount', label: '출석 계열', hint: '출석/지각/결석 포함', unit: '건' },
  { key: 'spotlightCount', label: '발표·고점수', hint: '발표 또는 20점 이상 기여', unit: '회' },
  { key: 'uniqueActivityTypeCount', label: '활동 유형', hint: '서로 다른 활동 카테고리 수', unit: '종' },
  { key: 'evidenceCount', label: '증빙 기록', hint: '링크 증빙이 있는 활동 수', unit: '건' },
  { key: 'activeDayCount', label: '활동 일수', hint: '서로 다른 날짜 수', unit: '일' },
  { key: 'totalPoints', label: '누적 점수', hint: '포인트 총합 기준', unit: '점' },
];

interface BadgeEditorDialogProps {
  isOpen: boolean;
  mode: BadgeDialogMode;
  draft: BadgeUpsertInput;
  badgeImageFileName: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onNameChange: (value: string) => void;
  onCriteriaChange: (key: keyof BadgeCriteria, value: string) => void;
  onBadgeImageFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearCustomImage: () => void;
  setDraft: React.Dispatch<React.SetStateAction<BadgeUpsertInput>>;
}

export const BadgeEditorDialog: React.FC<BadgeEditorDialogProps> = ({
  isOpen,
  mode,
  draft,
  badgeImageFileName,
  isSaving,
  onClose,
  onSave,
  onNameChange,
  onCriteriaChange,
  onBadgeImageFileChange,
  onClearCustomImage,
  setDraft,
}) => (
  <SettingsDialog
    isOpen={isOpen}
    onClose={onClose}
    title={mode === 'edit' ? '배지 수정' : '새 배지 추가'}
    description="기본 정보, 획득 조건, 디자인을 한 번에 편집합니다. 탭에서는 조회만 하고 실제 수정은 이 창에서 진행합니다."
    size="xl"
  >
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">기본 정보</div>
                <div className="mt-1 text-sm text-slate-500">배지 이름, 코드, 범위와 노출 상태를 정의합니다.</div>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeTonePreviewClasses[draft.tone]}`}>
                {badgeToneLabels[draft.tone]}
              </span>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">배지 이름</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(event) => onNameChange(event.target.value)}
                  placeholder="예: 발표 마에스트로"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">배지 코드</span>
                <input
                  type="text"
                  value={draft.code}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    code: normalizeBadgeCode(event.target.value),
                  }))}
                  placeholder="presentation_maestro"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">톤</span>
                <select
                  value={draft.tone}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    tone: event.target.value as BadgeTone,
                  }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  {badgeToneOptions.map((tone) => (
                    <option key={tone} value={tone}>
                      {badgeToneLabels[tone]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">정렬 순서</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={draft.sortOrder}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    sortOrder: Number.parseInt(event.target.value, 10) || 0,
                  }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">평가 범위</span>
                <select
                  value={draft.evaluationScope}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    evaluationScope: event.target.value as BadgeEvaluationScope,
                  }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  {badgeScopeOptions.map((scope) => (
                    <option key={scope} value={scope}>
                      {badgeScopeLabels[scope]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:mt-7">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <div className="text-sm font-medium text-slate-800">활성 배지로 노출</div>
                  <div className="text-xs text-slate-500">비활성 배지는 회원 화면에 잠금 카드로도 보이지 않습니다.</div>
                </div>
              </label>
            </div>

            <label className="mt-4 block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">설명</span>
              <textarea
                value={draft.description}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))}
                rows={4}
                placeholder="회원에게 보여질 배지 설명을 입력해 주세요."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div>
              <div className="text-sm font-semibold text-slate-900">획득 조건</div>
              <div className="mt-1 text-sm text-slate-500">0 또는 빈 값은 조건에서 제외됩니다. 활성 배지는 최소 한 개 이상의 조건이 필요합니다.</div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {badgeCriteriaFields.map((field) => (
                <label key={field.key} className="space-y-1.5">
                  <span className="flex items-center justify-between gap-2 text-sm font-medium text-slate-700">
                    <span>{field.label}</span>
                    <span className="text-xs text-slate-400">{field.unit}</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={draft.criteria[field.key] ?? ''}
                    onChange={(event) => onCriteriaChange(field.key, event.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="text-xs leading-5 text-slate-500">{field.hint}</div>
                </label>
              ))}
            </div>

            <div className="mt-4 rounded-[22px] border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm leading-6 text-indigo-900">
              {getBadgeCriteriaSummary(draft.criteria, draft.evaluationScope)}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div>
              <div className="text-sm font-semibold text-slate-900">디자인</div>
              <div className="mt-1 text-sm text-slate-500">프리셋 일러스트를 고르거나, 직접 만든 이미지를 URL 또는 파일로 넣을 수 있습니다.</div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {badgeArtworkOptions.map((option) => {
                const isSelected = draft.iconKey === option.key && !draft.imageUrl;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setDraft((current) => ({
                        ...current,
                        iconKey: option.key,
                        imageUrl: null,
                      }));
                    }}
                    className={`rounded-[24px] border p-4 text-left transition-all ${
                      isSelected
                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-slate-100 bg-slate-50">
                        <img src={option.previewUrl} alt={option.label} className="h-10 w-auto object-contain" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{option.label}</div>
                        <div className="mt-1 text-xs text-slate-500">{option.key}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">커스텀 이미지 URL</span>
                <input
                  type="url"
                  value={draft.imageUrl?.startsWith('data:') ? '' : draft.imageUrl ?? ''}
                  onChange={(event) => {
                    const nextValue = event.target.value.trim();
                    setDraft((current) => ({
                      ...current,
                      imageUrl: nextValue || null,
                    }));
                  }}
                  placeholder="https://..."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
                <div className="text-xs text-slate-500">URL을 입력하면 프리셋 위에 우선 적용됩니다.</div>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">디자인 파일 업로드</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={onBadgeImageFileChange}
                  className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                />
                <div className="text-xs text-slate-500">
                  {badgeImageFileName ? `선택된 파일: ${badgeImageFileName}` : 'PNG, JPG, WebP, SVG 파일을 바로 배지 디자인으로 저장할 수 있습니다.'}
                </div>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onClearCustomImage}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                커스텀 이미지 제거
              </button>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                현재 디자인 소스 · {draft.imageUrl ? '커스텀 이미지' : `프리셋 ${draft.iconKey}`}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Badge Preview</div>
            <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeTonePreviewClasses[draft.tone]}`}>
                  {badgeToneLabels[draft.tone]}
                </div>
                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  {badgeScopeLabels[draft.evaluationScope]}
                </div>
              </div>
              <div className="mt-5 flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-white/10">
                <img
                  src={getBadgeArtworkUrl(draft)}
                  alt={draft.name || '배지 미리보기'}
                  className="h-16 w-auto object-contain"
                />
              </div>
              <div className="mt-5 text-xl font-semibold text-white">{draft.name || '새 배지 이름'}</div>
              <div className="mt-2 text-sm leading-6 text-slate-300">
                {draft.description || '여기에 배지 설명이 표시됩니다.'}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  {draft.code || 'badge_code'}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  정렬 {draft.sortOrder}
                </span>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${draft.isActive ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-slate-500/30 bg-slate-400/10 text-slate-300'}`}>
                  {draft.isActive ? '활성' : '비활성'}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">운영 메모</div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                시즌 누적 배지는 현재 활성 시즌의 기록으로 평가됩니다.
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                배지를 저장하면 서버에서 전체 회원 배지를 즉시 재계산합니다.
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
                기록이 취소되면 조건을 다시 검사해서 이미 받은 배지도 자동 회수됩니다.
              </div>
            </div>
          </div>
        </aside>
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
          onClick={onSave}
          disabled={isSaving}
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isSaving ? '저장 중...' : mode === 'edit' ? '배지 저장' : '배지 생성'}
        </button>
      </div>
    </div>
  </SettingsDialog>
);
