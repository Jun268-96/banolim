import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, History, LayoutGrid, Mail, Network, Plus, Search, ShieldCheck, TableProperties, Trash2, Upload, Users, XCircle } from 'lucide-react';
import type { AppRole, AuditLogEntry, Category, Member, MemberStatus, RoleSummary, TeamSummary } from '../../types';
import {
    addMember,
    awardPoints,
    deleteMember,
    getAuditLogs,
    getCategories,
    getMembers,
    getRoles,
    getTeams,
    updateMember,
} from '../../lib/db';
import { roleLabels, roleScopeDescriptions } from '../../lib/permissions';
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

type MemberViewMode = 'all' | 'pending' | 'approved' | 'inactive';
type MemberDisplayMode = 'table' | 'cards' | 'organization';

const getPreferredMemberDisplayMode = (): MemberDisplayMode => {
    if (typeof window === 'undefined') {
        return 'table';
    }

    return window.innerWidth < 1280 ? 'cards' : 'table';
};

type BulkImportRow = {
    line: number;
    name: string;
    loginEmail: string | null;
    roleName: string | null;
    teamName: string | null;
    status: MemberStatus | null;
    isApproved: boolean | null;
    isVisible: boolean | null;
};

const sampleMemberCsv = `name,login_email,role,team,status,approved,visible
홍길동,hong@example.com,일반회원,기획팀,active,true,true
김운영,manager@example.com,부회장,운영팀,active,true,true`;

const parseDelimitedLine = (line: string) => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];

        if (character === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
                continue;
            }

            inQuotes = !inQuotes;
            continue;
        }

        if (character === ',' && !inQuotes) {
            cells.push(current.trim());
            current = '';
            continue;
        }

        current += character;
    }

    cells.push(current.trim());
    return cells;
};

const normalizeImportHeader = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, '_');

const parseBooleanCell = (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'y', '승인', '승인됨', '노출', '활성'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', '미승인', '비노출', '숨김', '비활성'].includes(normalized)) return false;
    return null;
};

const parseStatusCell = (value: string): MemberStatus | null => {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'active' || normalized === '활동중' || normalized === '활동_중') return 'active';
    if (normalized === 'dormant' || normalized === '휴면' || normalized === '보류') return 'dormant';
    if (normalized === 'inactive' || normalized === '비활성' || normalized === '반려') return 'inactive';
    return null;
};

const parseMemberCsv = (rawText: string): { rows: BulkImportRow[]; errors: string[] } => {
    const lines = rawText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    if (lines.length === 0) {
        return { rows: [], errors: [] };
    }

    const headers = parseDelimitedLine(lines[0]).map(normalizeImportHeader);
    const getCell = (cells: string[], candidates: string[]) => {
        const headerIndex = headers.findIndex((header) => candidates.includes(header));
        return headerIndex >= 0 ? cells[headerIndex] ?? '' : '';
    };

    const rows: BulkImportRow[] = [];
    const errors: string[] = [];

    lines.slice(1).forEach((line, index) => {
        const cells = parseDelimitedLine(line);
        const name = getCell(cells, ['name', '이름']).trim();
        const loginEmail = normalizeLoginEmail(getCell(cells, ['login_email', 'email', '로그인이메일', '이메일']) ?? '');
        const roleName = getCell(cells, ['role', 'role_name', '직책', '역할']).trim() || null;
        const teamName = getCell(cells, ['team', 'team_name', '팀']).trim() || null;
        const status = parseStatusCell(getCell(cells, ['status', '상태']));
        const isApproved = parseBooleanCell(getCell(cells, ['approved', 'is_approved', '승인']));
        const isVisible = parseBooleanCell(getCell(cells, ['visible', 'is_visible', '노출']));
        const lineNumber = index + 2;

        if (!name) {
            errors.push(`${lineNumber}행: 이름이 비어 있습니다.`);
            return;
        }

        rows.push({
            line: lineNumber,
            name,
            loginEmail,
            roleName,
            teamName,
            status,
            isApproved,
            isVisible,
        });
    });

    return { rows, errors };
};

const getApprovalTags = (member: Member) => {
    const tags: Array<{ label: string; className: string }> = [];

    if (!member.loginEmail) {
        tags.push({ label: '이메일 미등록', className: 'border-sky-200 bg-sky-50 text-sky-700' });
    }
    if (!member.isApproved) {
        tags.push({ label: '승인 대기', className: 'border-amber-200 bg-amber-50 text-amber-700' });
    }
    if (member.status === 'dormant') {
        tags.push({ label: '보류', className: 'border-violet-200 bg-violet-50 text-violet-700' });
    }
    if (member.status === 'inactive') {
        tags.push({ label: '반려/비활성', className: 'border-slate-200 bg-slate-100 text-slate-600' });
    }

    return tags;
};

