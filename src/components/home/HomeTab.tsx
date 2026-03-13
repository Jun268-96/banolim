import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, CalendarClock, Sparkles, UserRound, Zap } from 'lucide-react';
import type { ActivityLog, AnnouncementItem, ScheduleEventItem, SeasonSummary } from '../../types';
import { getAnnouncements, getCurrentSeason, getLogs, getScheduleEvents } from '../../lib/db';
import { useAuth } from '../auth/auth-context';
import type { TabType } from '../layout/Sidebar';
import { AppDialog } from '../shared/AppDialog';

interface HomeTabProps {
    onNavigate: (tab: TabType) => void;
}

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigate }) => {
    const { permissions } = useAuth();
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);
    const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
    const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const [seasonData, logData, announcementData, scheduleData] = await Promise.all([
                getCurrentSeason(),
                getLogs(),
                getAnnouncements(),
                getScheduleEvents(),
            ]);
            setSeason(seasonData);
            setLogs(logData);
            setAnnouncements(announcementData);
            setScheduleEvents(scheduleData);
            setIsLoading(false);
        };

        void loadData();
    }, []);

    const recentLogs = useMemo(
        () => logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed').slice(0, 6),
        [logs],
    );

    const quickActions = [
        permissions.canViewActivities
            ? {
                  id: 'activities' as const,
                  label: '출석 세션 열기',
                  description: '정기모임 출석을 바로 열고 상태를 기록합니다.',
                  icon: Zap,
              }
            : null,
        permissions.canViewActivities
            ? {
                  id: 'activities' as const,
                  label: '기록 세션 열기',
                  description: '활동 기록을 추가하고 점수를 반영합니다.',
                  icon: Activity,
              }
            : null,
        permissions.canViewMembers
            ? {
                  id: 'dashboard' as const,
                  label: '멤버 관리 열기',
                  description: '계정 발급, 팀 배정, 역할 설정을 관리합니다.',
                  icon: UserRound,
              }
            : null,
    ].filter(Boolean);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100"></div>
                    <div className="font-medium text-indigo-600">홈 대시보드를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 lg:p-8">
                <div className="space-y-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-3">
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-sm font-medium text-sky-700">
                                <Sparkles size={15} />
                                운영 홈
                            </div>
                            <div>
                                <div className="text-sm font-medium text-slate-500">현재 시즌</div>
                                <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
                                    {season?.name ?? '활성 시즌 없음'}
                                </h2>
                                <p className="mt-2 max-w-2xl text-base text-slate-600">
                                    홈에서는 지금 해야 할 작업과 최근 변화를 간단히 보고, 필요한 화면으로 바로 이동합니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setIsAnnouncementDialogOpen(true)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <Bell size={16} className="text-indigo-600" />
                                공지
                                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">{announcements.length}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsScheduleDialogOpen(true)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <CalendarClock size={16} className="text-sky-600" />
                                일정
                                <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-700">{scheduleEvents.length}</span>
                            </button>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-white/70 bg-white/80 p-5">
                        <div className="text-sm font-medium text-slate-500">오늘 할 일</div>
                        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                            {quickActions.map((action) => {
                                if (!action) {
                                    return null;
                                }

                                const Icon = action.icon;

                                return (
                                    <button
                                        key={action.id + action.label}
                                        type="button"
                                        onClick={() => onNavigate(action.id)}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
                                    >
                                        <Icon size={18} className="text-indigo-600" />
                                        <div className="mt-4 font-semibold text-slate-900">{action.label}</div>
                                        <div className="mt-1 text-sm text-slate-500">{action.description}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
                <div className="space-y-6">
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <div className="font-semibold text-slate-900">최근 활동</div>
                                <div className="mt-1 text-sm text-slate-500">방금 기록된 내용만 빠르게 확인합니다.</div>
                            </div>
                            {permissions.canViewActivities && (
                                <button
                                    type="button"
                                    onClick={() => onNavigate('activities')}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                    활동 보기
                                </button>
                            )}
                        </div>
                        <div className="divide-y divide-slate-100">
                            {recentLogs.map((log) => (
                                <div key={log.id} className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {log.memberName ?? log.memberId}
                                            <span className="font-normal text-slate-400"> · </span>
                                            {log.categoryName ?? log.categoryId}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{log.note || log.reason || '메모 없음'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-semibold ${log.pointDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {log.pointDelta > 0 ? '+' : ''}
                                            {log.pointDelta}점
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{formatDateTime(log.timestamp)}</div>
                                    </div>
                                </div>
                            ))}
                            {recentLogs.length === 0 && (
                                <div className="px-6 py-12 text-center text-slate-500">아직 활동 기록이 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="font-semibold text-slate-900">최근 공지</div>
                        <div className="mt-1 text-sm text-slate-500">운영상 확인해야 할 안내만 간단히 봅니다.</div>
                        <div className="mt-5 space-y-3">
                            {announcements.slice(0, 3).map((announcement) => (
                                <button
                                    key={announcement.id}
                                    type="button"
                                    onClick={() => setIsAnnouncementDialogOpen(true)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-slate-100"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="font-medium text-slate-900">{announcement.title}</div>
                                        {announcement.isPinned && (
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                                                고정
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 line-clamp-2 text-sm text-slate-500">{announcement.body}</div>
                                </button>
                            ))}
                            {announcements.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                                    현재 공지가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="font-semibold text-slate-900">다가오는 일정</div>
                        <div className="mt-1 text-sm text-slate-500">오늘과 이번 주 일정만 빠르게 확인합니다.</div>
                        <div className="mt-5 space-y-3">
                            {scheduleEvents.slice(0, 3).map((event) => (
                                <button
                                    key={event.id}
                                    type="button"
                                    onClick={() => setIsScheduleDialogOpen(true)}
                                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left transition-colors hover:bg-slate-100"
                                >
                                    <div className="font-medium text-slate-900">{event.title}</div>
                                    <div className="mt-2 text-sm text-slate-500">
                                        {formatDateTime(event.startAt)}
                                        {event.location ? ` · ${event.location}` : ''}
                                    </div>
                                </button>
                            ))}
                            {scheduleEvents.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                                    예정된 일정이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <AppDialog
                isOpen={isAnnouncementDialogOpen}
                title="공지"
                description="운영진이 등록한 최신 안내를 모아서 확인합니다."
                size="lg"
                onClose={() => setIsAnnouncementDialogOpen(false)}
            >
                <div className="space-y-4">
                    {announcements.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                            현재 열려 있는 공지가 없습니다.
                        </div>
                    ) : (
                        announcements.map((announcement) => (
                            <article key={announcement.id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <div className="text-lg font-bold text-slate-900">{announcement.title}</div>
                                        <div className="mt-2 text-sm leading-7 text-slate-600">{announcement.body}</div>
                                    </div>
                                    {announcement.isPinned && (
                                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                                            고정
                                        </span>
                                    )}
                                </div>
                                <div className="mt-4 text-xs text-slate-500">게시일 {formatDateTime(announcement.createdAt)}</div>
                            </article>
                        ))
                    )}
                </div>
            </AppDialog>

            <AppDialog
                isOpen={isScheduleDialogOpen}
                title="다가오는 일정"
                description="예정된 모임과 운영 일정을 일정별로 확인합니다."
                size="lg"
                onClose={() => setIsScheduleDialogOpen(false)}
            >
                <div className="space-y-4">
                    {scheduleEvents.length === 0 ? (
                        <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                            예정된 일정이 없습니다.
                        </div>
                    ) : (
                        scheduleEvents.map((event) => (
                            <article key={event.id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                                <div className="text-lg font-bold text-slate-900">{event.title}</div>
                                {event.description && <div className="mt-2 text-sm leading-7 text-slate-600">{event.description}</div>}
                                <div className="mt-4 space-y-1 text-sm text-slate-500">
                                    <div>{formatDateTime(event.startAt)}{event.endAt ? ` ~ ${formatDateTime(event.endAt)}` : ''}</div>
                                    {event.location && <div>{event.location}</div>}
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </AppDialog>
        </div>
    );
};
