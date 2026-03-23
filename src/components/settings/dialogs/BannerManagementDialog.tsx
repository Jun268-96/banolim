import React from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { SiteBanner } from '../../../types';
import { EmptyState } from '../SettingsSectionPrimitives';
import { SettingsDialog } from '../SettingsDialog';

interface BannerManagementDialogProps {
  isOpen: boolean;
  bannerTitle: string;
  bannerUrl: string;
  bannerFileName: string;
  bannerFileData: string | null;
  siteBanners: SiteBanner[];
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onResetDraft: () => void;
  onChangeTitle: (value: string) => void;
  onChangeUrl: (value: string) => void;
  onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMoveBanner: (bannerId: string, direction: 'up' | 'down') => void;
  onDeleteBanner: (bannerId: string) => void;
}

export const BannerManagementDialog: React.FC<BannerManagementDialogProps> = ({
  isOpen,
  bannerTitle,
  bannerUrl,
  bannerFileName,
  bannerFileData,
  siteBanners,
  onClose,
  onSubmit,
  onResetDraft,
  onChangeTitle,
  onChangeUrl,
  onChangeFile,
  onMoveBanner,
  onDeleteBanner,
}) => (
  <SettingsDialog
    isOpen={isOpen}
    onClose={onClose}
    title="배너 변경"
    description="권장 3200×480 가로 배너입니다. JPG/PNG/WebP 파일을 첨부하거나 이미지 링크를 입력할 수 있습니다."
    size="xl"
  >
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
        <div className="text-sm font-semibold text-slate-900">새 배너 추가</div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">배너 제목</span>
            <input
              type="text"
              value={bannerTitle}
              onChange={(event) => onChangeTitle(event.target.value)}
              placeholder="예: 2026 상반기 운영 배너"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-700">이미지 링크</span>
            <input
              type="url"
              value={bannerUrl}
              onChange={(event) => onChangeUrl(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-700">이미지 파일 첨부</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={onChangeFile}
            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
          />
          <p className="text-xs text-slate-500">
            {bannerFileName ? `선택된 파일: ${bannerFileName}` : '권장 비율은 가로 20:3(예: 3200×480)입니다. 1600×480 이미지는 좌우 여백이 남을 수 있습니다.'}
          </p>
        </label>

        {(bannerFileData || bannerUrl.trim()) && (
          <div className="overflow-hidden rounded-[24px] bg-slate-950">
            <img
              src={bannerFileData ?? bannerUrl}
              alt="배너 미리보기"
              className="h-40 w-full object-cover object-center"
            />
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onResetDraft}
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            입력 초기화
          </button>
          <button
            type="submit"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            배너 추가
          </button>
        </div>
      </form>

      <div className="space-y-3">
        <div className="text-sm font-semibold text-slate-900">등록된 배너</div>
        {siteBanners.length === 0 ? (
          <EmptyState message="아직 등록된 배너가 없습니다. 기본 배너가 상단에 노출됩니다." />
        ) : (
          <div className="space-y-3">
            {siteBanners.map((banner, index) => (
              <div key={banner.id} className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="overflow-hidden rounded-[20px] bg-slate-950 lg:w-72">
                    <img
                      src={banner.imageUrl}
                      alt={banner.title || '등록된 배너'}
                      className="h-28 w-full object-cover object-center"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">
                      {banner.title || `배너 ${index + 1}`}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      순서 {index + 1} · {banner.createdAt.slice(0, 10)}
                    </div>
                    <div className="mt-2 truncate text-xs text-slate-400">
                      {banner.imageUrl.startsWith('data:') ? '첨부 이미지로 등록됨' : banner.imageUrl}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onMoveBanner(banner.id, 'up')}
                      disabled={index === 0}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUp size={16} />
                      위로
                    </button>
                    <button
                      type="button"
                      onClick={() => onMoveBanner(banner.id, 'down')}
                      disabled={index === siteBanners.length - 1}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowDown size={16} />
                      아래로
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBanner(banner.id)}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      <Trash2 size={16} />
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </SettingsDialog>
);
