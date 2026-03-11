import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarRange, MapPin, Megaphone, Pin } from 'lucide-react';
import type { AnnouncementItem, ScheduleEventItem } from '../../types';

interface NoticeScheduleBoardProps {
    announcements: AnnouncementItem[];
    scheduleEvents: ScheduleEventItem[];
    title?: string;
    description?: string;
    manageLabel?: string;
    onManage?: () => void;
}

const formatDateTime = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
        : '-';

export const NoticeScheduleBoard: React.FC<NoticeScheduleBoardProps> = ({
    announcements,
    scheduleEvents,
    title = '공지와 일정',
    description = '지금 확인해야 할 운영 공지와 예정 일정을 모아봤습니다.',
    manageLabel,
    onManage,
}) => {
    const [now] = useState(() => Date.now());

    const visibleAnnouncements = useMemo(
        () =>
            announcements
                .filter((item) => {
                    if (!item.isActive) return false;
                    if (item.startAt && new Date(item.startAt).getTime() > now) return false;
                    if (item.endAt && new Date(item.endAt).getTime() < now) return false;
                    return true;
                })
                .slice(0, 4),
        [announcements, now],
    );

    const upcomingEvents = useMemo(
        () =>
            scheduleEvents
                .filter((item) => item.isActive && (new Date(item.endAt ?? item.startAt).getTime() >= now))
                .sort((a, b) => a.startAt.localeCompare(b.startAt))
                .slice(0, 4),
        [now, scheduleEvents],
    );

    return (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <div className="font-semibold text-slate-900">{title}</div>
                    <div className="mt-1 text-sm text-slate-500">{description}</div>
                </div>
                {onManage && manageLabel && (
                    <button
                        type="button"
                        onClick={onManage}
                        className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                    >
                        {manageLabel}
                        <ArrowRight size={15} />
                    </button>
                )}
            </div>

            <div className="grid gap-6 p-6 xl:grid-cols-2">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Megaphone size={18} className="text-indigo-600" />
                        공지
                    </div>
                    <div className="space-y-3">
                        {visibleAnnouncements.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-semibold text-slate-900">{item.title}</div>
                                        <div className="mt-2 text-sm leading-6 text-slate-600">{item.body}</div>
                                    </div>
                                    {item.isPinned && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                            <Pin size={12} />
                                            고정
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 text-xs text-slate-500">
                                    게시 기간 {formatDateTime(item.startAt ?? item.createdAt)}
                                    {item.endAt ? ` ~ ${formatDateTime(item.endAt)}` : ''}
                                </div>
                            </div>
                        ))}
                        {visibleAnnouncements.length === 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                현재 노출 중인 공지가 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <CalendarRange size={18} className="text-indigo-600" />
                        다가오는 일정
                    </div>
                    <div className="space-y-3">
                        {upcomingEvents.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="font-semibold text-slate-900">{item.title}</div>
                                {item.description && (
                                    <div className="mt-2 text-sm leading-6 text-slate-600">{item.description}</div>
                                )}
                                <div className="mt-3 text-sm text-indigo-700 font-medium">
                                    {formatDateTime(item.startAt)}
                                    {item.endAt ? ` ~ ${formatDateTime(item.endAt)}` : ''}
                                </div>
                                {item.location && (
                                    <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                                        <MapPin size={13} />
                                        {item.location}
                                    </div>
                                )}
                            </div>
                        ))}
                        {upcomingEvents.length === 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                등록된 예정 일정이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};
