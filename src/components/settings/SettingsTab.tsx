import React, { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, Plus, Settings, Trash2 } from 'lucide-react';
import type { AnnouncementItem, ScheduleEventItem, SeasonStatus, SeasonSummary } from '../../types';
import {
    addAnnouncement,
    addScheduleEvent,
    addSeason,
    deleteAnnouncement,
    deleteScheduleEvent,
    getAnnouncements,
    getScheduleEvents,
    getSeasons,
} from '../../lib/db';
import { SettingsDialog } from './SettingsDialog';

const seasonStatusOptions: SeasonStatus[] = ['planned', 'active', 'closed'];
const seasonStatusLabels: Record<SeasonStatus, string> = {
    planned: '예정',
    active: '진행 중',
    closed: '종료',
};

const badgeClassByStatus: Record<SeasonStatus, string> = {
    planned: 'bg-amber-50 text-amber-700 border-amber-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
};

type SettingsDialogType = 'season' | 'announcement' | 'schedule' | null;

interface SectionHeaderProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, description, actionLabel, onAction }) => (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
            <div className="flex items-center gap-2 text-slate-900">
                {icon}
                <h3 className="text-lg font-semibold">{title}</h3>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        </div>
        {actionLabel && onAction && (
            <button
                type="button"
                onClick={onAction}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
            >
                <Plus size={16} />
                {actionLabel}
            </button>
        )}
    </div>
);

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="rounded-[28px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
        {message}
    </div>
);

