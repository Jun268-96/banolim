import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Megaphone, Plus, Save, Settings, ShieldCheck, Trash2, Workflow } from 'lucide-react';
import type { AnnouncementItem, AppRole, Category, RoleSummary, ScheduleEventItem, SeasonStatus, SeasonSummary } from '../../types';
import {
    addAnnouncement,
    addCategory,
    addRole,
    addScheduleEvent,
    addSeason,
    createCategoryVersion,
    deleteAnnouncement,
    deleteCategory,
    deleteRole,
    deleteScheduleEvent,
    getAnnouncements,
    getCategories,
    getRoles,
    getScheduleEvents,
    getSeasons,
    updateRole,
} from '../../lib/db';
import { roleLabels, roleScopeDescriptions } from '../../lib/permissions';
import { SettingsDialog } from './SettingsDialog';

const seasonStatusOptions: SeasonStatus[] = ['planned', 'active', 'closed'];
const roleScopeOptions: AppRole[] = ['super_admin', 'operator', 'team_lead', 'member'];
const seasonStatusLabels: Record<SeasonStatus, string> = {
    planned: '예정',
    active: '진행 중',
    closed: '종료',
};
const ruleGroupOptions = [
    { value: 'attendance', label: '출석' },
    { value: 'study', label: '스터디' },
    { value: 'contribution', label: '기여' },
    { value: 'operations', label: '운영' },
    { value: 'manual', label: '기타' },
];

const badgeClassByStatus: Record<SeasonStatus, string> = {
    planned: 'bg-amber-50 text-amber-700 border-amber-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
};

type SettingsDialogType = 'rule' | 'role' | 'season' | 'announcement' | 'schedule' | null;

type RoleDraft = {
    name: string;
    permissionScope: AppRole;
    rankOrder: number;
};

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

const buildRoleDrafts = (roles: RoleSummary[]): Record<string, RoleDraft> =>
    roles.reduce<Record<string, RoleDraft>>((acc, role) => {
        acc[role.id] = {
            name: role.name,
            permissionScope: role.permissionScope as AppRole,
            rankOrder: role.rankOrder,
        };
        return acc;
    }, {});

