import React from 'react';
import { CalendarDays, Trash2 } from 'lucide-react';
import type { ScheduleEventItem } from '../../../types';
import { EmptyState, SectionHeader } from '../SettingsSectionPrimitives';

interface ScheduleSectionProps {
  scheduleEvents: ScheduleEventItem[];
  onCreateScheduleEvent: () => void;
  onDeleteScheduleEvent: (scheduleEventId: string) => void;
}

export const ScheduleSection: React.FC<ScheduleSectionProps> = ({
  scheduleEvents,
  onCreateScheduleEvent,
  onDeleteScheduleEvent,
}) => (
  <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
    <SectionHeader
      icon={<CalendarDays size={18} className="text-indigo-600" />}
      title="일정 관리"
      description="예정된 모임, 제출 마감, 운영 세션을 등록하고 노출 여부를 관리합니다."
      actionLabel="일정 등록"
      onAction={onCreateScheduleEvent}
    />
    <div className="space-y-3 p-5 sm:p-6">
      {scheduleEvents.length === 0 ? (
        <EmptyState message="아직 등록된 일정이 없습니다." />
      ) : (
        scheduleEvents.map((scheduleEvent) => (
          <div key={scheduleEvent.id} className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{scheduleEvent.title}</div>
                {scheduleEvent.description && (
                  <div className="mt-2 text-sm leading-6 text-slate-600">{scheduleEvent.description}</div>
                )}
                <div className="mt-3 text-xs text-slate-500">
                  {scheduleEvent.startAt}
                  {scheduleEvent.endAt ? ` ~ ${scheduleEvent.endAt}` : ''}
                  {scheduleEvent.location ? ` · ${scheduleEvent.location}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteScheduleEvent(scheduleEvent.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title="일정 숨기기"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </section>
);
