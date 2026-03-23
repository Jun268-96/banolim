import React from 'react';
import { ChevronDown, Medal, Pencil, Trash2 } from 'lucide-react';
import type { Badge } from '../../../types';
import { badgeScopeLabels, getBadgeArtworkUrl, getBadgeCriteriaSummary } from '../../../lib/badges';
import { EmptyState, SectionHeader } from '../SettingsSectionPrimitives';

interface BadgeSectionProps {
  badges: Badge[];
  badgeAwardCounts: Record<string, number>;
  openBadgeId: string | null;
  onToggleBadge: (badgeId: string) => void;
  onCreateBadge: () => void;
  onEditBadge: (badge: Badge) => void;
  onDeleteBadge: (badgeId: string) => void;
}

export const BadgeSection: React.FC<BadgeSectionProps> = ({
  badges,
  badgeAwardCounts,
  openBadgeId,
  onToggleBadge,
  onCreateBadge,
  onEditBadge,
  onDeleteBadge,
}) => (
  <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
    <SectionHeader
      icon={<Medal size={18} className="text-indigo-600" />}
      title="배지 관리"
      description="배지 규칙, 디자인, 노출 상태를 관리합니다. 탭에서는 조회만 하고 실제 편집은 모달에서 진행합니다."
      actionLabel="배지 추가"
      onAction={onCreateBadge}
    />
    <div className="space-y-4 p-5 sm:p-6">
      {badges.length === 0 ? (
        <EmptyState message="아직 등록된 배지가 없습니다." />
      ) : (
        <div className="space-y-3">
          {badges.map((badge) => (
            <div key={badge.id} className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50">
              <div className="flex items-stretch gap-3 p-4 sm:p-5">
                <button
                  type="button"
                  onClick={() => onToggleBadge(badge.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] border border-white bg-white shadow-sm">
                    <img
                      src={getBadgeArtworkUrl(badge)}
                      alt={badge.name}
                      className="h-12 w-auto object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">{badge.name}</div>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.isActive !== false ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        {badge.isActive !== false ? '활성' : '비활성'}
                      </span>
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {badgeScopeLabels[badge.evaluationScope ?? 'season']}
                      </span>
                    </div>
                    <div className="mt-2 line-clamp-1 text-sm leading-6 text-slate-600">{badge.description}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        정렬 {badge.sortOrder ?? 100}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                        획득 {badgeAwardCounts[badge.id] ?? 0}명
                      </span>
                    </div>
                  </div>
                  <div className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-transform ${openBadgeId === badge.id ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} />
                  </div>
                </button>
                <div className="flex shrink-0 gap-2 self-start">
                  <button
                    type="button"
                    onClick={() => onEditBadge(badge)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    title="배지 수정"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteBadge(badge.id)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    title="배지 삭제"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {openBadgeId === badge.id && (
                <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm font-semibold text-slate-900">배지 설명</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">{badge.description}</div>
                    </div>
                    <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-sm font-semibold text-slate-900">획득 조건</div>
                      <div className="mt-2 text-sm leading-6 text-slate-600">
                        {getBadgeCriteriaSummary(badge.criteria, badge.evaluationScope)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);
