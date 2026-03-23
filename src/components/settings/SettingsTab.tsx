import React, { useState } from 'react';
import { ImagePlus, Settings } from 'lucide-react';
import type {
    Badge,
    BadgeCriteria,
    BadgeUpsertInput,
    SeasonDataResetResult,
    SeasonStatus,
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
    moveSiteBanner,
    resetActivityDataCurrentSeason,
    resetAttendanceDataCurrentSeason,
    resetManualActivityDataCurrentSeason,
    updateBadge,
} from '../../lib/api/admin/settings';
import {
    badgeArtworkOptions,
    emptyBadgeCriteria,
    normalizeBadgeCode,
} from '../../lib/badges';
import { AnnouncementCreateDialog } from './dialogs/AnnouncementCreateDialog';
import { BadgeDeleteDialog } from './dialogs/BadgeDeleteDialog';
import { BadgeEditorDialog } from './dialogs/BadgeEditorDialog';
import { BannerManagementDialog } from './dialogs/BannerManagementDialog';
import { DataResetDialog } from './dialogs/DataResetDialog';
import { ScheduleCreateDialog } from './dialogs/ScheduleCreateDialog';
import { SeasonCreateDialog } from './dialogs/SeasonCreateDialog';
import { AnnouncementSection } from './sections/AnnouncementSection';
import { BadgeSection } from './sections/BadgeSection';
import { DataResetSection } from './sections/DataResetSection';
import { ScheduleSection } from './sections/ScheduleSection';
import { SeasonSection } from './sections/SeasonSection';
import { useSettingsResources } from './hooks/useSettingsResources';

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
    const {
        seasons,
        announcements,
        scheduleEvents,
        siteBanners,
        badges,
        isLoading,
        refreshData,
        activeSeason,
        badgeAwardCounts,
    } = useSettingsResources();
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
                <AnnouncementSection
                    announcements={announcements}
                    onCreateAnnouncement={() => setActiveDialog('announcement')}
                    onDeleteAnnouncement={(announcementId) => void handleDeleteAnnouncement(announcementId)}
                />

                <ScheduleSection
                    scheduleEvents={scheduleEvents}
                    onCreateScheduleEvent={() => setActiveDialog('schedule')}
                    onDeleteScheduleEvent={(scheduleEventId) => void handleDeleteScheduleEvent(scheduleEventId)}
                />
            </div>

            <SeasonSection
                seasons={seasons}
                seasonStatusLabels={seasonStatusLabels}
                badgeClassByStatus={badgeClassByStatus}
                onCreateSeason={() => setActiveDialog('season')}
            />

            <BadgeSection
                badges={badges}
                badgeAwardCounts={badgeAwardCounts}
                openBadgeId={openBadgeId}
                onToggleBadge={(badgeId) => setOpenBadgeId((current) => (current === badgeId ? null : badgeId))}
                onCreateBadge={openCreateBadgeDialog}
                onEditBadge={openEditBadgeDialog}
                onDeleteBadge={setBadgeIdPendingDelete}
            />

            <DataResetSection
                activeSeasonName={activeSeason?.name ?? null}
                resetConfigEntries={Object.entries(dataResetConfig) as Array<[DataResetAction, typeof dataResetConfig[DataResetAction]]>}
                resetStatus={resetStatus}
                onOpenResetDialog={(action) => {
                    setPendingResetAction(action);
                    setResetConfirmationInput('');
                }}
            />

            <SeasonCreateDialog
                isOpen={activeDialog === 'season'}
                seasonName={newSeasonName}
                seasonStartDate={newSeasonStartDate}
                seasonEndDate={newSeasonEndDate}
                seasonStatus={newSeasonStatus}
                seasonStatusOptions={seasonStatusOptions}
                seasonStatusLabels={seasonStatusLabels}
                onClose={() => setActiveDialog(null)}
                onSubmit={handleAddSeason}
                onChangeSeasonName={setNewSeasonName}
                onChangeSeasonStartDate={setNewSeasonStartDate}
                onChangeSeasonEndDate={setNewSeasonEndDate}
                onChangeSeasonStatus={setNewSeasonStatus}
            />

            <AnnouncementCreateDialog
                isOpen={activeDialog === 'announcement'}
                title={newAnnouncementTitle}
                body={newAnnouncementBody}
                startAt={newAnnouncementStartAt}
                endAt={newAnnouncementEndAt}
                isPinned={newAnnouncementPinned}
                onClose={() => setActiveDialog(null)}
                onSubmit={handleAddAnnouncement}
                onChangeTitle={setNewAnnouncementTitle}
                onChangeBody={setNewAnnouncementBody}
                onChangeStartAt={setNewAnnouncementStartAt}
                onChangeEndAt={setNewAnnouncementEndAt}
                onChangePinned={setNewAnnouncementPinned}
            />

            <ScheduleCreateDialog
                isOpen={activeDialog === 'schedule'}
                title={newScheduleTitle}
                description={newScheduleDescription}
                location={newScheduleLocation}
                startAt={newScheduleStartAt}
                endAt={newScheduleEndAt}
                seasonId={newScheduleSeasonId}
                seasons={seasons}
                onClose={() => setActiveDialog(null)}
                onSubmit={handleAddScheduleEvent}
                onChangeTitle={setNewScheduleTitle}
                onChangeDescription={setNewScheduleDescription}
                onChangeLocation={setNewScheduleLocation}
                onChangeStartAt={setNewScheduleStartAt}
                onChangeEndAt={setNewScheduleEndAt}
                onChangeSeasonId={setNewScheduleSeasonId}
            />

            <BannerManagementDialog
                isOpen={activeDialog === 'banner'}
                bannerTitle={newBannerTitle}
                bannerUrl={newBannerUrl}
                bannerFileName={newBannerFileName}
                bannerFileData={newBannerFileData}
                siteBanners={siteBanners}
                onClose={() => {
                    setActiveDialog(null);
                    resetBannerDraft();
                }}
                onSubmit={handleAddBanner}
                onResetDraft={resetBannerDraft}
                onChangeTitle={setNewBannerTitle}
                onChangeUrl={setNewBannerUrl}
                onChangeFile={(event) => void handleBannerFileChange(event)}
                onMoveBanner={(bannerId, direction) => void handleMoveBanner(bannerId, direction)}
                onDeleteBanner={(bannerId) => void handleDeleteBanner(bannerId)}
            />

            <BadgeEditorDialog
                isOpen={isBadgeDialogOpen}
                mode={badgeDialogMode}
                draft={badgeDraft}
                badgeImageFileName={badgeImageFileName}
                isSaving={isSavingBadge}
                onClose={resetBadgeDialog}
                onSave={() => void handleSaveBadge()}
                onNameChange={handleBadgeNameChange}
                onCriteriaChange={handleBadgeCriteriaChange}
                onBadgeImageFileChange={(event) => void handleBadgeImageFileChange(event)}
                onClearCustomImage={clearBadgeCustomImage}
                setDraft={setBadgeDraft}
            />

            <BadgeDeleteDialog
                badge={badgePendingDelete}
                awardCount={badgePendingDelete ? badgeAwardCounts[badgePendingDelete.id] ?? 0 : 0}
                isDeleting={isDeletingBadge}
                onClose={() => setBadgeIdPendingDelete(null)}
                onDelete={() => void handleDeleteBadge()}
            />

            <DataResetDialog
                isOpen={Boolean(pendingResetAction)}
                onClose={resetResetDialog}
                title={pendingResetAction ? dataResetConfig[pendingResetAction].title : '데이터 초기화'}
                description={pendingResetAction ? dataResetConfig[pendingResetAction].description : undefined}
                confirmationText={pendingResetAction ? dataResetConfig[pendingResetAction].confirmationText : ''}
                confirmationInput={resetConfirmationInput}
                isResetting={isResettingData}
                onChangeConfirmationInput={setResetConfirmationInput}
                onExecute={() => void handleExecuteDataReset()}
            />
        </div>
    );
};
