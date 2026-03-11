import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Megaphone, Plus, Settings, ShieldCheck, Trash2, Users2, Workflow } from 'lucide-react';
import type { AnnouncementItem, AppRole, Category, RoleSummary, ScheduleEventItem, SeasonStatus, SeasonSummary, TeamSummary, TeamType } from '../../types';
import {
    addCategory,
    addAnnouncement,
    addRole,
    addScheduleEvent,
    addSeason,
    addTeam,
    createCategoryVersion,
    deleteAnnouncement,
    deleteCategory,
    deleteScheduleEvent,
    getAnnouncements,
    getCategories,
    getRoles,
    getScheduleEvents,
    getSeasons,
    getTeams,
} from '../../lib/db';
import { roleLabels } from '../../lib/permissions';

const seasonStatusOptions: SeasonStatus[] = ['planned', 'active', 'closed'];
const teamTypeOptions: TeamType[] = ['core', 'study', 'project'];
const roleScopeOptions: AppRole[] = ['super_admin', 'operator', 'team_lead', 'member'];
const seasonStatusLabels: Record<SeasonStatus, string> = {
    planned: '예정',
    active: '진행 중',
    closed: '종료',
};
const teamTypeLabels: Record<TeamType, string> = {
    core: '운영',
    study: '스터디',
    project: '프로젝트',
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

export const SettingsTab: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [teams, setTeams] = useState<TeamSummary[]>([]);
    const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);

    const [newCatName, setNewCatName] = useState('');
    const [newCatValue, setNewCatValue] = useState<number>(10);
    const [newCatPenaltyPoint, setNewCatPenaltyPoint] = useState<number>(0);
    const [newCatGroupName, setNewCatGroupName] = useState('manual');
    const [newCatConditionSummary, setNewCatConditionSummary] = useState('');
    const [versionSourceRuleId, setVersionSourceRuleId] = useState<string | null>(null);

    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleScope, setNewRoleScope] = useState('member');
    const [newRoleOrder, setNewRoleOrder] = useState<number>(100);

    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamType, setNewTeamType] = useState<TeamType>('core');

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

    const [isLoading, setIsLoading] = useState(true);

    const versionSourceCategory = useMemo(
        () => categories.find((category) => category.id === versionSourceRuleId) ?? null,
        [categories, versionSourceRuleId],
    );

    const resetCategoryForm = () => {
        setNewCatName('');
        setNewCatValue(10);
        setNewCatPenaltyPoint(0);
        setNewCatGroupName('manual');
        setNewCatConditionSummary('');
        setVersionSourceRuleId(null);
    };

    const refreshData = async () => {
        setIsLoading(true);
        const [categoriesData, rolesData, teamsData, seasonsData, announcementsData, scheduleData] = await Promise.all([
            getCategories(),
            getRoles(),
            getTeams(),
            getSeasons(),
            getAnnouncements(),
            getScheduleEvents(),
        ]);
        setCategories(categoriesData);
        setRoles(rolesData);
        setTeams(teamsData);
        setSeasons(seasonsData);
        setAnnouncements(announcementsData);
        setScheduleEvents(scheduleData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [categoriesData, rolesData, teamsData, seasonsData, announcementsData, scheduleData] = await Promise.all([
                getCategories(),
                getRoles(),
                getTeams(),
                getSeasons(),
                getAnnouncements(),
                getScheduleEvents(),
            ]);

            if (!isMounted) {
                return;
            }

            setCategories(categoriesData);
            setRoles(rolesData);
            setTeams(teamsData);
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
                penaltyPoint: newCatPenaltyPoint,
                conditionSummary: newCatConditionSummary,
            });
        } else {
            await addCategory({
                categoryName: newCatName.trim(),
                pointValue: newCatValue,
                penaltyPoint: newCatPenaltyPoint,
                conditionSummary: newCatConditionSummary,
                groupName: newCatGroupName,
            });
        }
        resetCategoryForm();
        await refreshData();
    };

    const handleStartVersioning = (category: Category) => {
        setVersionSourceRuleId(category.id);
        setNewCatName(category.categoryName);
        setNewCatValue(category.pointValue);
        setNewCatPenaltyPoint(category.penaltyPoint ?? 0);
        setNewCatGroupName(category.groupName ?? 'manual');
        setNewCatConditionSummary(category.conditionSummary ?? '');
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm('이 규칙을 비활성화할까요? 기존 점수 이력은 유지됩니다.')) {
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
        await refreshData();
    };

    const handleAddTeam = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newTeamName.trim()) return;

        await addTeam(newTeamName.trim(), newTeamType);
        setNewTeamName('');
        setNewTeamType('core');
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
        await refreshData();
    };

    const handleDeleteScheduleEvent = async (id: string) => {
        if (!confirm('이 일정을 숨길까요?')) return;
        await deleteScheduleEvent(id);
        await refreshData();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">설정을 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Settings className="text-indigo-600" />
                    운영 설정
                </h2>
                <p className="text-slate-500 mt-1">규칙, 역할, 팀, 시즌을 한 곳에서 관리합니다.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">활성 규칙</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{categories.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">역할</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{roles.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">팀</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{teams.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">시즌</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{seasons.length}</div>
                </div>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                            <Settings size={18} className="text-indigo-600" />
                            점수 규칙
                        </div>
                        <form onSubmit={handleAddCategory} className="flex flex-col gap-3 md:flex-row md:items-end">
                            <div className="flex-1 space-y-1.5">
                                <label htmlFor="catName" className="text-xs font-medium text-slate-600">활동 이름</label>
                                <input
                                    id="catName"
                                    type="text"
                                    placeholder="예: 발표, 스터디 참여"
                                    value={newCatName}
                                    onChange={(event) => setNewCatName(event.target.value)}
                                    disabled={Boolean(versionSourceCategory)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="w-full md:w-40 space-y-1.5">
                                <label htmlFor="catGroup" className="text-xs font-medium text-slate-600">그룹</label>
                                <select
                                    id="catGroup"
                                    value={newCatGroupName}
                                    onChange={(event) => setNewCatGroupName(event.target.value)}
                                    disabled={Boolean(versionSourceCategory)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm bg-white disabled:bg-slate-100"
                                >
                                    {ruleGroupOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-full md:w-32 space-y-1.5">
                                <label htmlFor="catValue" className="text-xs font-medium text-slate-600">기본 점수</label>
                                <input
                                    id="catValue"
                                    type="number"
                                    value={newCatValue}
                                    onChange={(event) => setNewCatValue(Number(event.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="w-full md:w-32 space-y-1.5">
                                <label htmlFor="catPenalty" className="text-xs font-medium text-slate-600">감점</label>
                                <input
                                    id="catPenalty"
                                    type="number"
                                    value={newCatPenaltyPoint}
                                    onChange={(event) => setNewCatPenaltyPoint(Number(event.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label htmlFor="catCondition" className="text-xs font-medium text-slate-600">조건 요약</label>
                                <input
                                    id="catCondition"
                                    type="text"
                                    placeholder="예: 발표 자료 제출 시 기본 점수 지급"
                                    value={newCatConditionSummary}
                                    onChange={(event) => setNewCatConditionSummary(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newCatName.trim()}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 h-10"
                            >
                                <Plus size={18} />
                                {versionSourceCategory ? `v${(versionSourceCategory.version ?? 1) + 1} 생성` : '추가'}
                            </button>
                            {versionSourceCategory && (
                                <button
                                    type="button"
                                    onClick={resetCategoryForm}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors h-10"
                                >
                                    새 규칙으로 전환
                                </button>
                            )}
                        </form>
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                            {versionSourceCategory ? (
                                <>
                                    <span className="font-semibold text-slate-900">{versionSourceCategory.categoryName}</span>
                                    {' '}규칙의 새 버전을 만드는 중입니다. 기존 버전은 비활성화되고, 과거 기록은 이전 rule id를 계속 참조합니다.
                                </>
                            ) : (
                                '규칙을 수정할 때는 기존 항목을 덮어쓰지 않고 새 버전을 만들어 과거 기록 해석이 바뀌지 않게 유지합니다.'
                            )}
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-100 text-sm font-semibold text-slate-600">
                                    <th className="py-4 px-6 min-w-[220px]">활동</th>
                                    <th className="py-4 px-6 w-28">기본</th>
                                    <th className="py-4 px-6 w-28">감점</th>
                                    <th className="py-4 px-6 w-24">버전</th>
                                    <th className="py-4 px-6 min-w-[240px]">조건</th>
                                    <th className="py-4 px-6 w-36 text-center">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-slate-900">{category.categoryName}</div>
                                            <div className="mt-1 text-xs text-slate-500">
                                                {ruleGroupOptions.find((option) => option.value === (category.groupName ?? 'manual'))?.label ?? category.groupName ?? '기타'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${category.pointValue > 0
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                {category.pointValue > 0 ? '+' : ''}
                                                {category.pointValue}점
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${(category.penaltyPoint ?? 0) > 0
                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                : 'bg-slate-100 text-slate-600 border-slate-200'
                                                }`}>
                                                {(category.penaltyPoint ?? 0) > 0 ? `-${category.penaltyPoint}점` : '없음'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                v{category.version ?? 1}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-sm text-slate-600">{category.conditionSummary ?? '-'}</td>
                                        <td className="py-4 px-6 text-center">
                                            <div className="flex items-center justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={() => handleStartVersioning(category)}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                                    title="새 버전 만들기"
                                                >
                                                    <Workflow size={14} />
                                                    새 버전
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteCategory(category.id)}
                                                    className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors"
                                                    title="규칙 비활성화"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                            <ShieldCheck size={18} className="text-indigo-600" />
                            역할
                        </div>
                        <form onSubmit={handleAddRole} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_120px_auto] gap-3 items-end">
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">역할 이름</span>
                                <input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(event) => setNewRoleName(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="예: 스터디 운영진"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">권한 범위</span>
                                <select
                                    value={newRoleScope}
                                    onChange={(event) => setNewRoleScope(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm bg-white"
                                >
                                    {roleScopeOptions.map((scope) => (
                                        <option key={scope} value={scope}>{roleLabels[scope]}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">정렬 순서</span>
                                <input
                                    type="number"
                                    value={newRoleOrder}
                                    onChange={(event) => setNewRoleOrder(Number(event.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={!newRoleName.trim()}
                                className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors h-10"
                            >
                                추가
                            </button>
                        </form>
                        <div className="mt-5 space-y-3">
                            {roles.map((role) => (
                                <div key={role.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-slate-900">{role.name}</div>
                                        <div className="text-sm text-slate-500 mt-1">{roleLabels[role.permissionScope as AppRole] ?? role.permissionScope}</div>
                                    </div>
                                    <div className="text-sm font-semibold text-slate-500">#{role.rankOrder}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                            <Users2 size={18} className="text-indigo-600" />
                            팀
                        </div>
                        <form onSubmit={handleAddTeam} className="grid grid-cols-1 md:grid-cols-[1.4fr_140px_auto] gap-3 items-end">
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">팀 이름</span>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(event) => setNewTeamName(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="예: 기획팀"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">유형</span>
                                <select
                                    value={newTeamType}
                                    onChange={(event) => setNewTeamType(event.target.value as TeamType)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm bg-white"
                                >
                                    {teamTypeOptions.map((type) => (
                                        <option key={type} value={type}>{teamTypeLabels[type]}</option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="submit"
                                disabled={!newTeamName.trim()}
                                className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors h-10"
                            >
                                추가
                            </button>
                        </form>
                        <div className="mt-5 space-y-3">
                            {teams.map((team) => (
                                <div key={team.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-slate-900">{team.name}</div>
                                        <div className="text-sm text-slate-500 mt-1">{teamTypeLabels[team.type]}</div>
                                    </div>
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${team.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                        {team.isActive ? '활성' : '비활성'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                    <CalendarDays size={18} className="text-indigo-600" />
                    시즌
                </div>

                <form onSubmit={handleAddSeason} className="grid grid-cols-1 lg:grid-cols-[1.4fr_160px_160px_140px_auto] gap-3 items-end">
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">시즌 이름</span>
                        <input
                            type="text"
                            value={newSeasonName}
                            onChange={(event) => setNewSeasonName(event.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                            placeholder="예: 2026 하반기"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">시작일</span>
                        <input
                            type="date"
                            value={newSeasonStartDate}
                            onChange={(event) => setNewSeasonStartDate(event.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">종료일</span>
                        <input
                            type="date"
                            value={newSeasonEndDate}
                            onChange={(event) => setNewSeasonEndDate(event.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">상태</span>
                        <select
                            value={newSeasonStatus}
                            onChange={(event) => setNewSeasonStatus(event.target.value as SeasonStatus)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm bg-white"
                        >
                            {seasonStatusOptions.map((status) => (
                                <option key={status} value={status}>{seasonStatusLabels[status]}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="submit"
                        disabled={!newSeasonName.trim() || !newSeasonStartDate || !newSeasonEndDate}
                        className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors h-10"
                    >
                        추가
                    </button>
                </form>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {seasons.map((season) => (
                        <div key={season.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-slate-900">{season.name}</div>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClassByStatus[season.status]}`}>
                                    {seasonStatusLabels[season.status]}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-3">
                                {season.startDate} ~ {season.endDate || '-'}
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold">
                            <Megaphone size={18} className="text-indigo-600" />
                            공지 관리
                        </div>
                        <div className="mt-1 text-sm text-slate-500">홈과 내 상태 화면에 노출할 운영 공지를 등록하고 정리합니다.</div>
                    </div>

                    <div className="space-y-5 p-6">
                        <form onSubmit={handleAddAnnouncement} className="space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">공지 제목</span>
                                <input
                                    type="text"
                                    value={newAnnouncementTitle}
                                    onChange={(event) => setNewAnnouncementTitle(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="예: 3월 전체 모임 안내"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">공지 내용</span>
                                <textarea
                                    value={newAnnouncementBody}
                                    onChange={(event) => setNewAnnouncementBody(event.target.value)}
                                    rows={4}
                                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="일정 변경, 준비물, 제출 기한 등을 적어 주세요."
                                />
                            </label>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">노출 시작</span>
                                    <input
                                        type="datetime-local"
                                        value={newAnnouncementStartAt}
                                        onChange={(event) => setNewAnnouncementStartAt(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">노출 종료</span>
                                    <input
                                        type="datetime-local"
                                        value={newAnnouncementEndAt}
                                        onChange={(event) => setNewAnnouncementEndAt(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                            </div>
                            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={newAnnouncementPinned}
                                    onChange={(event) => setNewAnnouncementPinned(event.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                상단 고정 공지로 노출
                            </label>
                            <button
                                type="submit"
                                disabled={!newAnnouncementTitle.trim() || !newAnnouncementBody.trim()}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Plus size={16} />
                                공지 등록
                            </button>
                        </form>

                        <div className="space-y-3">
                            {announcements.map((announcement) => (
                                <div key={announcement.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
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
                                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                            title="공지 숨기기"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {announcements.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                    아직 등록된 공지가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-slate-50/60 px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold">
                            <CalendarDays size={18} className="text-indigo-600" />
                            일정 관리
                        </div>
                        <div className="mt-1 text-sm text-slate-500">예정된 모임, 세션, 제출 마감 일정을 등록하고 노출 상태를 관리합니다.</div>
                    </div>

                    <div className="space-y-5 p-6">
                        <form onSubmit={handleAddScheduleEvent} className="space-y-4">
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">일정 제목</span>
                                <input
                                    type="text"
                                    value={newScheduleTitle}
                                    onChange={(event) => setNewScheduleTitle(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="예: 3월 정기모임"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">설명</span>
                                <textarea
                                    value={newScheduleDescription}
                                    onChange={(event) => setNewScheduleDescription(event.target.value)}
                                    rows={3}
                                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    placeholder="진행 주제, 준비물, 참가 방식 등을 적어 주세요."
                                />
                            </label>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">시작 일시</span>
                                    <input
                                        type="datetime-local"
                                        value={newScheduleStartAt}
                                        onChange={(event) => setNewScheduleStartAt(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">종료 일시</span>
                                    <input
                                        type="datetime-local"
                                        value={newScheduleEndAt}
                                        onChange={(event) => setNewScheduleEndAt(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                            </div>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">장소</span>
                                    <input
                                        type="text"
                                        value={newScheduleLocation}
                                        onChange={(event) => setNewScheduleLocation(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        placeholder="예: 4층 세미나실 / Discord"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">연결 시즌</span>
                                    <select
                                        value={newScheduleSeasonId}
                                        onChange={(event) => setNewScheduleSeasonId(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                            <button
                                type="submit"
                                disabled={!newScheduleTitle.trim() || !newScheduleStartAt}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Plus size={16} />
                                일정 등록
                            </button>
                        </form>

                        <div className="space-y-3">
                            {scheduleEvents.map((scheduleEvent) => (
                                <div key={scheduleEvent.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
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
                                            className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                                            title="일정 숨기기"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {scheduleEvents.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                    아직 등록된 일정이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
