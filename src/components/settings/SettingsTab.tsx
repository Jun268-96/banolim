import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, ImagePlus, Megaphone, Medal, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import type {
    AnnouncementItem,
    Badge,
    BadgeCriteria,
    BadgeEvaluationScope,
    BadgeTone,
    BadgeUpsertInput,
    MemberBadge,
    ScheduleEventItem,
    SeasonDataResetResult,
    SeasonStatus,
    SeasonSummary,
    SiteBanner,
} from '../../types';
import {
    addBadge,
    addAnnouncement,
    addScheduleEvent,
    addSiteBanner,
    addSeason,
    deleteBadge,
    deleteAnnouncement,
    deleteSiteBanner,
    deleteScheduleEvent,
    getAnnouncements,
    getBadges,
    getMemberBadges,
    getScheduleEvents,
    getSeasons,
    getSiteBanners,
    moveSiteBanner,
    resetActivityDataCurrentSeason,
    resetAttendanceDataCurrentSeason,
    resetManualActivityDataCurrentSeason,
    updateBadge,
} from '../../lib/db';
import {
    badgeArtworkOptions,
    badgeScopeLabels,
    badgeToneLabels,
    emptyBadgeCriteria,
    getBadgeArtworkUrl,
    getBadgeCriteriaSummary,
    normalizeBadgeCode,
} from '../../lib/badges';
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

type SettingsDialogType = 'season' | 'announcement' | 'schedule' | 'banner' | null;
type DataResetAction = 'activity' | 'attendance' | 'manual';
type BadgeDialogMode = 'create' | 'edit';

const createEmptyBadgeDraft = (): BadgeUpsertInput => ({
    code: '',
    name: '',
    description: '',
    iconKey: badgeArtworkOptions[0]?.key ?? 'bandi-core',
    imageUrl: null,
    tone: 'sky',
    evaluationScope: 'season',
    criteria: emptyBadgeCriteria(),
    sortOrder: 100,
    isActive: true,
});

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

const dataResetConfig: Record<DataResetAction, {
    title: string;
    description: string;
    confirmationText: string;
}> = {
    activity: {
        title: '활동 내역 초기화',
        description: '현재 시즌의 활동 기록, 포인트 원장, 정정 요청, 리캡 저장본을 비웁니다.',
        confirmationText: '활동 내역 초기화',
    },
    attendance: {
        title: '출석 세션 초기화',
        description: '현재 시즌의 출석 세션, 출석 대상자, 출석 규칙 기반 활동 기록과 리캡 저장본을 비웁니다.',
        confirmationText: '출석 세션 초기화',
    },
    manual: {
        title: '기록 세션 초기화',
        description: '현재 시즌의 일반 활동 기록만 비우고 출석 기록은 유지합니다. 리캡 저장본은 함께 제거됩니다.',
        confirmationText: '기록 세션 초기화',
    },
};

