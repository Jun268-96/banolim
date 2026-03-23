import React from 'react';
import { CalendarDays } from 'lucide-react';
import type { SeasonStatus, SeasonSummary } from '../../../types';
import { EmptyState, SectionHeader } from '../SettingsSectionPrimitives';

interface SeasonSectionProps {
  seasons: SeasonSummary[];
  seasonStatusLabels: Record<SeasonStatus, string>;
  badgeClassByStatus: Record<SeasonStatus, string>;
  onCreateSeason: () => void;
}

export const SeasonSection: React.FC<SeasonSectionProps> = ({
  seasons,
  seasonStatusLabels,
  badgeClassByStatus,
  onCreateSeason,
}) => (
  <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
    <SectionHeader
      icon={<CalendarDays size={18} className="text-indigo-600" />}
      title="시즌 관리"
      description="현재 운영 중인 시즌과 예정 시즌을 분리해 활동, 리캡, 출석 세션을 연결합니다."
      actionLabel="새 시즌 추가"
      onAction={onCreateSeason}
    />
    <div className="p-5 sm:p-6">
      {seasons.length === 0 ? (
        <EmptyState message="아직 등록된 시즌이 없습니다." />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {seasons.map((season) => (
            <div key={season.id} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">{season.name}</div>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClassByStatus[season.status]}`}>
                  {seasonStatusLabels[season.status]}
                </span>
              </div>
              <div className="mt-3 text-sm text-slate-500">
                {season.startDate} ~ {season.endDate || '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </section>
);
