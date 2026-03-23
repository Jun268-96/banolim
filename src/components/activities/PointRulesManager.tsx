import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Settings2, Trash2, Workflow } from 'lucide-react';
import type { ActivityGroup, Category } from '../../types';
import {
    addActivityGroup,
    addCategory,
    createCategoryVersion,
    deleteActivityGroup,
    deleteCategory,
    getActivityGroups,
    getCategories,
    updateActivityGroup,
} from '../../lib/api/activities/manage';
import { SettingsDialog } from '../settings/SettingsDialog';

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="rounded-[28px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
        {message}
    </div>
);

export const PointRulesManager: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [activityGroups, setActivityGroups] = useState<ActivityGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
    const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);

    const [newCatName, setNewCatName] = useState('');
    const [newCatValue, setNewCatValue] = useState<number>(10);
    const [newCatGroupName, setNewCatGroupName] = useState('manual');
    const [newCatConditionSummary, setNewCatConditionSummary] = useState('');
    const [versionSourceRuleId, setVersionSourceRuleId] = useState<string | null>(null);

    const [editingGroupCode, setEditingGroupCode] = useState<string | null>(null);
    const [groupNameDraft, setGroupNameDraft] = useState('');
    const [groupSortOrderDraft, setGroupSortOrderDraft] = useState(100);

    const versionSourceCategory = useMemo(
        () => categories.find((category) => category.id === versionSourceRuleId) ?? null,
        [categories, versionSourceRuleId],
    );

    const activeGroups = useMemo(
        () =>
            [...activityGroups]
                .filter((group) => group.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
        [activityGroups],
    );

    const groupNameMap = useMemo(
        () =>
            new Map(
                activityGroups.map((group) => [
                    group.code,
                    group.name,
                ]),
            ),
        [activityGroups],
    );

    const groupUsageMap = useMemo(() => {
        const usage = new Map<string, number>();
        categories.forEach((category) => {
            if (!category.groupName) {
                return;
            }
            usage.set(category.groupName, (usage.get(category.groupName) ?? 0) + 1);
        });
        return usage;
    }, [categories]);

    const sortedCategories = useMemo(() => {
        const groupOrderMap = new Map(activeGroups.map((group) => [group.code, group.sortOrder]));

        return [...categories].sort((left, right) => {
            const leftOrder = groupOrderMap.get(left.groupName ?? '') ?? 999;
            const rightOrder = groupOrderMap.get(right.groupName ?? '') ?? 999;
            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }
            return left.categoryName.localeCompare(right.categoryName);
        });
    }, [activeGroups, categories]);

    const refreshData = async () => {
        setIsLoading(true);
        const [categoriesData, groupsData] = await Promise.all([getCategories(), getActivityGroups()]);
        setCategories(categoriesData);
        setActivityGroups(groupsData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [categoriesData, groupsData] = await Promise.all([getCategories(), getActivityGroups()]);
            if (!isMounted) {
                return;
            }
            setCategories(categoriesData);
            setActivityGroups(groupsData);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    const resetRuleForm = () => {
        setNewCatName('');
        setNewCatValue(10);
        setNewCatGroupName(activeGroups[0]?.code ?? 'manual');
        setNewCatConditionSummary('');
        setVersionSourceRuleId(null);
    };

    const resetGroupForm = () => {
        setEditingGroupCode(null);
        setGroupNameDraft('');
        setGroupSortOrderDraft(100);
    };

    const closeRuleDialog = () => {
        setIsRuleDialogOpen(false);
        setErrorMessage(null);
        resetRuleForm();
    };

    const closeGroupDialog = () => {
        setIsGroupDialogOpen(false);
        setErrorMessage(null);
        resetGroupForm();
    };

    const handleOpenNewRuleDialog = () => {
        resetRuleForm();
        setNewCatGroupName(activeGroups[0]?.code ?? 'manual');
        setIsRuleDialogOpen(true);
    };

    const handleOpenGroupDialog = () => {
        resetGroupForm();
        setIsGroupDialogOpen(true);
    };

    const handleAddCategory = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newCatName.trim()) {
            return;
        }

        try {
            setErrorMessage(null);
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
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '규칙을 저장하지 못했습니다.');
        }
    };

    const handleStartVersioning = (category: Category) => {
        setVersionSourceRuleId(category.id);
        setNewCatName(category.categoryName);
        setNewCatValue(category.pointValue);
        setNewCatGroupName(category.groupName ?? activeGroups[0]?.code ?? 'manual');
        setNewCatConditionSummary(category.conditionSummary ?? '');
        setIsRuleDialogOpen(true);
    };

    const handleDeleteCategory = async (id: string) => {
        if (!confirm('이 규칙을 사용 중지할까요? 기존 점수 이력은 유지되고, 앞으로 입력 목록에서만 숨겨집니다.')) {
            return;
        }

        try {
            setErrorMessage(null);
            await deleteCategory(id);
            await refreshData();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '규칙을 사용 중지하지 못했습니다.');
        }
    };

    const handleEditGroup = (group: ActivityGroup) => {
        setEditingGroupCode(group.code);
        setGroupNameDraft(group.name);
        setGroupSortOrderDraft(group.sortOrder);
        setIsGroupDialogOpen(true);
    };

    const handleSaveGroup = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!groupNameDraft.trim()) {
            return;
        }

        try {
            setErrorMessage(null);
            if (editingGroupCode) {
                await updateActivityGroup(editingGroupCode, {
                    name: groupNameDraft.trim(),
                    sortOrder: groupSortOrderDraft,
                });
            } else {
                await addActivityGroup({
                    name: groupNameDraft.trim(),
                    sortOrder: groupSortOrderDraft,
                });
            }

            resetGroupForm();
            await refreshData();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '활동 분류를 저장하지 못했습니다.');
        }
    };

    const handleDeleteGroup = async (group: ActivityGroup) => {
        if (!confirm(`“${group.name}” 분류를 삭제할까요? 이 분류를 쓰는 규칙이 있으면 삭제되지 않습니다.`)) {
            return;
        }

        try {
            setErrorMessage(null);
            await deleteActivityGroup(group.code);
            await refreshData();
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '활동 분류를 삭제하지 못했습니다.');
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex animate-pulse flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100" />
                    <div className="font-medium text-indigo-600">점수 규칙을 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <>
            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                    <div>
                        <div className="flex items-center gap-2 text-slate-900">
                            <Settings2 size={18} className="text-indigo-600" />
                            <h3 className="text-lg font-semibold">점수 설정</h3>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                            현재 사용 중인 규칙만 표시됩니다. 점수 기준을 바꿀 때는 새 버전으로 저장해 과거 기록의 해석을 유지합니다.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={handleOpenGroupDialog}
                            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            <Settings2 size={16} />
                            활동 분류 관리
                        </button>
                        <button
                            type="button"
                            onClick={handleOpenNewRuleDialog}
                            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                            <Plus size={16} />
                            새 규칙 추가
                        </button>
                    </div>
                </div>

                <div className="p-5 sm:p-6">
                    {errorMessage ? (
                        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {errorMessage}
                        </div>
                    ) : null}
                    {sortedCategories.length === 0 ? (
                        <EmptyState message="아직 등록된 점수 규칙이 없습니다." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
                                        <th className="px-4 py-3">활동 이름</th>
                                        <th className="px-4 py-3">활동 분류</th>
                                        <th className="px-4 py-3">점수</th>
                                        <th className="px-4 py-3">규칙 설명</th>
                                        <th className="px-4 py-3">현재 버전</th>
                                        <th className="px-4 py-3 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {sortedCategories.map((category) => {
                                        const groupLabel = groupNameMap.get(category.groupName ?? '') ?? category.groupName ?? '기타';

                                        return (
                                            <tr key={category.id} className="align-top hover:bg-slate-50/80">
                                                <td className="px-4 py-4 font-semibold text-slate-900">{category.categoryName}</td>
                                                <td className="px-4 py-4 text-sm text-slate-600">{groupLabel}</td>
                                                <td className="px-4 py-4">
                                                    <span
                                                        className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${
                                                            category.pointValue > 0
                                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                : category.pointValue < 0
                                                                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                                                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                                                        }`}
                                                    >
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

            <SettingsDialog
                isOpen={isRuleDialogOpen}
                onClose={closeRuleDialog}
                size="xl"
                title={versionSourceCategory ? `“${versionSourceCategory.categoryName}” 새 버전 만들기` : '새 점수 규칙 추가'}
                description={
                    versionSourceCategory
                        ? '기존 이름과 분류는 유지하고 점수와 설명만 조정합니다. 과거 기록은 이전 버전 기준으로 보존됩니다.'
                        : '활동 이름, 분류, 점수, 설명을 한 번에 등록합니다.'
                }
            >
                <form onSubmit={handleAddCategory} className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">활동 이름</span>
                            <input
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
                                value={newCatGroupName}
                                onChange={(event) => setNewCatGroupName(event.target.value)}
                                disabled={Boolean(versionSourceCategory)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100"
                            >
                                {activeGroups.map((group) => (
                                    <option key={group.code} value={group.code}>
                                        {group.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5 md:col-span-2">
                            <span className="text-sm font-medium text-slate-700">점수</span>
                            <input
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
                            '현재 규칙을 직접 덮어쓰지 않고 새 버전으로 교체하면, 과거 점수 이력과 리캡 해석이 바뀌지 않습니다.'
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
                            disabled={!newCatName.trim() || activeGroups.length === 0}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            <Plus size={16} />
                            {versionSourceCategory ? `v${(versionSourceCategory.version ?? 1) + 1} 생성` : '규칙 추가'}
                        </button>
                    </div>
                </form>
            </SettingsDialog>

            <SettingsDialog
                isOpen={isGroupDialogOpen}
                onClose={closeGroupDialog}
                size="xl"
                title="활동 분류 관리"
                description="규칙 생성 시 보이는 분류 목록을 관리합니다. 이미 사용 중인 분류는 삭제할 수 없습니다."
            >
                <div className="space-y-5">
                    <form onSubmit={handleSaveGroup} className="grid gap-4 rounded-[28px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[minmax(0,2fr)_140px_auto] md:items-end">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">분류 이름</span>
                            <input
                                type="text"
                                placeholder="예: 프로젝트, 행사, 과제"
                                value={groupNameDraft}
                                onChange={(event) => setGroupNameDraft(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">정렬 순서</span>
                            <input
                                type="number"
                                value={groupSortOrderDraft}
                                onChange={(event) => setGroupSortOrderDraft(Number(event.target.value) || 100)}
                                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {editingGroupCode ? (
                                <button
                                    type="button"
                                    onClick={resetGroupForm}
                                    className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    초기화
                                </button>
                            ) : null}
                            <button
                                type="submit"
                                disabled={!groupNameDraft.trim()}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Plus size={16} />
                                {editingGroupCode ? '분류 수정' : '분류 추가'}
                            </button>
                        </div>
                    </form>

                    {activeGroups.length === 0 ? (
                        <EmptyState message="아직 등록된 활동 분류가 없습니다." />
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full border-collapse text-left">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
                                        <th className="px-4 py-3">분류 이름</th>
                                        <th className="px-4 py-3">정렬 순서</th>
                                        <th className="px-4 py-3">사용 중 규칙</th>
                                        <th className="px-4 py-3 text-right">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {activeGroups.map((group) => (
                                        <tr key={group.code} className="hover:bg-slate-50/80">
                                            <td className="px-4 py-4 font-semibold text-slate-900">{group.name}</td>
                                            <td className="px-4 py-4 text-sm text-slate-600">#{group.sortOrder}</td>
                                            <td className="px-4 py-4 text-sm text-slate-600">{groupUsageMap.get(group.code) ?? 0}개</td>
                                            <td className="px-4 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEditGroup(group)}
                                                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteGroup(group)}
                                                        className="inline-flex h-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                                                    >
                                                        삭제
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </SettingsDialog>
        </>
    );
};
