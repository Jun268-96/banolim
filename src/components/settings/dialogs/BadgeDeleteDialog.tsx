import React from 'react';
import type { Badge } from '../../../types';
import { getBadgeArtworkUrl, getBadgeCriteriaSummary } from '../../../lib/badges';
import { SettingsDialog } from '../SettingsDialog';

interface BadgeDeleteDialogProps {
  badge: Badge | null;
  awardCount: number;
  isDeleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}

export const BadgeDeleteDialog: React.FC<BadgeDeleteDialogProps> = ({
  badge,
  awardCount,
  isDeleting,
  onClose,
  onDelete,
}) => (
  <SettingsDialog
    isOpen={Boolean(badge)}
    onClose={onClose}
    title="배지 삭제"
    description="삭제한 배지는 회원 획득 이력에서도 함께 제거됩니다."
    size="md"
  >
    {badge && (
      <div className="space-y-5">
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          {badge.name} 배지를 삭제하면 현재 배지를 보유한 회원 {awardCount}명의 기록에서도 함께 사라집니다.
          이 작업은 되돌릴 수 없습니다.
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white bg-white shadow-sm">
              <img
                src={getBadgeArtworkUrl(badge)}
                alt={badge.name}
                className="h-12 w-auto object-contain"
              />
            </div>
            <div>
              <div className="font-semibold text-slate-900">{badge.name}</div>
              <div className="mt-1 text-sm text-slate-500">{badge.description}</div>
              <div className="mt-2 text-xs text-slate-500">
                {getBadgeCriteriaSummary(badge.criteria, badge.evaluationScope)}
              </div>
            </div>
          </div>
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
            onClick={onDelete}
            disabled={isDeleting}
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isDeleting ? '삭제 중...' : '배지 삭제'}
          </button>
        </div>
      </div>
    )}
  </SettingsDialog>
);
