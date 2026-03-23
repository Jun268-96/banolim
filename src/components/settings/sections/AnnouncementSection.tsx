import React from 'react';
import { Megaphone, Trash2 } from 'lucide-react';
import type { AnnouncementItem } from '../../../types';
import { EmptyState, SectionHeader } from '../SettingsSectionPrimitives';

interface AnnouncementSectionProps {
  announcements: AnnouncementItem[];
  onCreateAnnouncement: () => void;
  onDeleteAnnouncement: (announcementId: string) => void;
}

export const AnnouncementSection: React.FC<AnnouncementSectionProps> = ({
  announcements,
  onCreateAnnouncement,
  onDeleteAnnouncement,
}) => (
  <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
    <SectionHeader
      icon={<Megaphone size={18} className="text-indigo-600" />}
      title="공지 관리"
      description="홈과 내 상태 화면에 보일 운영 공지를 등록하고 노출 기간을 관리합니다."
      actionLabel="공지 등록"
      onAction={onCreateAnnouncement}
    />
    <div className="space-y-3 p-5 sm:p-6">
      {announcements.length === 0 ? (
        <EmptyState message="아직 등록된 공지가 없습니다." />
      ) : (
        announcements.map((announcement) => (
          <div key={announcement.id} className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-semibold text-slate-900">{announcement.title}</div>
                  {announcement.isPinned && (
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      고정
                    </span>
                  )}
                </div>
                <div className="mt-2 text-sm leading-6 text-slate-600">{announcement.body}</div>
                <div className="mt-3 text-xs text-slate-500">
                  {announcement.startAt ? `노출 시작 ${announcement.startAt}` : '즉시 노출'}
                  {announcement.endAt ? ` · 종료 ${announcement.endAt}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onDeleteAnnouncement(announcement.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                title="공지 숨기기"
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
