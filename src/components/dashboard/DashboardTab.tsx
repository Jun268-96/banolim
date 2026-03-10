import React, { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Trash2, Search } from 'lucide-react';
import type { Category, Member, MemberStatus, RoleSummary, TeamSummary } from '../../types';
import {
    addMember,
    awardPoints,
    deleteMember,
    getCategories,
    getMembers,
    getRoles,
    getTeams,
    updateMember,
} from '../../lib/db';
import { useAuth } from '../auth/auth-context';

const memberStatusOptions: MemberStatus[] = ['active', 'dormant', 'inactive'];
const memberStatusLabels: Record<MemberStatus, string> = {
    active: '활동 중',
    dormant: '휴면',
    inactive: '비활성',
};

const getLevelInfo = (score: number) => {
    const level = Math.max(0, Math.floor(score / 100));

    if (level >= 2) return { level, color: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (level >= 1) return { level, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    return { level, color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

const getStatusInfo = (member: Member) => {
    switch (member.status) {
        case 'active':
            return { label: '활동 중', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'dormant':
            return { label: '휴면', className: 'bg-sky-50 text-sky-700 border-sky-200' };
        case 'inactive':
            return { label: '비활성', className: 'bg-slate-100 text-slate-600 border-slate-200' };
        default:
            return { label: '알 수 없음', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date(value)).replace(/\s/g, '');
};

const normalizeLoginEmail = (value: string) => {
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
};

export const DashboardTab: React.FC = () => {
    const { permissions } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [teams, setTeams] = useState<TeamSummary[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberLoginEmail, setNewMemberLoginEmail] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

    const refreshData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData, rolesData, teamsData] = await Promise.all([
            getMembers({ includeLoginEmail: permissions.canManageMembers }),
            getCategories(),
            getRoles(),
            getTeams(),
        ]);
        setMembers(membersData);
        setCategories(categoriesData);
        setRoles(rolesData);
        setTeams(teamsData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [membersData, categoriesData, rolesData, teamsData] = await Promise.all([
                getMembers({ includeLoginEmail: permissions.canManageMembers }),
                getCategories(),
                getRoles(),
                getTeams(),
            ]);

            if (!isMounted) {
                return;
            }

            setMembers(membersData);
            setCategories(categoriesData);
            setRoles(rolesData);
            setTeams(teamsData);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, [permissions.canManageMembers]);

    const filteredMembers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return members;

        return members.filter((member) =>
            [member.name, member.loginEmail ?? '', member.roleName ?? '', member.teamName ?? '', member.status ?? '']
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [members, searchQuery]);

    const handleAddMember = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newMemberName.trim()) return;

        await addMember(newMemberName.trim(), normalizeLoginEmail(newMemberLoginEmail));
        setNewMemberName('');
        setNewMemberLoginEmail('');
        await refreshData();
    };

    const handleDeleteMember = async (id: string) => {
        if (confirm('이 멤버를 목록에서 숨길까요?')) {
            await deleteMember(id);
            await refreshData();
        }
    };

    const handleAward = async (memberId: string, categoryId: string) => {
        await awardPoints(memberId, categoryId);
        await refreshData();
    };

    const handleMemberUpdate = async (
        memberId: string,
        updates: Partial<Pick<Member, 'loginEmail' | 'roleId' | 'teamId' | 'status' | 'isApproved'>>,
    ) => {
        setSavingMemberId(memberId);
        try {
            await updateMember(memberId, updates);
            await refreshData();
        } finally {
            setSavingMemberId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">멤버 디렉터리를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        멤버 관리
                    </h2>
                    <p className="text-slate-500 mt-1">역할, 팀, 상태, 승인 여부, 로그인 이메일, 점수를 한 화면에서 관리합니다.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative block">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="멤버 검색"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-56"
                        />
                    </label>

                    {permissions.canManageMembers && (
                        <form onSubmit={handleAddMember} className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                            <input
                                type="text"
                                placeholder="새 멤버 이름"
                                value={newMemberName}
                                onChange={(event) => setNewMemberName(event.target.value)}
                                className="px-3 py-1.5 outline-none text-sm w-48 bg-transparent"
                            />
                            <input
                                type="email"
                                placeholder="로그인 이메일(선택)"
                                value={newMemberLoginEmail}
                                onChange={(event) => setNewMemberLoginEmail(event.target.value)}
                                className="px-3 py-1.5 outline-none text-sm w-56 bg-transparent border-l border-slate-200"
                            />
                            <button
                                type="submit"
                                disabled={!newMemberName.trim()}
                                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">표시 중인 멤버</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">승인 완료</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.filter((member) => member.isApproved).length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">활동 중 멤버</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.filter((member) => member.status === 'active').length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">참여 팀 수</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{new Set(members.map((member) => member.teamName).filter(Boolean)).size}</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-3 text-sm text-slate-500">
                    화면 폭이 좁으면 표를 좌우로 스크롤해 전체 정보를 확인할 수 있습니다. 로그인 이메일이 등록된 회원만 실제 서비스에 로그인할 수 있습니다.
                </div>
                <div className="overflow-x-auto pb-2">
                    <table className={`${permissions.canManageMembers ? 'min-w-[1720px]' : 'min-w-[1480px]'} w-max text-left border-collapse`}>
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                <th className="py-4 px-6 min-w-[92px] whitespace-nowrap">레벨</th>
                                <th className="py-4 px-6 min-w-[180px] whitespace-nowrap">이름</th>
                                {permissions.canManageMembers && (
                                    <th className="py-4 px-6 min-w-[240px] whitespace-nowrap">로그인 이메일</th>
                                )}
                                <th className="py-4 px-6 min-w-[180px] whitespace-nowrap">역할</th>
                                <th className="py-4 px-6 min-w-[180px] whitespace-nowrap">팀</th>
                                <th className="py-4 px-6 min-w-[140px] whitespace-nowrap">상태</th>
                                <th className="py-4 px-6 min-w-[120px] whitespace-nowrap">승인</th>
                                <th className="py-4 px-6 min-w-[132px] whitespace-nowrap">가입일</th>
                                <th className="py-4 px-6 min-w-[96px] whitespace-nowrap">점수</th>
                                <th className="py-4 px-6 min-w-[380px] whitespace-nowrap">
                                    {permissions.canManagePoints ? '빠른 작업' : '활동 권한'}
                                </th>
                                <th className="py-4 px-6 min-w-[88px] whitespace-nowrap text-center">
                                    {permissions.canManageMembers ? '관리' : '조회'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMembers.map((member) => {
                                const levelInfo = getLevelInfo(member.score);
                                const statusInfo = getStatusInfo(member);
                                const isSavingRow = savingMemberId === member.id;

                                return (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            <span className={`inline-flex min-w-[68px] items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${levelInfo.color}`}>
                                                lv.{levelInfo.level}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            <div className="flex items-center gap-3 whitespace-nowrap">
                                                <span className="font-medium text-slate-900">{member.name}</span>
                                                <span className="text-xs text-slate-500 font-mono">{member.id.slice(0, 8)}</span>
                                            </div>
                                        </td>
                                        {permissions.canManageMembers && (
                                            <td className="py-4 px-6 align-middle whitespace-nowrap">
                                                <input
                                                    key={`${member.id}-${member.loginEmail ?? ''}`}
                                                    type="email"
                                                    defaultValue={member.loginEmail ?? ''}
                                                    placeholder="example@school.kr"
                                                    disabled={isSavingRow}
                                                    onBlur={(event) => {
                                                        const nextValue = normalizeLoginEmail(event.target.value);
                                                        if ((member.loginEmail ?? null) === nextValue) {
                                                            event.target.value = member.loginEmail ?? '';
                                                            return;
                                                        }
                                                        event.target.value = nextValue ?? '';
                                                        void handleMemberUpdate(member.id, { loginEmail: nextValue });
                                                    }}
                                                    onKeyDown={(event) => {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            event.currentTarget.blur();
                                                        }
                                                    }}
                                                    className="min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </td>
                                        )}
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            {permissions.canManageMembers ? (
                                                <select
                                                    value={member.roleId ?? ''}
                                                    disabled={isSavingRow}
                                                    onChange={(event) => {
                                                        const value = event.target.value || null;
                                                        void handleMemberUpdate(member.id, { roleId: value });
                                                    }}
                                                    className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="">미지정</option>
                                                    {roles.map((role) => (
                                                        <option key={role.id} value={role.id}>
                                                            {role.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="text-slate-700 whitespace-nowrap">{member.roleName || '미지정'}</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            {permissions.canManageMembers ? (
                                                <select
                                                    value={member.teamId ?? ''}
                                                    disabled={isSavingRow}
                                                    onChange={(event) => {
                                                        const value = event.target.value || null;
                                                        void handleMemberUpdate(member.id, { teamId: value });
                                                    }}
                                                    className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="">미지정</option>
                                                    {teams.map((team) => (
                                                        <option key={team.id} value={team.id}>
                                                            {team.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="text-slate-700 whitespace-nowrap">{member.teamName || '미지정'}</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            {permissions.canManageMembers ? (
                                                <select
                                                    value={member.status ?? 'active'}
                                                    disabled={isSavingRow}
                                                    onChange={(event) => {
                                                        const value = event.target.value as MemberStatus;
                                                        void handleMemberUpdate(member.id, { status: value });
                                                    }}
                                                    className="min-w-[128px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    {memberStatusOptions.map((status) => (
                                                        <option key={status} value={status}>
                                                            {memberStatusLabels[status]}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.className}`}>
                                                    {statusInfo.label}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            {permissions.canManageMembers ? (
                                                <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
                                                    <input
                                                        type="checkbox"
                                                        checked={member.isApproved}
                                                        disabled={isSavingRow}
                                                        onChange={(event) => {
                                                            void handleMemberUpdate(member.id, { isApproved: event.target.checked });
                                                        }}
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    승인
                                                </label>
                                            ) : (
                                                <span className={`inline-flex whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold border ${
                                                    member.isApproved
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    {member.isApproved ? '승인됨' : '승인 대기'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap text-sm text-slate-600">{formatDate(member.joinedAt)}</td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap">
                                            <div className="font-bold text-lg text-indigo-600">{member.score}점</div>
                                        </td>
                                        <td className="py-4 px-6 align-middle">
                                            {permissions.canManagePoints ? (
                                                <div className="flex min-w-[360px] flex-wrap gap-2">
                                                    {categories.map((category) => (
                                                        <button
                                                            key={category.id}
                                                            onClick={() => handleAward(member.id, category.id)}
                                                            className={`whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${
                                                                category.pointValue > 0
                                                                    ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300'
                                                                    : 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:border-rose-300'
                                                            }`}
                                                        >
                                                            <span>{category.categoryName}</span>
                                                            <span className="font-bold">
                                                                {category.pointValue > 0 ? '+' : ''}
                                                                {category.pointValue}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="whitespace-nowrap text-sm text-slate-500">이 역할은 조회만 가능합니다.</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 align-middle whitespace-nowrap text-center">
                                            {permissions.canManageMembers ? (
                                                <button
                                                    onClick={() => handleDeleteMember(member.id)}
                                                    className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="멤버 숨기기"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={permissions.canManageMembers ? 11 : 10} className="py-12 text-center text-slate-500">
                                        검색 조건에 맞는 멤버가 없습니다.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