export const SettingsTab: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);

    const [newCatName, setNewCatName] = useState('');
    const [newCatValue, setNewCatValue] = useState<number>(10);
    const [newCatGroupName, setNewCatGroupName] = useState('manual');
    const [newCatConditionSummary, setNewCatConditionSummary] = useState('');
    const [versionSourceRuleId, setVersionSourceRuleId] = useState<string | null>(null);

    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleScope, setNewRoleScope] = useState<AppRole>('member');
    const [newRoleOrder, setNewRoleOrder] = useState<number>(100);

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
    const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});

    const versionSourceCategory = useMemo(
        () => categories.find((category) => category.id === versionSourceRuleId) ?? null,
        [categories, versionSourceRuleId],
    );
    const selectedRoleScopeDescription = roleScopeDescriptions[newRoleScope] ?? '';

    const resetCategoryForm = () => {
        setNewCatName('');
        setNewCatValue(10);
        setNewCatGroupName('manual');
        setNewCatConditionSummary('');
        setVersionSourceRuleId(null);
    };

    const closeRuleDialog = () => {
        resetCategoryForm();
        setActiveDialog(null);
    };

    const refreshData = async () => {
        setIsLoading(true);
        const [categoriesData, rolesData, seasonsData, announcementsData, scheduleData] = await Promise.all([
            getCategories(),
            getRoles(),
            getSeasons(),
            getAnnouncements(),
            getScheduleEvents(),
        ]);
        setCategories(categoriesData);
        setRoles(rolesData);
        setRoleDrafts(buildRoleDrafts(rolesData));
        setSeasons(seasonsData);
        setAnnouncements(announcementsData);
        setScheduleEvents(scheduleData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [categoriesData, rolesData, seasonsData, announcementsData, scheduleData] = await Promise.all([
                getCategories(),
                getRoles(),
                getSeasons(),
                getAnnouncements(),
                getScheduleEvents(),
            ]);

            if (!isMounted) {
                return;
            }

            setCategories(categoriesData);
            setRoles(rolesData);
            setRoleDrafts(buildRoleDrafts(rolesData));
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

    const handleAddCategory = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newCatName.trim()) return;

        if (versionSourceRuleId) {
            await createCategoryVersion(versionSourceRuleId, {
                pointValue: newCatValue,
                conditionSummary: newCatConditionSummary,
            });
        } else {
            await addCategory({
                categoryName: newCatName.trim(),
                pointValue: newCatValue,
                conditionSummary: newCatConditionSummary,
                groupName: newCatGroupName,
            });
        }

        closeRuleDialog();
        await refreshData();
    };

    const handleStartVersioning = (category: Category) => {
        setVersionSourceRuleId(category.id);
        setNewCatName(category.categoryName);
        setNewCatValue(category.pointValue);
        setNewCatGroupName(category.groupName ?? 'manual');
        setNewCatConditionSummary(category.conditionSummary ?? '');
        setActiveDialog('rule');
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm('이 규칙을 사용 중지할까요? 기존 점수 이력은 유지되고, 앞으로 입력 목록에서만 숨겨집니다.')) {
            await deleteCategory(id);
            await refreshData();
        }
    };

    const handleAddRole = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newRoleName.trim()) return;

        await addRole(newRoleName.trim(), newRoleScope.trim(), newRoleOrder);
        setNewRoleName('');
        setNewRoleScope('member');
        setNewRoleOrder(100);
        setActiveDialog(null);
        await refreshData();
    };

    const handleRoleDraftChange = <K extends keyof RoleDraft>(roleId: string, key: K, value: RoleDraft[K]) => {
        setRoleDrafts((current) => ({
            ...current,
            [roleId]: {
                ...(current[roleId] ?? { name: '', permissionScope: 'member', rankOrder: 100 }),
                [key]: value,
            },
        }));
    };

    const handleSaveRole = async (roleId: string) => {
        const draft = roleDrafts[roleId];
        if (!draft || !draft.name.trim()) {
            return;
        }

        await updateRole(roleId, {
            name: draft.name.trim(),
            permissionScope: draft.permissionScope,
            rankOrder: draft.rankOrder,
        });
        await refreshData();
    };

    const handleDeleteRole = async (role: RoleSummary) => {
        if (!confirm(`“${role.name}” 역할을 삭제할까요? 연결된 멤버의 직책은 비워집니다.`)) {
            return;
        }

        await deleteRole(role.id);
        await refreshData();
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

    const handleOpenNewRuleDialog = () => {
        resetCategoryForm();
        setActiveDialog('rule');
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
                <p className="mt-1 text-slate-500">점수 규칙과 역할은 테이블에서 바로 관리하고, 생성만 모달에서 처리합니다.</p>
            </header>

            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                    icon={<Settings size={18} className="text-indigo-600" />}
                    title="점수 규칙"
                    description="점수 기준이 바뀌면 새 버전을 추가해 과거 기록은 유지합니다. 점수는 기본 점수 하나로만 관리하고, 규칙 설명은 운영 메모로 남깁니다."
                    actionLabel="새 규칙 추가"
                    onAction={handleOpenNewRuleDialog}
                />
                <div className="p-5 sm:p-6">
                    {categories.length === 0 ? (
                        <EmptyState message="아직 등록된 점수 규칙이 없습니다." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
                                        <th className="px-4 py-3">활동 이름</th>
                                        <th className="px-4 py-3">분류</th>
                                        <th className="px-4 py-3">기본 점수</th>
                                        <th className="px-4 py-3">규칙 설명</th>
                                        <th className="px-4 py-3">버전</th>
                                        <th className="px-4 py-3 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categories.map((category) => {
                                        const groupLabel = ruleGroupOptions.find((option) => option.value === (category.groupName ?? 'manual'))?.label ?? category.groupName ?? '기타';
                                        return (
                                            <tr key={category.id} className="align-top hover:bg-slate-50/80">
                                                <td className="px-4 py-4 font-semibold text-slate-900">{category.categoryName}</td>
                                                <td className="px-4 py-4 text-sm text-slate-600">{groupLabel}</td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${
                                                        category.pointValue > 0
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : category.pointValue < 0
                                                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                                                : 'border-slate-200 bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {category.pointValue > 0 ? '+' : ''}
                                                        {category.pointValue}점
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4 text-sm leading-6 text-slate-600">
                                                    {category.conditionSummary?.trim() || '설명 없음'}
                                                </td>
                                                <td className="px-4 py-4 text-sm font-semibold text-indigo-700">v{category.version ?? 1}</td>
                                                <td className="px-4 py-4">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartVersioning(category)}
                                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                                                        >
                                                            <Workflow size={15} />
                                                            새 버전
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteCategory(category.id)}
                                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                                                        >
                                                            <Trash2 size={15} />
                                                            사용 중지
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
                <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                    <SectionHeader
                        icon={<ShieldCheck size={18} className="text-indigo-600" />}
                        title="역할"
                        description="직책 이름, 시스템 권한, 레이어 순서를 이 표에서 바로 수정할 수 있습니다."
                        actionLabel="새 역할 추가"
                        onAction={() => setActiveDialog('role')}
                    />
                    <div className="p-5 sm:p-6">
                        {roles.length === 0 ? (
                            <EmptyState message="아직 등록된 역할이 없습니다." />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
                                            <th className="px-4 py-3">직책 이름</th>
                                            <th className="px-4 py-3">권한 범위</th>
                                            <th className="px-4 py-3">레이어 순서</th>
                                            <th className="px-4 py-3 text-right">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {roles.map((role) => {
                                            const draft = roleDrafts[role.id] ?? {
                                                name: role.name,
                                                permissionScope: role.permissionScope as AppRole,
                                                rankOrder: role.rankOrder,
                                            };

                                            return (
                                                <tr key={role.id} className="align-top hover:bg-slate-50/80">
                                                    <td className="px-4 py-4">
                                                        <input
                                                            type="text"
                                                            value={draft.name}
                                                            onChange={(event) => handleRoleDraftChange(role.id, 'name', event.target.value)}
                                                            className="w-full min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <select
                                                            value={draft.permissionScope}
                                                            onChange={(event) => handleRoleDraftChange(role.id, 'permissionScope', event.target.value as AppRole)}
                                                            className="w-full min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        >
                                                            {roleScopeOptions.map((scope) => (
                                                                <option key={scope} value={scope}>
                                                                    {roleLabels[scope]}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <p className="mt-2 text-xs leading-5 text-slate-500">
                                                            {roleScopeDescriptions[draft.permissionScope] ?? '설명 없음'}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <input
                                                            type="number"
                                                            value={draft.rankOrder}
                                                            onChange={(event) => handleRoleDraftChange(role.id, 'rankOrder', Number(event.target.value) || 0)}
                                                            className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleSaveRole(role.id)}
                                                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                                                            >
                                                                <Save size={15} />
                                                                저장
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleDeleteRole(role)}
                                                                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                                                            >
                                                                <Trash2 size={15} />
                                                                삭제
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </section>

            </div>

            <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
                <SectionHeader
                    icon={<CalendarDays size={18} className="text-indigo-600" />}
                    title="시즌"
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

            <SettingsDialog
                isOpen={activeDialog === 'rule'}
                onClose={closeRuleDialog}
                size="xl"
                title={versionSourceCategory ? `“${versionSourceCategory.categoryName}” 새 버전 만들기` : '새 점수 규칙 추가'}
                description={
                    versionSourceCategory
                        ? '기존 이름은 그대로 유지하고 점수와 설명만 조정합니다. 과거 기록은 이전 버전 기준으로 보존됩니다.'
                        : '활동 이름, 점수 기준, 설명을 한 번에 정리해서 등록합니다.'
                }
            >
                <form onSubmit={handleAddCategory} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">활동 이름</span>
                            <input
                                id="catName"
                                type="text"
                                placeholder="예: 발표, 스터디 참여, 정기모임 지각"
                                value={newCatName}
                                onChange={(event) => setNewCatName(event.target.value)}
                                disabled={Boolean(versionSourceCategory)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">활동 분류</span>
                            <select
                                id="catGroup"
                                value={newCatGroupName}
                                onChange={(event) => setNewCatGroupName(event.target.value)}
                                disabled={Boolean(versionSourceCategory)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                            >
                                {ruleGroupOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">기본 지급 점수</span>
                            <input
                                id="catValue"
                                type="number"
                                value={newCatValue}
                                onChange={(event) => setNewCatValue(Number(event.target.value) || 0)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                    </div>

                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">규칙 설명</span>
                        <textarea
                            id="catCondition"
                            placeholder="예: 발표 자료 링크를 제출하면 점수를 지급하고, 발표 완료 후에만 인정"
                            value={newCatConditionSummary}
                            onChange={(event) => setNewCatConditionSummary(event.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>

                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                        {versionSourceCategory ? (
                            <>
                                <span className="font-semibold text-slate-900">{versionSourceCategory.categoryName}</span> 규칙의 새 버전을 만드는 중입니다.
                                저장하면 기존 버전은 그대로 남고, 이후 입력부터만 새 기준을 사용합니다.
                            </>
                        ) : (
                            '규칙을 고칠 때는 기존 규칙을 덮어쓰지 않고 새 버전을 만들어 과거 점수 해석이 바뀌지 않게 유지합니다.'
                        )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                        <button
                            type="button"
                            onClick={closeRuleDialog}
                            className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!newCatName.trim()}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            {versionSourceCategory ? `v${(versionSourceCategory.version ?? 1) + 1} 생성` : '규칙 추가'}
                        </button>
                    </div>
                </form>
            </SettingsDialog>

            <SettingsDialog
                isOpen={activeDialog === 'role'}
                onClose={() => setActiveDialog(null)}
                title="새 역할 추가"
                description="직책 이름과 권한 범위를 함께 정의합니다. 같은 최고 권한을 공유해도 역할 이름은 다르게 둘 수 있습니다."
            >
                <form onSubmit={handleAddRole} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px]">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">역할 이름</span>
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(event) => setNewRoleName(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="예: 스터디 운영진"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">권한 범위</span>
                            <select
                                value={newRoleScope}
                                onChange={(event) => setNewRoleScope(event.target.value as AppRole)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {roleScopeOptions.map((scope) => (
                                    <option key={scope} value={scope}>{roleLabels[scope]}</option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">정렬 순서</span>
                            <input
                                type="number"
                                value={newRoleOrder}
                                onChange={(event) => setNewRoleOrder(Number(event.target.value) || 0)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                    </div>
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{roleLabels[newRoleScope]}</span> 권한 설명: {selectedRoleScopeDescription}
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
                            disabled={!newRoleName.trim()}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            역할 추가
                        </button>
                    </div>
                </form>
            </SettingsDialog>

            <SettingsDialog
                isOpen={activeDialog === 'season'}
                onClose={() => setActiveDialog(null)}
                title="새 시즌 추가"
                description="시즌은 통계, 출석 세션, 리캡 저장본의 기준 기간으로 사용됩니다."
                size="xl"
            >
                <form onSubmit={handleAddSeason} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_180px_180px_160px]">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">시즌 이름</span>
                            <input
                                type="text"
                                value={newSeasonName}
                                onChange={(event) => setNewSeasonName(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="예: 2026 하반기"
                            />
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
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">상태</span>
                            <select
                                value={newSeasonStatus}
                                onChange={(event) => setNewSeasonStatus(event.target.value as SeasonStatus)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {seasonStatusOptions.map((status) => (
                                    <option key={status} value={status}>{seasonStatusLabels[status]}</option>
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
                            disabled={!newSeasonName.trim() || !newSeasonStartDate || !newSeasonEndDate}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            시즌 추가
                        </button>
                    </div>
                </form>
            </SettingsDialog>

            <SettingsDialog
                isOpen={activeDialog === 'announcement'}
                onClose={() => setActiveDialog(null)}
                title="공지 등록"
                description="홈과 내 상태 화면에 노출할 안내 문구를 등록하고, 필요하면 시작/종료 시간을 함께 지정합니다."
                size="xl"
            >
                <form onSubmit={handleAddAnnouncement} className="space-y-5">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">공지 제목</span>
                        <input
                            type="text"
                            value={newAnnouncementTitle}
                            onChange={(event) => setNewAnnouncementTitle(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="예: 3월 전체 모임 안내"
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">공지 내용</span>
                        <textarea
                            value={newAnnouncementBody}
                            onChange={(event) => setNewAnnouncementBody(event.target.value)}
                            rows={5}
                            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="일정 변경, 준비물, 제출 기한 등을 적어 주세요."
                        />
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                        <input
                            type="checkbox"
                            checked={newAnnouncementPinned}
                            onChange={(event) => setNewAnnouncementPinned(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        상단 고정 공지로 노출
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
                            disabled={!newAnnouncementTitle.trim() || !newAnnouncementBody.trim()}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
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
                size="xl"
            >
                <form onSubmit={handleAddScheduleEvent} className="space-y-5">
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">일정 제목</span>
                        <input
                            type="text"
                            value={newScheduleTitle}
                            onChange={(event) => setNewScheduleTitle(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="예: 3월 정기모임"
                        />
                    </label>
                    <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-slate-700">설명</span>
                        <textarea
                            value={newScheduleDescription}
                            onChange={(event) => setNewScheduleDescription(event.target.value)}
                            rows={4}
                            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="진행 주제, 준비물, 참가 방식 등을 적어 주세요."
                        />
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">장소</span>
                            <input
                                type="text"
                                value={newScheduleLocation}
                                onChange={(event) => setNewScheduleLocation(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                placeholder="예: 4층 세미나실 / Discord"
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
                            disabled={!newScheduleTitle.trim() || !newScheduleStartAt}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            일정 등록
                        </button>
                    </div>
                </form>
            </SettingsDialog>
        </div>
    );
};