export const SettingsTab: React.FC = () => {
    const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);

    const [newSeasonName, setNewSeasonName] = useState('');
    const [newSeasonStartDate, setNewSeasonStartDate] = useState('');
    const [newSeasonEndDate, setNewSeasonEndDate] = useState('');
    const [newSeasonStatus, setNewSeasonStatus] = useState<SeasonStatus>('planned');

    const [newAnnouncementTitle, setNewAnnouncementTitle] = useState('');
    const [newAnnouncementBody, setNewAnnouncementBody] = useState('');
    const [newAnnouncementStartAt, setNewAnnouncementStartAt] = useState('');
    const [newAnnouncementEndAt, setNewAnnouncementEndAt] = useState('');
    const [newAnnouncementPinned, setNewAnnouncementPinned] = useState(true);

    const [newScheduleTitle, setNewScheduleTitle] = useState('');
    const [newScheduleDescription, setNewScheduleDescription] = useState('');
    const [newScheduleLocation, setNewScheduleLocation] = useState('');
    const [newScheduleStartAt, setNewScheduleStartAt] = useState('');
    const [newScheduleEndAt, setNewScheduleEndAt] = useState('');
    const [newScheduleSeasonId, setNewScheduleSeasonId] = useState('');

    const [activeDialog, setActiveDialog] = useState<SettingsDialogType>(null);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = async () => {
        setIsLoading(true);
        const [seasonsData, announcementsData, scheduleData] = await Promise.all([
            getSeasons(),
            getAnnouncements(),
            getScheduleEvents(),
        ]);
        setSeasons(seasonsData);
        setAnnouncements(announcementsData);
        setScheduleEvents(scheduleData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [seasonsData, announcementsData, scheduleData] = await Promise.all([
                getSeasons(),
                getAnnouncements(),
                getScheduleEvents(),
            ]);

            if (!isMounted) {
                return;
            }

            setSeasons(seasonsData);
            setAnnouncements(announcementsData);
            setScheduleEvents(scheduleData);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleAddSeason = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newSeasonName.trim() || !newSeasonStartDate || !newSeasonEndDate) return;

        await addSeason(newSeasonName.trim(), newSeasonStartDate, newSeasonEndDate, newSeasonStatus);
        setNewSeasonName('');
        setNewSeasonStartDate('');
        setNewSeasonEndDate('');
        setNewSeasonStatus('planned');
        setActiveDialog(null);
        await refreshData();
    };

    const handleAddAnnouncement = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newAnnouncementTitle.trim() || !newAnnouncementBody.trim()) return;

        await addAnnouncement({
            title: newAnnouncementTitle,
            body: newAnnouncementBody,
            startAt: newAnnouncementStartAt || null,
            endAt: newAnnouncementEndAt || null,
            isPinned: newAnnouncementPinned,
        });

        setNewAnnouncementTitle('');
        setNewAnnouncementBody('');
        setNewAnnouncementStartAt('');
        setNewAnnouncementEndAt('');
        setNewAnnouncementPinned(true);
        setActiveDialog(null);
        await refreshData();
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (!confirm('이 공지를 비활성화할까요?')) return;
        await deleteAnnouncement(id);
        await refreshData();
    };

    const handleAddScheduleEvent = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newScheduleTitle.trim() || !newScheduleStartAt) return;

        await addScheduleEvent({
            title: newScheduleTitle,
            description: newScheduleDescription,
            location: newScheduleLocation,
            startAt: newScheduleStartAt,
            endAt: newScheduleEndAt || null,
            seasonId: newScheduleSeasonId || null,
        });

        setNewScheduleTitle('');
        setNewScheduleDescription('');
        setNewScheduleLocation('');
        setNewScheduleStartAt('');
        setNewScheduleEndAt('');
        setNewScheduleSeasonId('');
        setActiveDialog(null);
        await refreshData();
    };

    const handleDeleteScheduleEvent = async (id: string) => {
        if (!confirm('이 일정을 숨길까요?')) return;
        await deleteScheduleEvent(id);
        await refreshData();
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex animate-pulse flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100" />
                    <div className="font-medium text-indigo-600">설정을 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            <header>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <Settings className="text-indigo-600" />
                    운영 설정
                </h2>
                <p className="mt-1 text-slate-500">시즌, 공지, 일정을 관리합니다.</p>
            </header>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                    <SectionHeader
                        icon={<Megaphone size={18} className="text-indigo-600" />}
                        title="공지 관리"
                        description="홈과 내 상태 화면에 보일 운영 공지를 등록하고 노출 기간을 관리합니다."
                        actionLabel="공지 등록"
                        onAction={() => setActiveDialog('announcement')}
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
                                                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">고정</span>
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
                                            onClick={() => handleDeleteAnnouncement(announcement.id)}
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

                <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                    <SectionHeader
                        icon={<CalendarDays size={18} className="text-indigo-600" />}
                        title="일정 관리"
                        description="예정된 모임, 제출 마감, 운영 세션을 등록하고 노출 여부를 관리합니다."
                        actionLabel="일정 등록"
                        onAction={() => setActiveDialog('schedule')}
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
                                            onClick={() => handleDeleteScheduleEvent(scheduleEvent.id)}
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
            </div>

            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                    icon={<CalendarDays size={18} className="text-indigo-600" />}
                    title="시즌 관리"
                    description="현재 운영 중인 시즌과 예정 시즌을 분리해 활동, 리캡, 출석 세션을 연결합니다."
                    actionLabel="새 시즌 추가"
                    onAction={() => setActiveDialog('season')}
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

            <SettingsDialog
                isOpen={activeDialog === 'season'}
                onClose={() => setActiveDialog(null)}
                title="새 시즌 추가"
                description="시즌은 통계, 출석 세션, 리캡 저장본의 기준 기간으로 사용됩니다."
                size="lg"
            >
                <form onSubmit={handleAddSeason} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">시즌 이름</span>
                            <input
                                type="text"
                                value={newSeasonName}
                                onChange={(event) => setNewSeasonName(event.target.value)}
                                placeholder="예: 2026 상반기"
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">상태</span>
                            <select
                                value={newSeasonStatus}
                                onChange={(event) => setNewSeasonStatus(event.target.value as SeasonStatus)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {seasonStatusOptions.map((status) => (
                                    <option key={status} value={status}>
                                        {seasonStatusLabels[status]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">시작일</span>
                            <input
                                type="date"
                                value={newSeasonStartDate}
                                onChange={(event) => setNewSeasonStartDate(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">종료일</span>
                            <input
                                type="date"
                                value={newSeasonEndDate}
                                onChange={(event) => setNewSeasonEndDate(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveDialog(null)}
                            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                        >
                            시즌 추가
                        </button>
                    </div>
                </form>
            </SettingsDialog>

            <SettingsDialog
                isOpen={activeDialog === 'announcement'}
                onClose={() => setActiveDialog(null)}
                title="공지 등록"
                description="홈과 내 상태에 노출될 공지를 입력합니다."
                size="lg"
            >
                <form onSubmit={handleAddAnnouncement} className="space-y-5">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">공지 제목</span>
                        <input
                            type="text"
                            value={newAnnouncementTitle}
                            onChange={(event) => setNewAnnouncementTitle(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">공지 내용</span>
                        <textarea
                            value={newAnnouncementBody}
                            onChange={(event) => setNewAnnouncementBody(event.target.value)}
                            rows={5}
                            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">노출 시작</span>
                            <input
                                type="datetime-local"
                                value={newAnnouncementStartAt}
                                onChange={(event) => setNewAnnouncementStartAt(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">노출 종료</span>
                            <input
                                type="datetime-local"
                                value={newAnnouncementEndAt}
                                onChange={(event) => setNewAnnouncementEndAt(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                    </div>

                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <input
                            type="checkbox"
                            checked={newAnnouncementPinned}
                            onChange={(event) => setNewAnnouncementPinned(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-slate-700">상단 고정 공지로 노출</span>
                    </label>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveDialog(null)}
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

            <SettingsDialog
                isOpen={activeDialog === 'schedule'}
                onClose={() => setActiveDialog(null)}
                title="일정 등록"
                description="모임, 세션, 제출 마감 같은 일정은 상세 정보까지 입력하고 시즌과 연결할 수 있습니다."
                size="lg"
            >
                <form onSubmit={handleAddScheduleEvent} className="space-y-5">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">일정 제목</span>
                        <input
                            type="text"
                            value={newScheduleTitle}
                            onChange={(event) => setNewScheduleTitle(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">설명</span>
                        <textarea
                            value={newScheduleDescription}
                            onChange={(event) => setNewScheduleDescription(event.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">시작 일시</span>
                            <input
                                type="datetime-local"
                                value={newScheduleStartAt}
                                onChange={(event) => setNewScheduleStartAt(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">종료 일시</span>
                            <input
                                type="datetime-local"
                                value={newScheduleEndAt}
                                onChange={(event) => setNewScheduleEndAt(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">장소</span>
                            <input
                                type="text"
                                value={newScheduleLocation}
                                onChange={(event) => setNewScheduleLocation(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">연결 시즌</span>
                            <select
                                value={newScheduleSeasonId}
                                onChange={(event) => setNewScheduleSeasonId(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="">시즌 미지정</option>
                                {seasons.map((season) => (
                                    <option key={season.id} value={season.id}>
                                        {season.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveDialog(null)}
                            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                        >
                            일정 등록
                        </button>
                    </div>
                </form>
            </SettingsDialog>
        </div>
    );
};