const isAccessReady = (member: Member) => Boolean(member.loginEmail) && member.isApproved && member.status === 'active';

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
};

interface MemberSnapshotCardProps {
    member: Member;
    selected: boolean;
    onSelect: () => void;
    roleScopeLabel: string;
    roleScopeDescription: string;
    compact?: boolean;
}

const MemberSnapshotCard: React.FC<MemberSnapshotCardProps> = ({
    member,
    selected,
    onSelect,
    roleScopeLabel,
    roleScopeDescription,
    compact = false,
}) => {
    const levelInfo = getLevelInfo(member.score);
    const statusInfo = getStatusInfo(member);
    const approvalTags = getApprovalTags(member);

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`text-left transition-all ${
                compact ? 'rounded-[24px] p-4' : 'rounded-[28px] p-5'
            } border ${selected ? 'border-indigo-400 bg-indigo-50/80 shadow-lg shadow-indigo-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className={`${compact ? 'text-lg' : 'text-xl'} font-bold text-slate-900`}>{member.name}</div>
                        <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${levelInfo.color}`}>
                            lv.{levelInfo.level}
                        </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                        직책 {member.roleName ?? '미지정'} · 권한 {roleScopeLabel}
                    </div>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusInfo.className}`}>
                    {statusInfo.label}
                </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                {approvalTags.length > 0 ? (
                    approvalTags.map((tag) => (
                        <span key={`${member.id}-${tag.label}`} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tag.className}`}>
                            {tag.label}
                        </span>
                    ))
                ) : (
                    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        접근 준비 완료
                    </span>
                )}
            </div>

            <div className={`mt-4 grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">로그인 이메일</div>
                    <div className="mt-2 break-all text-sm font-medium text-slate-700">{member.loginEmail ?? '아직 등록되지 않았습니다.'}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">소속</div>
                    <div className="mt-2 text-sm font-medium text-slate-700">{member.teamName ?? '미지정'}</div>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">시스템 권한 설명</div>
                <div className="mt-2 text-sm leading-6 text-slate-100">{roleScopeDescription}</div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
                <div className="text-slate-500">가입일 {formatDate(member.joinedAt)}</div>
                <div className="font-bold text-indigo-600">{member.score}점</div>
            </div>
        </button>
    );
};

const getEntryChanges = (entry: AuditLogEntry) => {
    if (!entry.diff || typeof entry.diff !== 'object') {
        return {};
    }

    const maybeChanges = (entry.diff as Record<string, unknown>).changes;
    return maybeChanges && typeof maybeChanges === 'object' ? (maybeChanges as Record<string, unknown>) : {};
};

const getHistoryChangeBadges = (entry: AuditLogEntry) => {
    const changes = getEntryChanges(entry);
    const badges: string[] = [];

    if (changes.role) badges.push('직책/권한');
    if (changes.loginEmail) badges.push('로그인 이메일');
    if (changes.team) badges.push('팀');
    if (changes.status) badges.push('상태');
    if (changes.approval) badges.push('승인');
    if (changes.visibility) badges.push('노출');
    if (changes.name) badges.push('이름');

    return badges;
};

export const DashboardTab: React.FC = () => {
    const { permissions } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [teams, setTeams] = useState<TeamSummary[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberLoginEmail, setNewMemberLoginEmail] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [memberView, setMemberView] = useState<MemberViewMode>('all');
    const [displayMode, setDisplayMode] = useState<MemberDisplayMode>(() => getPreferredMemberDisplayMode());
    const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
    const [bulkCsvText, setBulkCsvText] = useState('');
    const [bulkImportStatus, setBulkImportStatus] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
    const [isImportingMembers, setIsImportingMembers] = useState(false);

    const refreshData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData, rolesData, teamsData, auditLogData] = await Promise.all([
            getMembers({ includeLoginEmail: permissions.canManageMembers }),
            getCategories(),
            getRoles(),
            getTeams(),
            permissions.canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
        ]);
        setMembers(membersData);
        setCategories(categoriesData);
        setRoles(rolesData);
        setTeams(teamsData);
        setAuditLogs(auditLogData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [membersData, categoriesData, rolesData, teamsData, auditLogData] = await Promise.all([
                getMembers({ includeLoginEmail: permissions.canManageMembers }),
                getCategories(),
                getRoles(),
                getTeams(),
                permissions.canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
            ]);

            if (!isMounted) {
                return;
            }

            setMembers(membersData);
            setCategories(categoriesData);
            setRoles(rolesData);
            setTeams(teamsData);
            setAuditLogs(auditLogData);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, [permissions.canManageMembers]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const mediaQuery = window.matchMedia('(min-width: 1280px)');
        const handleBreakpointChange = (event: MediaQueryListEvent) => {
            setDisplayMode((current) => {
                if (event.matches) {
                    return current === 'cards' ? 'table' : current;
                }

                if (current === 'table' || current === 'organization') {
                    return 'cards';
                }

                return current;
            });
        };

        mediaQuery.addEventListener('change', handleBreakpointChange);
        return () => mediaQuery.removeEventListener('change', handleBreakpointChange);
    }, []);

    const approvalQueue = useMemo(
        () =>
            members
                .filter((member) => !isAccessReady(member))
                .sort((a, b) => {
                    const approvalDiff = Number(a.isApproved) - Number(b.isApproved);
                    if (approvalDiff !== 0) return approvalDiff;
                    return (a.joinedAt ?? '').localeCompare(b.joinedAt ?? '');
                }),
        [members],
    );

    const viewScopedMembers = useMemo(() => {
        if (memberView === 'pending') {
            return approvalQueue;
        }

        if (memberView === 'approved') {
            return members.filter((member) => isAccessReady(member));
        }

        if (memberView === 'inactive') {
            return members.filter((member) => member.status === 'inactive');
        }

        return members;
    }, [approvalQueue, memberView, members]);

    const filteredMembers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return viewScopedMembers;

        return viewScopedMembers.filter((member) =>
            [member.name, member.loginEmail ?? '', member.roleName ?? '', member.teamName ?? '', member.status ?? '']
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [searchQuery, viewScopedMembers]);

    const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
    const roleByName = useMemo(() => new Map(roles.map((role) => [role.name.trim().toLowerCase(), role])), [roles]);
    const teamByName = useMemo(() => new Map(teams.map((team) => [team.name.trim().toLowerCase(), team])), [teams]);

    const getRoleScopeLabel = (member: Member) => {
        const permissionScope = roleById.get(member.roleId ?? '')?.permissionScope as AppRole | undefined;
        return permissionScope ? roleLabels[permissionScope] ?? permissionScope : '회원';
    };

    const getRoleScopeDescription = (member: Member) => {
        const permissionScope = roleById.get(member.roleId ?? '')?.permissionScope as AppRole | undefined;
        return permissionScope ? roleScopeDescriptions[permissionScope] ?? permissionScope : '권한 범위가 아직 지정되지 않았습니다.';
    };

    const accessPreparation = useMemo(
        () => ({
            total: members.filter((member) => !isAccessReady(member)).length,
            missingEmail: members.filter((member) => !member.loginEmail).length,
            waitingApproval: members.filter((member) => member.loginEmail && !member.isApproved && member.status !== 'inactive').length,
            dormantOrInactive: members.filter((member) => member.status === 'dormant' || member.status === 'inactive').length,
        }),
        [members],
    );

    const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

    const organizationGroups = useMemo(() => {
        const grouped = new Map<string, { roleId: string | null; roleName: string; permissionScope: string; members: Member[]; rankOrder: number }>();

        filteredMembers.forEach((member) => {
            const role = roleById.get(member.roleId ?? '') ?? null;
            const key = member.roleId ?? `unassigned-${member.roleName ?? '미지정'}`;
            const existing = grouped.get(key) ?? {
                roleId: member.roleId ?? null,
                roleName: member.roleName ?? '미지정',
                permissionScope: role?.permissionScope ?? 'member',
                members: [],
                rankOrder: role?.rankOrder ?? 999,
            };

            existing.members.push(member);
            grouped.set(key, existing);
        });

        return [...grouped.values()]
            .sort((a, b) => a.rankOrder - b.rankOrder || a.roleName.localeCompare(b.roleName))
            .map((group) => ({
                ...group,
                members: [...group.members].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
            }));
    }, [filteredMembers, roleById]);

    useEffect(() => {
        if (!filteredMembers.length) {
            setHistoryMemberId(null);
            return;
        }

        if (!historyMemberId || !filteredMembers.some((member) => member.id === historyMemberId)) {
            setHistoryMemberId(filteredMembers[0]?.id ?? null);
        }
    }, [filteredMembers, historyMemberId]);

    const historyMember = historyMemberId ? memberById.get(historyMemberId) ?? null : null;

    const memberHistoryEntries = useMemo(() => {
        if (!historyMemberId) {
            return [] as AuditLogEntry[];
        }

        return auditLogs
            .filter((entry) => entry.entityId === historyMemberId)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 8);
    }, [auditLogs, historyMemberId]);

    const parsedBulkImport = useMemo(() => parseMemberCsv(bulkCsvText), [bulkCsvText]);

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

    const handleMemberCsvFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const text = await file.text();
        setBulkCsvText(text);
        setBulkImportStatus(`${file.name} 파일을 불러왔습니다.`);
        event.target.value = '';
    };

    const handleBulkImportMembers = async () => {
        if (parsedBulkImport.rows.length === 0 || parsedBulkImport.errors.length > 0) {
            return;
        }

        setIsImportingMembers(true);
        setBulkImportStatus(null);

        try {
            let createdCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;

            const membersByEmail = new Map(
                members
                    .filter((member) => member.loginEmail)
                    .map((member) => [member.loginEmail!.trim().toLowerCase(), member]),
            );
            const membersByName = new Map(members.map((member) => [member.name.trim().toLowerCase(), member]));

            for (const row of parsedBulkImport.rows) {
                const matchedByEmail = row.loginEmail ? membersByEmail.get(row.loginEmail) ?? null : null;
                const matchedMember = matchedByEmail ?? membersByName.get(row.name.trim().toLowerCase()) ?? null;
                const matchedRole = row.roleName ? roleByName.get(row.roleName.trim().toLowerCase()) ?? null : null;
                const matchedTeam = row.teamName ? teamByName.get(row.teamName.trim().toLowerCase()) ?? null : null;

                if (row.roleName && !matchedRole) {
                    skippedCount += 1;
                    continue;
                }

                if (row.teamName && !matchedTeam) {
                    skippedCount += 1;
                    continue;
                }

                if (!matchedMember) {
                    const createdMember = await addMember(row.name, row.loginEmail);
                    const updates: Partial<Pick<Member, 'loginEmail' | 'roleId' | 'teamId' | 'status' | 'isApproved' | 'isVisible'>> = {};
                    if (row.loginEmail) updates.loginEmail = row.loginEmail;
                    if (matchedRole) updates.roleId = matchedRole.id;
                    if (matchedTeam) updates.teamId = matchedTeam.id;
                    if (row.status) updates.status = row.status;
                    if (row.isApproved !== null) updates.isApproved = row.isApproved;
                    if (row.isVisible !== null) updates.isVisible = row.isVisible;
                    if (Object.keys(updates).length > 0) {
                        await updateMember(createdMember.id, updates);
                    }
                    createdCount += 1;
                    continue;
                }

                const updates: Partial<Pick<Member, 'name' | 'loginEmail' | 'roleId' | 'teamId' | 'status' | 'isApproved' | 'isVisible'>> = {};
                if (matchedMember.name !== row.name) updates.name = row.name;
                if (row.loginEmail && row.loginEmail !== (matchedMember.loginEmail ?? null)) updates.loginEmail = row.loginEmail;
                if (matchedRole && matchedRole.id !== (matchedMember.roleId ?? null)) updates.roleId = matchedRole.id;
                if (matchedTeam && matchedTeam.id !== (matchedMember.teamId ?? null)) updates.teamId = matchedTeam.id;
                if (row.status && row.status !== (matchedMember.status ?? 'active')) updates.status = row.status;
                if (row.isApproved !== null && row.isApproved !== matchedMember.isApproved) updates.isApproved = row.isApproved;
                if (row.isVisible !== null && row.isVisible !== (matchedMember.isVisible ?? true)) updates.isVisible = row.isVisible;

                if (Object.keys(updates).length === 0) {
                    skippedCount += 1;
                    continue;
                }

                await updateMember(matchedMember.id, updates);
                updatedCount += 1;
            }

            await refreshData();
            setBulkImportStatus(`대량 등록 완료: 신규 ${createdCount}명, 업데이트 ${updatedCount}명, 건너뜀 ${skippedCount}명`);
        } finally {
            setIsImportingMembers(false);
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
            <header className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        멤버 관리
                    </h2>
                    <p className="text-slate-500 mt-1">역할, 팀, 상태, 승인 여부, 로그인 이메일, 점수를 한 화면에서 관리합니다.</p>
                </div>

                <div className="flex w-full flex-col gap-3 2xl:w-auto 2xl:min-w-[420px]">
                    <label className="relative block">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="멤버 검색"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 2xl:w-72"
                        />
                    </label>

                    {permissions.canManageMembers && (
                        <form onSubmit={handleAddMember} className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <input
                                type="text"
                                placeholder="새 멤버 이름"
                                value={newMemberName}
                                onChange={(event) => setNewMemberName(event.target.value)}
                                className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                            />
                            <input
                                type="email"
                                placeholder="로그인 이메일(선택)"
                                value={newMemberLoginEmail}
                                onChange={(event) => setNewMemberLoginEmail(event.target.value)}
                                className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none focus:bg-white"
                            />
                            <button
                                type="submit"
                                disabled={!newMemberName.trim()}
                                className="inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">표시 중인 멤버</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">접근 준비 필요</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{accessPreparation.total}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">즉시 접근 가능</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.filter((member) => isAccessReady(member)).length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">참여 팀 수</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{new Set(members.map((member) => member.teamName).filter(Boolean)).size}</div>
                </div>
            </div>

            {permissions.canManageMembers && (
                <section className="rounded-2xl border border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-sky-50 p-6 shadow-sm">
                    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                        <div className="max-w-3xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-sm font-semibold text-indigo-700">
                                <ShieldCheck size={14} />
                                관리자 온보딩 가이드
                            </div>
                            <h3 className="mt-4 text-xl font-bold text-slate-900">직책 이름과 시스템 권한을 분리해서 등록하세요.</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                이 화면에서 관리하는 것은 단순 승인 대기가 아니라 <span className="font-semibold text-slate-900">서비스 접근 준비</span>입니다.
                                회원이 로그인할 수 있으려면 <span className="font-semibold text-slate-900">로그인 이메일 등록</span>, <span className="font-semibold text-slate-900">직책 선택</span>,
                                <span className="font-semibold text-slate-900">승인 완료</span>, <span className="font-semibold text-slate-900">활동 중 상태</span>가 함께 맞아야 합니다.
                            </p>
                            <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div className="font-semibold text-slate-900">1. 이메일 먼저 등록</div>
                                    <div className="mt-1">로그인에 사용할 실제 이메일을 넣어야 OTP 로그인과 회원 매칭이 됩니다.</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div className="font-semibold text-slate-900">2. 직책과 권한을 분리</div>
                                    <div className="mt-1">예: 회장과 개발 관리자는 서로 다른 직책 이름이지만 같은 최고 관리자 권한을 가질 수 있습니다.</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div className="font-semibold text-slate-900">3. 승인 완료</div>
                                    <div className="mt-1">이메일이 등록된 뒤 승인 체크를 켜면 바로 서비스 접근이 가능합니다.</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div className="font-semibold text-slate-900">4. 상태 확인</div>
                                    <div className="mt-1">휴면 또는 비활성 상태면 로그인 이메일이 있어도 접근이 막힙니다.</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3 2xl:w-[280px] 2xl:grid-cols-1">
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">이메일 미등록</div>
                                <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.missingEmail}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">승인 필요</div>
                                <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.waitingApproval}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">보류/비활성</div>
                                <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.dormantOrInactive}</div>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {permissions.canManageMembers && (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-5 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                <Upload size={18} className="text-indigo-600" />
                                CSV 대량 등록
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                                이름을 기준으로 새 멤버를 만들고, 로그인 이메일 또는 이름이 같은 기존 멤버는 역할·팀·상태 정보를 한 번에 갱신합니다.
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                            <div className="font-semibold text-slate-900">지원 헤더</div>
                            <div className="mt-1">name, login_email, role, team, status, approved, visible</div>
                        </div>
                    </div>

                    <div className="grid gap-6 p-5 sm:p-6 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                                    <Upload size={16} />
                                    CSV 파일 불러오기
                                    <input
                                        type="file"
                                        accept=".csv,text/csv"
                                        onChange={(event) => void handleMemberCsvFile(event)}
                                        className="hidden"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setBulkCsvText(sampleMemberCsv)}
                                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                                >
                                    <FileText size={16} />
                                    예시 채우기
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBulkCsvText('');
                                        setBulkImportStatus(null);
                                    }}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    초기화
                                </button>
                            </div>

                            <textarea
                                value={bulkCsvText}
                                onChange={(event) => setBulkCsvText(event.target.value)}
                                rows={12}
                                placeholder="CSV를 붙여넣거나 파일을 불러오세요."
                                className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-mono leading-6 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />

                            {bulkImportStatus && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                    {bulkImportStatus}
                                </div>
                            )}

                            {parsedBulkImport.errors.length > 0 && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {parsedBulkImport.errors.join(' / ')}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => void handleBulkImportMembers()}
                                disabled={parsedBulkImport.rows.length === 0 || parsedBulkImport.errors.length > 0 || isImportingMembers}
                                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Upload size={16} />
                                {isImportingMembers ? '대량 등록 처리 중...' : '대량 등록 실행'}
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white">
                                <div className="text-sm font-semibold text-slate-300">미리보기</div>
                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">행 수</div>
                                        <div className="mt-2 text-xl font-bold">{parsedBulkImport.rows.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">오류</div>
                                        <div className="mt-2 text-xl font-bold">{parsedBulkImport.errors.length}</div>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">이메일 포함</div>
                                        <div className="mt-2 text-xl font-bold">{parsedBulkImport.rows.filter((row) => row.loginEmail).length}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm font-semibold text-slate-900">처리 규칙</div>
                                <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                                    <div>새 멤버는 `name`으로 생성되고, `login_email`이 있으면 로그인 준비까지 바로 이어집니다.</div>
                                    <div>기존 멤버는 `login_email` 우선, 없으면 `name` 기준으로 찾아 업데이트합니다.</div>
                                    <div>`role`, `team`은 현재 시스템에 이미 등록된 이름과 정확히 맞아야 반영됩니다.</div>
                                    <div>`status`는 `active`, `dormant`, `inactive` 또는 한글 값으로 넣을 수 있습니다.</div>
                                </div>
                            </div>

                            <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
                                {parsedBulkImport.rows.slice(0, 5).map((row) => (
                                    <div key={`${row.line}-${row.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="font-medium text-slate-900">{row.name}</div>
                                            <div className="text-xs font-semibold text-slate-400">{row.line}행</div>
                                        </div>
                                        <div className="mt-2 text-sm text-slate-600">
                                            {row.loginEmail ?? '이메일 없음'}
                                            <span className="text-slate-300"> · </span>
                                            {row.roleName ?? '직책 미지정'}
                                            <span className="text-slate-300"> · </span>
                                            {row.teamName ?? '팀 미지정'}
                                        </div>
                                    </div>
                                ))}

                                {parsedBulkImport.rows.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                                        CSV를 불러오면 여기서 상위 5개 행을 먼저 확인할 수 있습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {permissions.canManageMembers && (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                <ShieldCheck size={18} className="text-indigo-600" />
                                접근 준비 큐
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                                아직 로그인 준비가 끝나지 않은 회원 목록입니다. 이메일 등록, 승인 여부, 회원 상태를 확인한 뒤 접근 가능 상태로 바꿉니다.
                            </div>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600">
                            <Clock3 size={16} className="text-amber-600" />
                            처리 대상 {approvalQueue.length}명
                        </div>
                    </div>

                    <div className="grid gap-4 p-5 sm:p-6 2xl:grid-cols-2">
                        {approvalQueue.slice(0, 6).map((member) => {
                            const approvalTags = getApprovalTags(member);
                            const isSavingRow = savingMemberId === member.id;
                            const canApprove = Boolean(member.loginEmail);

                            return (
                                <div key={member.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-lg font-bold text-slate-900">{member.name}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {member.loginEmail ?? '로그인 이메일이 아직 등록되지 않았습니다.'}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {approvalTags.map((tag) => (
                                                    <span key={tag.label} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tag.className}`}>
                                                        {tag.label}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="text-sm text-slate-500">
                                                직책 {member.roleName ?? '미지정'} · 시스템 권한 {getRoleScopeLabel(member)} · 팀 {member.teamName ?? '미지정'} · 가입일 {formatDate(member.joinedAt)}
                                            </div>
                                            <div className="max-w-xl text-xs leading-5 text-slate-500">
                                                {getRoleScopeDescription(member)}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 lg:justify-end 2xl:min-w-[220px]">
                                            <button
                                                type="button"
                                                disabled={isSavingRow || !canApprove}
                                                onClick={() => {
                                                    void handleMemberUpdate(member.id, { isApproved: true, status: 'active' });
                                                }}
                                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <CheckCircle2 size={16} />
                                                즉시 승인
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSavingRow}
                                                onClick={() => {
                                                    void handleMemberUpdate(member.id, { isApproved: false, status: 'dormant' });
                                                }}
                                                className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <Clock3 size={16} />
                                                보류
                                            </button>
                                            <button
                                                type="button"
                                                disabled={isSavingRow}
                                                onClick={() => {
                                                    void handleMemberUpdate(member.id, { isApproved: false, status: 'inactive' });
                                                }}
                                                className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                <XCircle size={16} />
                                                반려
                                            </button>
                                        </div>
                                    </div>

                                    {!canApprove && (
                                        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                                            <Mail size={14} />
                                            로그인 이메일을 먼저 입력해야 승인할 수 있습니다.
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {approvalQueue.length === 0 && (
                            <div className="xl:col-span-2 rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                                <div className="text-lg font-semibold text-emerald-800">현재 처리할 접근 준비 대상이 없습니다.</div>
                                <div className="mt-2 text-sm text-emerald-700">로그인 이메일이 등록되고 승인된 회원은 즉시 서비스에 접근할 수 있습니다.</div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-3 text-sm text-slate-500">
                    로그인 이메일이 등록된 회원만 실제 서비스에 로그인할 수 있습니다. 표 보기는 편집용, 카드/조직도 보기는 구조 파악용입니다.
                </div>
                <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:px-6 2xl:flex-row 2xl:items-center 2xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        {([
                            { id: 'all' as const, label: '전체', count: members.length },
                            { id: 'pending' as const, label: '접근 준비 필요', count: approvalQueue.length },
                            { id: 'approved' as const, label: '즉시 접근 가능', count: members.filter((member) => isAccessReady(member)).length },
                            { id: 'inactive' as const, label: '비활성', count: members.filter((member) => member.status === 'inactive').length },
                        ]).map((option) => (
                            <button
                                key={option.id}
                                type="button"
                                onClick={() => setMemberView(option.id)}
                                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                                    memberView === option.id
                                        ? 'bg-indigo-600 text-white'
                                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                }`}
                            >
                                {option.label} {option.count}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 gap-2 rounded-[24px] border border-slate-200 bg-slate-50 p-2 sm:grid-cols-3">
                        {([
                            { id: 'table' as const, label: '표 보기', icon: TableProperties },
                            { id: 'cards' as const, label: '카드 보기', icon: LayoutGrid },
                            { id: 'organization' as const, label: '조직도 보기', icon: Network },
                        ]).map((mode) => {
                            const Icon = mode.icon;
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() => setDisplayMode(mode.id)}
                                    className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                                        displayMode === mode.id
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-600 hover:bg-white'
                                    }`}
                                >
                                    <Icon size={16} />
                                    {mode.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {displayMode === 'table' && (
                    <div className="overflow-x-auto pb-2">
                        <table className={`${permissions.canManageMembers ? 'min-w-[1720px]' : 'min-w-[1480px]'} w-max text-left border-collapse`}>
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                    <th className="py-4 px-6 min-w-[92px] whitespace-nowrap">레벨</th>
                                    <th className="py-4 px-6 min-w-[180px] whitespace-nowrap">이름</th>
                                    {permissions.canManageMembers && (
                                        <th className="py-4 px-6 min-w-[240px] whitespace-nowrap">로그인 이메일</th>
                                    )}
                                    <th className="py-4 px-6 min-w-[220px] whitespace-nowrap">직책 / 시스템 권한</th>
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
                                        <tr
                                            key={member.id}
                                            className={`transition-colors group ${historyMemberId === member.id ? 'bg-indigo-50/70' : 'hover:bg-slate-50/50'}`}
                                            onClick={() => setHistoryMemberId(member.id)}
                                        >
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
                                                        onClick={(event) => event.stopPropagation()}
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
                                                    <div onClick={(event) => event.stopPropagation()}>
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
                                                                    {role.name} · {roleLabels[role.permissionScope as AppRole] ?? role.permissionScope}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="mt-1 text-xs text-slate-500">
                                                            현재 권한: {getRoleScopeLabel(member)}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="whitespace-nowrap">
                                                        <div className="text-slate-700">{member.roleName || '미지정'}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{getRoleScopeLabel(member)}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 align-middle whitespace-nowrap">
                                                {permissions.canManageMembers ? (
                                                    <select
                                                        value={member.teamId ?? ''}
                                                        disabled={isSavingRow}
                                                        onClick={(event) => event.stopPropagation()}
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
                                                        onClick={(event) => event.stopPropagation()}
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
                                                    <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-700" onClick={(event) => event.stopPropagation()}>
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
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    void handleAward(member.id, category.id);
                                                                }}
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
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void handleDeleteMember(member.id);
                                                        }}
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
                )}

                {displayMode === 'cards' && (
                    <div className="grid gap-4 p-5 sm:p-6 lg:grid-cols-2 2xl:grid-cols-3">
                        {filteredMembers.map((member) => (
                            <MemberSnapshotCard
                                key={member.id}
                                member={member}
                                selected={historyMemberId === member.id}
                                onSelect={() => setHistoryMemberId(member.id)}
                                roleScopeLabel={getRoleScopeLabel(member)}
                                roleScopeDescription={getRoleScopeDescription(member)}
                            />
                        ))}
                        {filteredMembers.length === 0 && (
                            <div className="md:col-span-2 2xl:col-span-3 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                                검색 조건에 맞는 멤버가 없습니다.
                            </div>
                        )}
                    </div>
                )}

                {displayMode === 'organization' && (
                    <div className="space-y-5 p-6">
                        <div className="rounded-[28px] border border-slate-200 bg-slate-950 px-5 py-5 text-white">
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                                <Network size={16} />
                                조직도형 보기
                            </div>
                            <div className="mt-2 text-sm leading-6 text-slate-300">
                                직책 lane별로 멤버를 묶어 구조를 확인합니다. 운영 권한이 같은 다른 직책도 한눈에 비교할 수 있습니다.
                            </div>
                        </div>

                        <div className="grid gap-4 2xl:grid-cols-2">
                            {organizationGroups.map((group) => (
                                <section key={`${group.roleId ?? group.roleName}-lane`} className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                                    <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-lg font-bold text-slate-900">{group.roleName}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {roleLabels[group.permissionScope as AppRole] ?? group.permissionScope}
                                                </div>
                                            </div>
                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                                                {group.members.length}명
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3">
                                        {group.members.map((member) => (
                                            <MemberSnapshotCard
                                                key={member.id}
                                                member={member}
                                                selected={historyMemberId === member.id}
                                                onSelect={() => setHistoryMemberId(member.id)}
                                                roleScopeLabel={getRoleScopeLabel(member)}
                                                roleScopeDescription={getRoleScopeDescription(member)}
                                                compact
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                            {organizationGroups.length === 0 && (
                                <div className="xl:col-span-2 2xl:col-span-3 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                                    검색 조건에 맞는 멤버가 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {permissions.canManageMembers && (
                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                <History size={18} className="text-indigo-600" />
                                직책/접근 변경 이력
                            </div>
                            <div className="mt-1 text-sm text-slate-500">
                                멤버 카드와 표에서 바뀐 로그인 이메일, 직책, 승인 상태, 소속 변경을 감사 로그로 추적합니다.
                            </div>
                        </div>
                        <label className="space-y-1.5 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">이력 기준 멤버</span>
                            <select
                                value={historyMemberId ?? ''}
                                onChange={(event) => setHistoryMemberId(event.target.value || null)}
                                className="min-w-[220px] rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {members.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="grid gap-6 p-5 sm:p-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
                        <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
                            <div className="text-sm font-semibold text-slate-300">선택한 멤버</div>
                            {historyMember ? (
                                <>
                                    <div className="mt-3 text-2xl font-bold">{historyMember.name}</div>
                                    <div className="mt-2 text-sm text-slate-300">
                                        직책 {historyMember.roleName ?? '미지정'} · 권한 {getRoleScopeLabel(historyMember)}
                                    </div>
                                    <div className="mt-5 space-y-3">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">로그인 이메일</div>
                                            <div className="mt-2 break-all text-sm font-medium text-white">{historyMember.loginEmail ?? '아직 없음'}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">현재 상태</div>
                                            <div className="mt-2 text-sm font-medium text-white">
                                                {memberStatusLabels[historyMember.status ?? 'active']} · {historyMember.isApproved ? '승인됨' : '승인 필요'}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">최근 변경</div>
                                            <div className="mt-2 text-sm leading-6 text-slate-200">
                                                {memberHistoryEntries[0]?.summary ?? '아직 멤버 변경 이력이 없습니다. 이번 버전 이후 변경부터 누적됩니다.'}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="mt-3 text-sm text-slate-300">먼저 멤버를 선택해 주세요.</div>
                            )}
                        </div>

                        <div className="space-y-3">
                            {memberHistoryEntries.map((entry) => {
                                const changeBadges = getHistoryChangeBadges(entry);
                                return (
                                    <div key={entry.id} className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="font-semibold text-slate-900">{entry.summary}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {entry.actorName ?? '시스템'} · {formatDateTime(entry.createdAt)}
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {changeBadges.length > 0 ? changeBadges.map((badge) => (
                                                    <span key={`${entry.id}-${badge}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                        {badge}
                                                    </span>
                                                )) : (
                                                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                        변경 기록
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {historyMember && memberHistoryEntries.length === 0 && (
                                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                                    {historyMember.name}의 역할 변경 이력이 아직 없습니다. 이번 버전 이후부터 직책, 이메일, 승인 상태 변경이 자동으로 누적됩니다.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};