export const SettingsTab: React.FC = () => {
    const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);
    const [siteBanners, setSiteBanners] = useState<SiteBanner[]>([]);
    const [badges, setBadges] = useState<Badge[]>([]);
    const [memberBadges, setMemberBadges] = useState<MemberBadge[]>([]);

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

    const [newBannerTitle, setNewBannerTitle] = useState('');
    const [newBannerUrl, setNewBannerUrl] = useState('');
    const [newBannerFileName, setNewBannerFileName] = useState('');
    const [newBannerFileData, setNewBannerFileData] = useState<string | null>(null);

    const [activeDialog, setActiveDialog] = useState<SettingsDialogType>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [badgeDialogMode, setBadgeDialogMode] = useState<BadgeDialogMode>('create');
    const [isBadgeDialogOpen, setIsBadgeDialogOpen] = useState(false);
    const [editingBadgeId, setEditingBadgeId] = useState<string | null>(null);
    const [badgeIdPendingDelete, setBadgeIdPendingDelete] = useState<string | null>(null);
    const [openBadgeId, setOpenBadgeId] = useState<string | null>(null);
    const [badgeDraft, setBadgeDraft] = useState<BadgeUpsertInput>(createEmptyBadgeDraft());
    const [badgeImageFileName, setBadgeImageFileName] = useState('');
    const [isSavingBadge, setIsSavingBadge] = useState(false);
    const [isDeletingBadge, setIsDeletingBadge] = useState(false);
    const [pendingResetAction, setPendingResetAction] = useState<DataResetAction | null>(null);
    const [resetConfirmationInput, setResetConfirmationInput] = useState('');
    const [isResettingData, setIsResettingData] = useState(false);
    const [resetStatus, setResetStatus] = useState<string | null>(null);

    const refreshData = async () => {
        setIsLoading(true);
        const [seasonsData, announcementsData, scheduleData, bannersData, badgesData, memberBadgeData] = await Promise.all([
            getSeasons(),
            getAnnouncements(),
            getScheduleEvents(),
            getSiteBanners(),
            getBadges({ includeInactive: true }),
            getMemberBadges(),
        ]);
        setSeasons(seasonsData);
        setAnnouncements(announcementsData);
        setScheduleEvents(scheduleData);
        setSiteBanners(bannersData);
        setBadges(badgesData);
        setMemberBadges(memberBadgeData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [seasonsData, announcementsData, scheduleData, bannersData, badgesData, memberBadgeData] = await Promise.all([
                getSeasons(),
                getAnnouncements(),
                getScheduleEvents(),
                getSiteBanners(),
                getBadges({ includeInactive: true }),
                getMemberBadges(),
            ]);

            if (!isMounted) {
                return;
            }

            setSeasons(seasonsData);
            setAnnouncements(announcementsData);
            setScheduleEvents(scheduleData);
            setSiteBanners(bannersData);
            setBadges(badgesData);
            setMemberBadges(memberBadgeData);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    const activeSeason = [...seasons]
        .filter((season) => season.status === 'active')
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
    const badgeAwardCounts = memberBadges.reduce<Record<string, number>>((acc, badge) => {
        acc[badge.badgeId] = (acc[badge.badgeId] ?? 0) + 1;
        return acc;
    }, {});
    const badgePendingDelete = badges.find((badge) => badge.id === badgeIdPendingDelete) ?? null;

    const resetBannerDraft = () => {
        setNewBannerTitle('');
        setNewBannerUrl('');
        setNewBannerFileName('');
        setNewBannerFileData(null);
    };

    const resetBadgeDialog = () => {
        setIsBadgeDialogOpen(false);
        setEditingBadgeId(null);
        setBadgeDialogMode('create');
        setBadgeDraft(createEmptyBadgeDraft());
        setBadgeImageFileName('');
    };

    const resetResetDialog = () => {
        setPendingResetAction(null);
        setResetConfirmationInput('');
    };

    const openCreateBadgeDialog = () => {
        setBadgeDialogMode('create');
        setEditingBadgeId(null);
        setBadgeDraft(createEmptyBadgeDraft());
        setBadgeImageFileName('');
        setIsBadgeDialogOpen(true);
    };

    const openEditBadgeDialog = (badge: Badge) => {
        setBadgeDialogMode('edit');
        setEditingBadgeId(badge.id);
        setBadgeDraft({
            code: badge.code,
            name: badge.name,
            description: badge.description,
            iconKey: badge.iconKey,
            imageUrl: badge.imageUrl ?? null,
            tone: badge.tone ?? 'sky',
            evaluationScope: badge.evaluationScope ?? 'season',
            criteria: { ...(badge.criteria ?? emptyBadgeCriteria()) },
            sortOrder: badge.sortOrder ?? 100,
            isActive: badge.isActive !== false,
        });
        setBadgeImageFileName('');
        setIsBadgeDialogOpen(true);
    };

    const handleBadgeImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setBadgeImageFileName('');
            return;
        }

        setBadgeImageFileName(file.name);

        const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                    return;
                }

                reject(new Error('배지 이미지를 읽지 못했습니다.'));
            };
            reader.onerror = () => reject(new Error('배지 이미지를 읽지 못했습니다.'));
            reader.readAsDataURL(file);
        });

        setBadgeDraft((current) => ({
            ...current,
            imageUrl: fileData,
        }));
    };

    const handleBadgeNameChange = (value: string) => {
        setBadgeDraft((current) => {
            const trimmedName = value.trim();
            const previousNormalizedName = normalizeBadgeCode(current.name);
            const shouldSyncCode = badgeDialogMode === 'create' && (!current.code || current.code === previousNormalizedName);

            return {
                ...current,
                name: value,
                code: shouldSyncCode ? normalizeBadgeCode(trimmedName) : current.code,
            };
        });
    };

    const handleBadgeCriteriaChange = (key: keyof BadgeCriteria, value: string) => {
        const parsed = Number.parseInt(value, 10);

        setBadgeDraft((current) => ({
            ...current,
            criteria: {
                ...current.criteria,
                [key]: Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
            },
        }));
    };

    const clearBadgeCustomImage = () => {
        setBadgeDraft((current) => ({
            ...current,
            imageUrl: null,
        }));
        setBadgeImageFileName('');
    };

    const formatResetStatus = (action: DataResetAction, result: SeasonDataResetResult) => {
        if (action === 'attendance') {
            return `${result.seasonName}: 출석 세션 ${result.attendanceSessionCount ?? 0}개, 대상 ${result.attendanceSessionMemberCount ?? 0}명, 활동 ${result.activityRecordCount}건 초기화`;
        }

        return `${result.seasonName}: 활동 ${result.activityRecordCount}건, 포인트 ${result.pointLedgerCount}건 초기화`;
    };

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

    const handleBannerFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            setNewBannerFileName('');
            setNewBannerFileData(null);
            return;
        }

        setNewBannerFileName(file.name);

        const fileData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                if (typeof reader.result === 'string') {
                    resolve(reader.result);
                    return;
                }

                reject(new Error('이미지 파일을 읽지 못했습니다.'));
            };
            reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
            reader.readAsDataURL(file);
        });

        setNewBannerFileData(fileData);
    };

    const handleAddBanner = async (event: React.FormEvent) => {
        event.preventDefault();
        const imageUrl = newBannerFileData ?? newBannerUrl.trim();
        if (!imageUrl) return;

        await addSiteBanner({
            title: newBannerTitle.trim() || null,
            imageUrl,
        });

        resetBannerDraft();
        await refreshData();
    };

    const handleMoveBanner = async (id: string, direction: 'up' | 'down') => {
        await moveSiteBanner(id, direction);
        await refreshData();
    };

    const handleDeleteBanner = async (id: string) => {
        if (!confirm('이 배너를 숨길까요?')) return;
        await deleteSiteBanner(id);
        await refreshData();
    };

    const handleSaveBadge = async () => {
        setIsSavingBadge(true);

        try {
            if (badgeDialogMode === 'edit' && editingBadgeId) {
                await updateBadge(editingBadgeId, badgeDraft);
            } else {
                await addBadge(badgeDraft);
            }

            await refreshData();
            resetBadgeDialog();
        } catch (error) {
            alert(error instanceof Error ? error.message : '배지를 저장하지 못했습니다.');
        } finally {
            setIsSavingBadge(false);
        }
    };

    const handleDeleteBadge = async () => {
        if (!badgePendingDelete) {
            return;
        }

        setIsDeletingBadge(true);

        try {
            await deleteBadge(badgePendingDelete.id);
            await refreshData();
            setBadgeIdPendingDelete(null);
        } catch (error) {
            alert(error instanceof Error ? error.message : '배지를 삭제하지 못했습니다.');
        } finally {
            setIsDeletingBadge(false);
        }
    };

    const handleExecuteDataReset = async () => {
        if (!pendingResetAction) {
            return;
        }

        const config = dataResetConfig[pendingResetAction];
        if (resetConfirmationInput.trim() !== config.confirmationText) {
            return;
        }

        setIsResettingData(true);

        try {
            const result = pendingResetAction === 'activity'
                ? await resetActivityDataCurrentSeason()
                : pendingResetAction === 'attendance'
                    ? await resetAttendanceDataCurrentSeason()
                    : await resetManualActivityDataCurrentSeason();

            setResetStatus(formatResetStatus(pendingResetAction, result));
            await refreshData();
            resetResetDialog();
        } catch (error) {
            alert(error instanceof Error ? error.message : '데이터를 초기화하지 못했습니다.');
        } finally {
            setIsResettingData(false);
        }
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
            <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                        <Settings className="text-indigo-600" />
                        운영 설정
                    </h2>
                    <p className="mt-1 text-slate-500">시즌, 공지, 일정과 상단 배너를 관리합니다.</p>
                </div>
                <button
                    type="button"
                    onClick={() => setActiveDialog('banner')}
                    className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                >
                    <ImagePlus size={16} />
                    배너 변경
                </button>
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

            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                    icon={<Medal size={18} className="text-indigo-600" />}
                    title="배지 관리"
                    description="배지 규칙, 디자인, 노출 상태를 관리합니다. 탭에서는 조회만 하고 실제 편집은 모달에서 진행합니다."
                    actionLabel="배지 추가"
                    onAction={openCreateBadgeDialog}
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
                                            onClick={() => setOpenBadgeId((current) => (current === badge.id ? null : badge.id))}
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
                                                onClick={() => openEditBadgeDialog(badge)}
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                                                title="배지 수정"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setBadgeIdPendingDelete(badge.id)}
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

            <section className="overflow-hidden rounded-[32px] border border-rose-200 bg-white shadow-sm">
                <SectionHeader
                    icon={<Trash2 size={18} className="text-rose-600" />}
                    title="데이터 초기화"
                    description={activeSeason ? `${activeSeason.name} 시즌 기준으로만 초기화됩니다. 실제 삭제는 서버 함수에서 처리됩니다.` : '진행 중인 시즌이 있어야 초기화할 수 있습니다.'}
                />
                <div className="space-y-4 p-5 sm:p-6">
                    <div className="grid gap-4 xl:grid-cols-3">
                        {(Object.entries(dataResetConfig) as Array<[DataResetAction, typeof dataResetConfig[DataResetAction]]>).map(([action, config]) => (
                            <div key={action} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                                <div className="font-semibold text-slate-900">{config.title}</div>
                                <div className="mt-2 text-sm leading-6 text-slate-600">{config.description}</div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingResetAction(action);
                                        setResetConfirmationInput('');
                                    }}
                                    disabled={!activeSeason}
                                    className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                >
                                    {config.title}
                                </button>
                            </div>
                        ))}
                    </div>

                    {resetStatus && (
                        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {resetStatus}
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

            <SettingsDialog
                isOpen={activeDialog === 'banner'}
                onClose={() => {
                    setActiveDialog(null);
                    resetBannerDraft();
                }}
                title="배너 변경"
                description="권장 3200×480 가로 배너입니다. JPG/PNG/WebP 파일을 첨부하거나 이미지 링크를 입력할 수 있습니다."
                size="xl"
            >
                <div className="space-y-6">
                    <form onSubmit={handleAddBanner} className="space-y-5 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                        <div className="text-sm font-semibold text-slate-900">새 배너 추가</div>
                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">배너 제목</span>
                                <input
                                    type="text"
                                    value={newBannerTitle}
                                    onChange={(event) => setNewBannerTitle(event.target.value)}
                                    placeholder="예: 2026 상반기 운영 배너"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-sm font-medium text-slate-700">이미지 링크</span>
                                <input
                                    type="url"
                                    value={newBannerUrl}
                                    onChange={(event) => setNewBannerUrl(event.target.value)}
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
                                onChange={(event) => void handleBannerFileChange(event)}
                                className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600 file:mr-3 file:rounded-xl file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                            <p className="text-xs text-slate-500">
                                {newBannerFileName ? `선택된 파일: ${newBannerFileName}` : '권장 비율은 가로 20:3(예: 3200×480)입니다. 1600×480 이미지는 좌우 여백이 남을 수 있습니다.'}
                            </p>
                        </label>

                        {(newBannerFileData || newBannerUrl.trim()) && (
                            <div className="overflow-hidden rounded-[24px] bg-slate-950">
                                <img
                                    src={newBannerFileData ?? newBannerUrl}
                                    alt="배너 미리보기"
                                    className="h-40 w-full object-cover object-center"
                                />
                            </div>
                        )}

                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetBannerDraft}
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
                                                    onClick={() => void handleMoveBanner(banner.id, 'up')}
                                                    disabled={index === 0}
                                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ArrowUp size={16} />
                                                    위로
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleMoveBanner(banner.id, 'down')}
                                                    disabled={index === siteBanners.length - 1}
                                                    className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    <ArrowDown size={16} />
                                                    아래로
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => void handleDeleteBanner(banner.id)}
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

            <SettingsDialog
                isOpen={isBadgeDialogOpen}
                onClose={resetBadgeDialog}
                title={badgeDialogMode === 'edit' ? '배지 수정' : '새 배지 추가'}
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
                                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeTonePreviewClasses[badgeDraft.tone]}`}>
                                        {badgeToneLabels[badgeDraft.tone]}
                                    </span>
                                </div>

                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-slate-700">배지 이름</span>
                                        <input
                                            type="text"
                                            value={badgeDraft.name}
                                            onChange={(event) => handleBadgeNameChange(event.target.value)}
                                            placeholder="예: 발표 마에스트로"
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-slate-700">배지 코드</span>
                                        <input
                                            type="text"
                                            value={badgeDraft.code}
                                            onChange={(event) => setBadgeDraft((current) => ({
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
                                            value={badgeDraft.tone}
                                            onChange={(event) => setBadgeDraft((current) => ({
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
                                            value={badgeDraft.sortOrder}
                                            onChange={(event) => setBadgeDraft((current) => ({
                                                ...current,
                                                sortOrder: Number.parseInt(event.target.value, 10) || 0,
                                            }))}
                                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-sm font-medium text-slate-700">평가 범위</span>
                                        <select
                                            value={badgeDraft.evaluationScope}
                                            onChange={(event) => setBadgeDraft((current) => ({
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
                                            checked={badgeDraft.isActive}
                                            onChange={(event) => setBadgeDraft((current) => ({
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
                                        value={badgeDraft.description}
                                        onChange={(event) => setBadgeDraft((current) => ({
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
                                                value={badgeDraft.criteria[field.key] ?? ''}
                                                onChange={(event) => handleBadgeCriteriaChange(field.key, event.target.value)}
                                                placeholder="0"
                                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            />
                                            <div className="text-xs leading-5 text-slate-500">{field.hint}</div>
                                        </label>
                                    ))}
                                </div>

                                <div className="mt-4 rounded-[22px] border border-indigo-200 bg-indigo-50 px-4 py-4 text-sm leading-6 text-indigo-900">
                                    {getBadgeCriteriaSummary(badgeDraft.criteria, badgeDraft.evaluationScope)}
                                </div>
                            </section>

                            <section className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                                <div>
                                    <div className="text-sm font-semibold text-slate-900">디자인</div>
                                    <div className="mt-1 text-sm text-slate-500">프리셋 일러스트를 고르거나, 직접 만든 이미지를 URL 또는 파일로 넣을 수 있습니다.</div>
                                </div>

                                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                    {badgeArtworkOptions.map((option) => {
                                        const isSelected = badgeDraft.iconKey === option.key && !badgeDraft.imageUrl;
                                        return (
                                            <button
                                                key={option.key}
                                                type="button"
                                                onClick={() => {
                                                    setBadgeDraft((current) => ({
                                                        ...current,
                                                        iconKey: option.key,
                                                        imageUrl: null,
                                                    }));
                                                    setBadgeImageFileName('');
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
                                            value={badgeDraft.imageUrl?.startsWith('data:') ? '' : badgeDraft.imageUrl ?? ''}
                                            onChange={(event) => {
                                                const nextValue = event.target.value.trim();
                                                setBadgeImageFileName('');
                                                setBadgeDraft((current) => ({
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
                                            onChange={(event) => void handleBadgeImageFileChange(event)}
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
                                        onClick={clearBadgeCustomImage}
                                        className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                    >
                                        커스텀 이미지 제거
                                    </button>
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                                        현재 디자인 소스 · {badgeDraft.imageUrl ? '커스텀 이미지' : `프리셋 ${badgeDraft.iconKey}`}
                                    </div>
                                </div>
                            </section>
                        </div>

                        <aside className="space-y-4">
                            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Badge Preview</div>
                                <div className="mt-5 rounded-[28px] border border-white/10 bg-white/5 p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeTonePreviewClasses[badgeDraft.tone]}`}>
                                            {badgeToneLabels[badgeDraft.tone]}
                                        </div>
                                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                                            {badgeScopeLabels[badgeDraft.evaluationScope]}
                                        </div>
                                    </div>
                                    <div className="mt-5 flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-white/10">
                                        <img
                                            src={getBadgeArtworkUrl(badgeDraft)}
                                            alt={badgeDraft.name || '배지 미리보기'}
                                            className="h-16 w-auto object-contain"
                                        />
                                    </div>
                                    <div className="mt-5 text-xl font-semibold text-white">{badgeDraft.name || '새 배지 이름'}</div>
                                    <div className="mt-2 text-sm leading-6 text-slate-300">
                                        {badgeDraft.description || '여기에 배지 설명이 표시됩니다.'}
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                                            {badgeDraft.code || 'badge_code'}
                                        </span>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                                            정렬 {badgeDraft.sortOrder}
                                        </span>
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badgeDraft.isActive ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-slate-500/30 bg-slate-400/10 text-slate-300'}`}>
                                            {badgeDraft.isActive ? '활성' : '비활성'}
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
                            onClick={resetBadgeDialog}
                            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button
                            type="button"
                            onClick={() => void handleSaveBadge()}
                            disabled={isSavingBadge}
                            className="inline-flex h-11 items-center justify-center rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {isSavingBadge ? '저장 중...' : badgeDialogMode === 'edit' ? '배지 저장' : '배지 생성'}
                        </button>
                    </div>
                </div>
            </SettingsDialog>

            <SettingsDialog
                isOpen={Boolean(badgePendingDelete)}
                onClose={() => setBadgeIdPendingDelete(null)}
                title="배지 삭제"
                description="삭제한 배지는 회원 획득 이력에서도 함께 제거됩니다."
                size="md"
            >
                {badgePendingDelete && (
                    <div className="space-y-5">
                        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                            {badgePendingDelete.name} 배지를 삭제하면 현재 배지를 보유한 회원 {badgeAwardCounts[badgePendingDelete.id] ?? 0}명의 기록에서도 함께 사라집니다.
                            이 작업은 되돌릴 수 없습니다.
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="flex items-center gap-4">
                                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white bg-white shadow-sm">
                                    <img
                                        src={getBadgeArtworkUrl(badgePendingDelete)}
                                        alt={badgePendingDelete.name}
                                        className="h-12 w-auto object-contain"
                                    />
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-900">{badgePendingDelete.name}</div>
                                    <div className="mt-1 text-sm text-slate-500">{badgePendingDelete.description}</div>
                                    <div className="mt-2 text-xs text-slate-500">
                                        {getBadgeCriteriaSummary(badgePendingDelete.criteria, badgePendingDelete.evaluationScope)}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setBadgeIdPendingDelete(null)}
                                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleDeleteBadge()}
                                disabled={isDeletingBadge}
                                className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {isDeletingBadge ? '삭제 중...' : '배지 삭제'}
                            </button>
                        </div>
                    </div>
                )}
            </SettingsDialog>

            <SettingsDialog
                isOpen={Boolean(pendingResetAction)}
                onClose={resetResetDialog}
                title={pendingResetAction ? dataResetConfig[pendingResetAction].title : '데이터 초기화'}
                description={pendingResetAction ? dataResetConfig[pendingResetAction].description : undefined}
                size="md"
            >
                {pendingResetAction && (
                    <div className="space-y-5">
                        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                            현재 시즌 기준으로만 삭제되며, 실행 뒤에는 되돌릴 수 없습니다. 감사 로그는 서버에서 별도로 남깁니다.
                        </div>
                        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                            <div className="text-sm font-semibold text-slate-900">확인 문구 입력</div>
                            <div className="mt-2 text-sm text-slate-600">
                                아래 문구를 정확히 입력해야 실행할 수 있습니다:
                                <span className="ml-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                    {dataResetConfig[pendingResetAction].confirmationText}
                                </span>
                            </div>
                            <input
                                type="text"
                                value={resetConfirmationInput}
                                onChange={(event) => setResetConfirmationInput(event.target.value)}
                                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                                placeholder={dataResetConfig[pendingResetAction].confirmationText}
                            />
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetResetDialog}
                                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleExecuteDataReset()}
                                disabled={isResettingData || resetConfirmationInput.trim() !== dataResetConfig[pendingResetAction].confirmationText}
                                className="inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {isResettingData ? '초기화 중...' : '초기화 실행'}
                            </button>
                        </div>
                    </div>
                )}
            </SettingsDialog>
        </div>
    );
};
