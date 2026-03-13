import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import type { AppRole, RoleSummary } from '../../types';
import {
    addRole,
    deleteRole,
    getRoles,
    updateRole,
} from '../../lib/db';
import { roleLabels, roleScopeDescriptions } from '../../lib/permissions';
import { AppDialog } from '../shared/AppDialog';

const roleScopeOptions: AppRole[] = ['super_admin', 'operator', 'team_lead', 'member'];

type RoleDraft = {
    name: string;
    permissionScope: AppRole;
    rankOrder: number;
};

const buildRoleDrafts = (roles: RoleSummary[]): Record<string, RoleDraft> =>
    roles.reduce<Record<string, RoleDraft>>((acc, role) => {
        acc[role.id] = {
            name: role.name,
            permissionScope: role.permissionScope as AppRole,
            rankOrder: role.rankOrder,
        };
        return acc;
    }, {});

interface RoleSettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onUpdated: () => Promise<void>;
}

export const RoleSettingsDialog: React.FC<RoleSettingsDialogProps> = ({
    isOpen,
    onClose,
    onUpdated,
}) => {
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [roleDrafts, setRoleDrafts] = useState<Record<string, RoleDraft>>({});
    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleScope, setNewRoleScope] = useState<AppRole>('member');
    const [newRoleOrder, setNewRoleOrder] = useState<number>(100);
    const [isLoading, setIsLoading] = useState(false);

    const selectedRoleScopeDescription = roleScopeDescriptions[newRoleScope] ?? '';

    const refreshRoles = async () => {
        setIsLoading(true);
        const rolesData = await getRoles();
        setRoles(rolesData);
        setRoleDrafts(buildRoleDrafts(rolesData));
        setIsLoading(false);
    };

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        let isCancelled = false;
        const timer = window.setTimeout(() => {
            if (!isCancelled) {
                void refreshRoles();
            }
        }, 0);

        return () => {
            isCancelled = true;
            window.clearTimeout(timer);
        };
    }, [isOpen]);

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
        await refreshRoles();
        await onUpdated();
    };

    const handleDeleteRole = async (role: RoleSummary) => {
        if (!confirm(`“${role.name}” 역할을 삭제할까요? 연결된 멤버의 직책은 비워집니다.`)) {
            return;
        }

        await deleteRole(role.id);
        await refreshRoles();
        await onUpdated();
    };

    const handleAddRole = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newRoleName.trim()) {
            return;
        }

        await addRole(newRoleName.trim(), newRoleScope.trim(), newRoleOrder);
        setNewRoleName('');
        setNewRoleScope('member');
        setNewRoleOrder(100);
        await refreshRoles();
        await onUpdated();
    };

    const sortedRoles = useMemo(
        () => [...roles].sort((a, b) => a.rankOrder - b.rankOrder || a.name.localeCompare(b.name)),
        [roles],
    );

    return (
        <AppDialog
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            title="역할 설정"
            description="직책 이름, 시스템 권한, 레이어 순서를 이 모달에서 바로 관리합니다."
        >
            <div className="space-y-6">
                <form onSubmit={handleAddRole} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4 flex items-center gap-2 text-slate-900">
                        <ShieldCheck size={18} className="text-indigo-600" />
                        <h4 className="text-base font-semibold">새 역할 추가</h4>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_140px_auto]">
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">역할 이름</span>
                            <input
                                type="text"
                                value={newRoleName}
                                onChange={(event) => setNewRoleName(event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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
                                    <option key={scope} value={scope}>
                                        {roleLabels[scope]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="space-y-1.5">
                            <span className="text-sm font-medium text-slate-700">레이어 순서</span>
                            <input
                                type="number"
                                value={newRoleOrder}
                                onChange={(event) => setNewRoleOrder(Number(event.target.value) || 0)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={!newRoleName.trim()}
                                className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Plus size={16} />
                                역할 추가
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <span className="font-semibold text-slate-900">{roleLabels[newRoleScope]}</span> 권한 설명: {selectedRoleScopeDescription}
                    </div>
                </form>

                {isLoading ? (
                    <div className="flex h-40 items-center justify-center text-sm font-medium text-indigo-600">
                        역할 목록을 불러오는 중...
                    </div>
                ) : sortedRoles.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                        아직 등록된 역할이 없습니다.
                    </div>
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
                                {sortedRoles.map((role) => {
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
                                                        aria-label={`${role.name} 역할 저장`}
                                                        title="저장"
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 transition-colors hover:bg-indigo-100"
                                                    >
                                                        <Save size={15} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDeleteRole(role)}
                                                        aria-label={`${role.name} 역할 삭제`}
                                                        title="삭제"
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 transition-colors hover:bg-rose-100"
                                                    >
                                                        <Trash2 size={15} />
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
        </AppDialog>
    );
};
