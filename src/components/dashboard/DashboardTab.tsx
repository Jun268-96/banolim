import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, CheckCircle2, CircleHelp, Clock3, FileText, History, KeyRound, Mail, Network, Search, ShieldAlert, TableProperties, Trash2, Upload, UserPlus, Users, XCircle } from 'lucide-react';
import type { AuditLogEntry, Member, MemberStatus, RoleSummary, TeamSummary, TeamType } from '../../types';
import {
    addTeam,
    addMember,
    deleteMember,
    getAuditLogs,
    getMembers,
    provisionMemberPasswordAuth,
    getRoles,
    getTeams,
    setMemberTeams,
    updateMember,
} from '../../lib/db';
import { useAuth } from '../auth/auth-context';
import { AppDialog } from '../shared/AppDialog';

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

const dedupeTeamIds = (teamIds: Array<string | null | undefined>) => [...new Set(teamIds.filter((teamId): teamId is string => Boolean(teamId)))];

type MemberViewMode = 'all' | 'pending' | 'approved' | 'inactive';
type MemberDisplayMode = 'table' | 'teams' | 'organization';
type MemberSortMode = 'name-asc' | 'name-desc' | 'joined-desc' | 'role-order';

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

const teamTypeOptions: TeamType[] = ['core', 'study', 'project'];
const teamTypeLabels: Record<TeamType, string> = {
    core: '운영',
    study: '스터디',
    project: '프로젝트',
};

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

const getAccountProvisionLabel = (member: Member) => {
    if (!member.loginEmail) {
        return { label: '이메일 필요', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }

    if (!member.authUserId) {
        return { label: '계정 미발급', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    }

    if (member.passwordResetRequired) {
        return { label: '첫 로그인 대기', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    }

    return { label: '계정 활성', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(new Date(value));
};

interface OrganizationNodeProps {
    member: Member;
    selected: boolean;
    onSelect: () => void;
}

const OrganizationNode: React.FC<OrganizationNodeProps> = ({
    member,
    selected,
    onSelect,
}) => (
    <button
        type="button"
        onClick={onSelect}
        className={`relative flex min-h-[88px] w-full flex-col items-center justify-center rounded-xl border px-4 py-3 text-center transition-all ${
            selected
                ? 'border-blue-700 bg-blue-700 text-white shadow-lg shadow-blue-200'
                : 'border-blue-500 bg-blue-500 text-white hover:border-blue-600 hover:bg-blue-600 hover:shadow-md hover:shadow-blue-100'
        }`}
    >
        <div className="text-base font-bold">{member.name}</div>
        <div className={`mt-1 text-xs font-medium ${selected ? 'text-blue-100' : 'text-blue-50'}`}>
            {member.roleName ?? '직책 미지정'}
        </div>
    </button>
);

const getMemberTeamLabels = (member: Member) => {
    const labels = member.teamNames ?? [];
    if (labels.length > 0) {
        return labels;
    }

    return member.teamName ? [member.teamName] : [];
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
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [teams, setTeams] = useState<TeamSummary[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberLoginEmail, setNewMemberLoginEmail] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamType, setNewTeamType] = useState<TeamType>('core');
    const [searchQuery, setSearchQuery] = useState('');
    const [memberView, setMemberView] = useState<MemberViewMode>('all');
    const [displayMode, setDisplayMode] = useState<MemberDisplayMode>('table');
    const [sortMode, setSortMode] = useState<MemberSortMode>('role-order');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
    const [selectedTeamManagementId, setSelectedTeamManagementId] = useState<string | null>(null);
    const [teamAssignmentQuery, setTeamAssignmentQuery] = useState('');
    const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
    const [bulkCsvText, setBulkCsvText] = useState('');
    const [bulkImportStatus, setBulkImportStatus] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
    const [savingTeamMemberId, setSavingTeamMemberId] = useState<string | null>(null);
    const [isImportingMembers, setIsImportingMembers] = useState(false);
    const [provisioningMemberId, setProvisioningMemberId] = useState<string | null>(null);
    const [provisionedAccount, setProvisionedAccount] = useState<{
        memberName: string;
        email: string;
        temporaryPassword: string;
        isExistingAccount: boolean;
    } | null>(null);
    const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false);
    const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
    const [isQueueDialogOpen, setIsQueueDialogOpen] = useState(false);
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);

    const refreshData = async () => {
        setIsLoading(true);
        const [membersData, rolesData, teamsData, auditLogData] = await Promise.all([
            getMembers({ includeLoginEmail: permissions.canManageMembers }),
            getRoles(),
            getTeams(),
            permissions.canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
        ]);
        setMembers(membersData);
        setRoles(rolesData);
        setTeams(teamsData);
        setAuditLogs(auditLogData);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [membersData, rolesData, teamsData, auditLogData] = await Promise.all([
                getMembers({ includeLoginEmail: permissions.canManageMembers }),
                getRoles(),
                getTeams(),
                permissions.canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
            ]);

            if (!isMounted) {
                return;
            }

            setMembers(membersData);
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

    const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
    const roleByName = useMemo(() => new Map(roles.map((role) => [role.name.trim().toLowerCase(), role])), [roles]);
    const teamByName = useMemo(() => new Map(teams.map((team) => [team.name.trim().toLowerCase(), team])), [teams]);

    const filteredMembers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const roleFiltered = selectedRoleFilter === 'all'
            ? viewScopedMembers
            : viewScopedMembers.filter((member) => (member.roleId ?? '') === selectedRoleFilter);
        const teamFiltered = selectedTeamFilter === 'all'
            ? roleFiltered
            : roleFiltered.filter((member) => (member.teamIds ?? []).includes(selectedTeamFilter) || (member.teamId ?? '') === selectedTeamFilter);
        const searched = query
            ? teamFiltered.filter((member) => member.name.toLowerCase().includes(query))
            : teamFiltered;

        return [...searched].sort((a, b) => {
            switch (sortMode) {
                case 'name-asc':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'joined-desc':
                    return (b.joinedAt ?? '').localeCompare(a.joinedAt ?? '');
                case 'role-order': {
                    const roleA = roleById.get(a.roleId ?? '')?.rankOrder ?? 999;
                    const roleB = roleById.get(b.roleId ?? '')?.rankOrder ?? 999;
                    return roleA - roleB || a.name.localeCompare(b.name);
                }
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }, [roleById, searchQuery, selectedRoleFilter, selectedTeamFilter, sortMode, viewScopedMembers]);

    const accessPreparation = useMemo(
        () => ({
            total: members.filter((member) => !isAccessReady(member)).length,
            missingEmail: members.filter((member) => !member.loginEmail).length,
            waitingApproval: members.filter((member) => member.loginEmail && !member.isApproved && member.status !== 'inactive').length,
            dormantOrInactive: members.filter((member) => member.status === 'dormant' || member.status === 'inactive').length,
        }),
        [members],
    );

    const participatingTeamCount = useMemo(
        () => new Set(members.flatMap((member) => member.teamIds ?? (member.teamId ? [member.teamId] : []))).size,
        [members],
    );

    const selectedTeamForManagement = useMemo(
        () => teams.find((team) => team.id === selectedTeamManagementId) ?? teams[0] ?? null,
        [selectedTeamManagementId, teams],
    );

    const teamMembers = useMemo(() => {
        if (!selectedTeamForManagement) {
            return [];
        }

        return [...members]
            .filter((member) => {
                const teamIds = member.teamIds ?? [];
                return teamIds.includes(selectedTeamForManagement.id) || member.teamId === selectedTeamForManagement.id;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [members, selectedTeamForManagement]);

    const assignableMembers = useMemo(() => {
        const query = teamAssignmentQuery.trim().toLowerCase();
        const baseRows = [...members].sort((a, b) => a.name.localeCompare(b.name));

        if (!query) {
            return baseRows;
        }

        return baseRows.filter((member) => {
            const roleName = member.roleName?.toLowerCase() ?? '';
            return member.name.toLowerCase().includes(query) || roleName.includes(query);
        });
    }, [members, teamAssignmentQuery]);

    const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
    const memberNameSuggestions = useMemo(
        () => [...new Set(members.map((member) => member.name))].sort((a, b) => a.localeCompare(b)),
        [members],
    );

    const organizationLevels = useMemo(() => {
        const groupedByRank = new Map<number, Member[]>();

        filteredMembers.forEach((member) => {
            const rankOrder = roleById.get(member.roleId ?? '')?.rankOrder ?? 999;
            const current = groupedByRank.get(rankOrder) ?? [];
            current.push(member);
            groupedByRank.set(rankOrder, current);
        });

        return [...groupedByRank.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([rankOrder, membersAtLevel]) => ({
                rankOrder,
                members: [...membersAtLevel].sort((a, b) => {
                    const roleCompare = (a.roleName ?? '').localeCompare(b.roleName ?? '');
                    return roleCompare || a.name.localeCompare(b.name);
                }),
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

    useEffect(() => {
        if (!teams.length) {
            setSelectedTeamManagementId(null);
            return;
        }

        if (!selectedTeamManagementId || !teams.some((team) => team.id === selectedTeamManagementId)) {
            setSelectedTeamManagementId(teams[0]?.id ?? null);
        }
    }, [selectedTeamManagementId, teams]);

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

    const handleAddTeam = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmedName = newTeamName.trim();
        if (!trimmedName) {
            return;
        }

        const created = await addTeam(trimmedName, newTeamType);
        setNewTeamName('');
        setNewTeamType('core');
        await refreshData();
        setSelectedTeamManagementId(created.id);
    };

    const handleToggleTeamMember = async (member: Member, teamId: string, nextChecked: boolean) => {
        const currentTeamIds = member.teamIds ?? (member.teamId ? [member.teamId] : []);
        const nextTeamIds = nextChecked
            ? dedupeTeamIds([...currentTeamIds, teamId])
            : currentTeamIds.filter((currentTeamId) => currentTeamId !== teamId);

        setSavingTeamMemberId(member.id);
        try {
            await setMemberTeams(member.id, nextTeamIds);
            await refreshData();
        } finally {
            setSavingTeamMemberId(null);
        }
    };

    const handleProvisionMemberAccount = async (member: Member) => {
        if (!member.loginEmail) {
            return;
        }

        setProvisioningMemberId(member.id);
        try {
            const result = await provisionMemberPasswordAuth(member.id);
            setProvisionedAccount(result);
            await refreshData();
        } finally {
            setProvisioningMemberId(null);
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
            <header className="flex flex-col gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        멤버 관리
                    </h2>
                    <p className="text-slate-500 mt-1">전체 멤버 표를 기준으로 검색, 정렬, 승인 준비를 관리합니다.</p>
                </div>

                <div className="flex flex-col gap-3 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.72fr))]">
                        <label className="relative block">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                list="member-name-suggestions"
                                placeholder="이름으로 멤버 검색"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                            <datalist id="member-name-suggestions">
                                {memberNameSuggestions.map((name) => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </label>

                        <select
                            value={selectedRoleFilter}
                            onChange={(event) => setSelectedRoleFilter(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="all">전체 직책</option>
                            {roles.map((role) => (
                                <option key={role.id} value={role.id}>
                                    {role.name}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedTeamFilter}
                            onChange={(event) => setSelectedTeamFilter(event.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                            <option value="all">전체 팀</option>
                            {teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                    {team.name}
                                </option>
                            ))}
                        </select>

                        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
                            <ArrowUpDown size={16} className="text-slate-400" />
                            <select
                                value={sortMode}
                                onChange={(event) => setSortMode(event.target.value as MemberSortMode)}
                                className="w-full bg-transparent outline-none"
                            >
                                <option value="role-order">직책 순 정렬</option>
                                <option value="name-asc">이름 오름차순</option>
                                <option value="name-desc">이름 내림차순</option>
                                <option value="joined-desc">최근 가입 순</option>
                            </select>
                        </label>
                    </div>

                    {permissions.canManageMembers && (
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => setIsAddMemberDialogOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                            >
                                <UserPlus size={16} />
                                새 멤버
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsGuideDialogOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <CircleHelp size={16} className="text-indigo-600" />
                                관리자 온보딩 가이드
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsBulkImportDialogOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                <Upload size={16} className="text-indigo-600" />
                                CSV 대량 등록
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsQueueDialogOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                            >
                                <ShieldAlert size={16} />
                                접근 준비 큐
                                <span className="rounded-full bg-white px-2 py-0.5 text-xs text-amber-700">{approvalQueue.length}</span>
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">표시 중인 멤버</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{filteredMembers.length}</div>
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
                    <div className="mt-2 text-3xl font-bold text-slate-900">{participatingTeamCount}</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-3 text-sm text-slate-500">
                    로그인 이메일이 등록된 회원만 실제 서비스에 로그인할 수 있습니다. 표 보기는 기본 관리용, 팀 지정은 다중 소속 관리용, 조직도는 구조 파악용입니다.
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
                            { id: 'teams' as const, label: '팀 지정', icon: Users },
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
                    <div className="max-w-full">
                        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-500 sm:px-6">
                            <span>표 영역 안에서 좌우로 이동할 수 있습니다.</span>
                            {permissions.canManageMembers && (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                                    관리 열 고정
                                </span>
                            )}
                        </div>
                    <div className="max-w-full overflow-x-auto overscroll-x-contain pb-3 [scrollbar-gutter:stable]">
                        <table className={`${permissions.canManageMembers ? 'min-w-[1080px]' : 'min-w-[860px]'} min-w-full w-max text-left border-collapse`}>
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                    <th className="py-4 px-6 min-w-[92px] whitespace-nowrap">레벨</th>
                                    <th className="py-4 px-6 min-w-[108px] whitespace-nowrap">이름</th>
                                    {permissions.canManageMembers && (
                                        <th className="py-4 px-6 min-w-[240px] whitespace-nowrap">로그인 이메일</th>
                                    )}
                                    <th className="py-4 px-6 min-w-[180px] whitespace-nowrap">직책</th>
                                    <th className="py-4 px-6 min-w-[140px] whitespace-nowrap">상태</th>
                                    <th className="py-4 px-6 min-w-[120px] whitespace-nowrap">승인</th>
                                    <th className="py-4 px-6 min-w-[132px] whitespace-nowrap">가입일</th>
                                    <th className={`py-4 px-6 min-w-[112px] whitespace-nowrap text-center ${permissions.canManageMembers ? 'sticky right-0 z-20 border-l border-slate-200 bg-slate-50 shadow-[-12px_0_24px_-20px_rgba(15,23,42,0.35)]' : ''}`}>
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
                                                <span className="font-medium text-slate-900">{member.name}</span>
                                            </td>
                                            {permissions.canManageMembers && (
                                                <td className="py-4 px-6 align-middle whitespace-nowrap">
                                                    {(() => {
                                                        const accountProvision = getAccountProvisionLabel(member);

                                                        return (
                                                            <>
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
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accountProvision.className}`}>
                                                                    {accountProvision.label}
                                                                </span>
                                                                {member.authProvisionedAt && (
                                                                    <span className="text-[11px] text-slate-500">
                                                                        발급 {formatDateTime(member.authProvisionedAt)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            </>
                                                        );
                                                    })()}
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
                                                                    {role.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="text-slate-700 whitespace-nowrap">{member.roleName || '미지정'}</div>
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
                                            <td className={`py-4 px-6 align-middle whitespace-nowrap text-center ${permissions.canManageMembers ? 'sticky right-0 z-10 border-l border-slate-100 bg-white shadow-[-12px_0_24px_-20px_rgba(15,23,42,0.2)] group-hover:bg-slate-50/95' : ''}`}>
                                                {permissions.canManageMembers ? (
                                                    <div
                                                        className="flex items-center justify-center gap-1"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <button
                                                            type="button"
                                                            disabled={!member.loginEmail || provisioningMemberId === member.id}
                                                            onClick={() => {
                                                                void handleProvisionMemberAccount(member);
                                                            }}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                                                            title={member.authUserId ? '임시 비밀번호 재발급' : '계정 발급'}
                                                        >
                                                            <KeyRound size={14} />
                                                            {provisioningMemberId === member.id
                                                                ? '발급 중'
                                                                : member.authUserId
                                                                    ? '재발급'
                                                                    : '계정 발급'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                void handleDeleteMember(member.id);
                                                            }}
                                                            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                            title="멤버 숨기기"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredMembers.length === 0 && (
                                    <tr>
                                        <td colSpan={permissions.canManageMembers ? 8 : 7} className="py-12 text-center text-slate-500">
                                            검색 조건에 맞는 멤버가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    </div>
                )}

                {displayMode === 'teams' && (
                    <div className="grid gap-6 p-5 sm:p-6 2xl:grid-cols-[340px_minmax(0,1fr)]">
                        <section className="space-y-4">
                            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white">
                                <div className="text-sm font-semibold text-slate-300">팀 관리</div>
                                <div className="mt-2 text-sm leading-6 text-slate-300">
                                    팀은 여기서만 관리합니다. 한 멤버를 여러 팀에 겹쳐 배정할 수 있고, 첫 번째 소속이 대표 팀으로 다른 화면에 표시됩니다.
                                </div>
                                <form onSubmit={handleAddTeam} className="mt-5 space-y-3">
                                    <input
                                        type="text"
                                        value={newTeamName}
                                        onChange={(event) => setNewTeamName(event.target.value)}
                                        placeholder="새 팀 이름"
                                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                    />
                                    <div className="flex gap-2">
                                        <select
                                            value={newTeamType}
                                            onChange={(event) => setNewTeamType(event.target.value as TeamType)}
                                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                        >
                                            {teamTypeOptions.map((teamType) => (
                                                <option key={teamType} value={teamType} className="text-slate-900">
                                                    {teamTypeLabels[teamType]}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="submit"
                                            disabled={!newTeamName.trim()}
                                            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 disabled:opacity-50"
                                        >
                                            추가
                                        </button>
                                    </div>
                                </form>
                            </div>

                            <div className="space-y-3">
                                {teams.map((team) => {
                                    const assignedCount = members.filter((member) => (member.teamIds ?? []).includes(team.id) || member.teamId === team.id).length;
                                    const isSelected = selectedTeamForManagement?.id === team.id;

                                    return (
                                        <button
                                            key={team.id}
                                            type="button"
                                            onClick={() => setSelectedTeamManagementId(team.id)}
                                            className={`w-full rounded-[24px] border px-4 py-4 text-left transition-all ${
                                                isSelected
                                                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-semibold text-slate-900">{team.name}</div>
                                                    <div className="mt-1 text-sm text-slate-500">{teamTypeLabels[team.type]}</div>
                                                </div>
                                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                                                    {assignedCount}명
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="space-y-4">
                            {selectedTeamForManagement ? (
                                <>
                                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-indigo-600">팀 지정</div>
                                                <div className="mt-1 text-2xl font-bold text-slate-900">{selectedTeamForManagement.name}</div>
                                                <div className="mt-2 text-sm text-slate-500">
                                                    {teamTypeLabels[selectedTeamForManagement.type]} · 현재 {teamMembers.length}명 배정
                                                </div>
                                            </div>
                                            <label className="relative block lg:w-[280px]">
                                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    value={teamAssignmentQuery}
                                                    onChange={(event) => setTeamAssignmentQuery(event.target.value)}
                                                    placeholder="이름 또는 직책으로 검색"
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
                                        <div className="grid gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                                            <div className="text-sm text-slate-500">
                                                체크를 켜면 해당 멤버가 이 팀에 추가되고, 끄면 이 팀에서만 빠집니다. 다른 팀 소속은 유지됩니다.
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {teamMembers.length > 0 ? teamMembers.map((member) => (
                                                    <span
                                                        key={`${selectedTeamForManagement.id}-${member.id}`}
                                                        className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                                                    >
                                                        {member.name}
                                                    </span>
                                                )) : (
                                                    <span className="text-sm text-slate-400">아직 배정된 멤버가 없습니다.</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3 p-5 sm:p-6">
                                            {assignableMembers.map((member) => {
                                                const memberTeams = getMemberTeamLabels(member);
                                                const isChecked = memberTeams.length > 0
                                                    ? (member.teamIds ?? []).includes(selectedTeamForManagement.id) || member.teamId === selectedTeamForManagement.id
                                                    : member.teamId === selectedTeamForManagement.id;

                                                return (
                                                    <label
                                                        key={member.id}
                                                        className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    disabled={savingTeamMemberId === member.id}
                                                                    onChange={(event) => {
                                                                        void handleToggleTeamMember(member, selectedTeamForManagement.id, event.target.checked);
                                                                    }}
                                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <div>
                                                                    <div className="font-semibold text-slate-900">{member.name}</div>
                                                                    <div className="mt-1 text-sm text-slate-500">{member.roleName ?? '직책 미지정'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2 sm:justify-end">
                                                            {memberTeams.length > 0 ? memberTeams.map((teamName) => (
                                                                <span key={`${member.id}-${teamName}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                                                                    {teamName}
                                                                </span>
                                                            )) : (
                                                                <span className="rounded-full border border-dashed border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-400">
                                                                    팀 미지정
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center text-slate-500">
                                    먼저 팀을 하나 선택해 주세요.
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {displayMode === 'organization' && (
                    <div className="overflow-x-auto px-4 py-6 sm:px-6">
                        {organizationLevels.length > 0 ? (
                            <div className="mx-auto min-w-max rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10">
                                <div className="flex flex-col items-center gap-8">
                                    {organizationLevels.map((level, levelIndex) => {
                                        const nodeWidth = 164;
                                        const nodeGap = 28;
                                        const rowWidth = Math.max(
                                            level.members.length * nodeWidth + Math.max(level.members.length - 1, 0) * nodeGap,
                                            nodeWidth,
                                        );

                                        return (
                                            <div key={`organization-level-${level.rankOrder}`} className="flex flex-col items-center">
                                                {levelIndex > 0 && (
                                                    <div className="relative mb-4 flex justify-center" style={{ width: rowWidth }}>
                                                        <div className="absolute top-0 h-6 w-px bg-blue-300" />
                                                        {level.members.length > 1 && (
                                                            <>
                                                                <div className="absolute top-6 left-0 right-0 h-px bg-blue-300" />
                                                                {level.members.map((member, memberIndex) => (
                                                                    <div
                                                                        key={`${member.id}-connector`}
                                                                        className="absolute top-6 h-4 w-px bg-blue-300"
                                                                        style={{
                                                                            left: `${memberIndex * (nodeWidth + nodeGap) + nodeWidth / 2}px`,
                                                                        }}
                                                                    />
                                                                ))}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex justify-center gap-7" style={{ width: rowWidth }}>
                                                    {level.members.map((member) => (
                                                        <div key={member.id} className="flex w-[164px] flex-col items-center">
                                                            <OrganizationNode
                                                                member={member}
                                                                selected={historyMemberId === member.id}
                                                                onSelect={() => setHistoryMemberId(member.id)}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
                                검색 조건에 맞는 멤버가 없습니다.
                            </div>
                        )}
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
                                        직책 {historyMember.roleName ?? '미지정'}
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

            <AppDialog
                isOpen={isAddMemberDialogOpen}
                title="새 멤버 등록"
                description="이름과 로그인 이메일을 먼저 등록하고, 저장 뒤 표에서 직책과 팀을 바로 조정할 수 있습니다."
                size="md"
                onClose={() => setIsAddMemberDialogOpen(false)}
            >
                <form
                    onSubmit={async (event) => {
                        await handleAddMember(event);
                        setIsAddMemberDialogOpen(false);
                    }}
                    className="space-y-4"
                >
                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">이름</span>
                        <input
                            type="text"
                            placeholder="새 멤버 이름"
                            value={newMemberName}
                            onChange={(event) => setNewMemberName(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>
                    <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">로그인 이메일</span>
                        <input
                            type="email"
                            placeholder="example@school.kr"
                            value={newMemberLoginEmail}
                            onChange={(event) => setNewMemberLoginEmail(event.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                    </label>
                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={() => setIsAddMemberDialogOpen(false)}
                            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={!newMemberName.trim()}
                            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            저장
                        </button>
                    </div>
                </form>
            </AppDialog>

            <AppDialog
                isOpen={isGuideDialogOpen}
                title="관리자 온보딩 가이드"
                description="새 회원을 실제 로그인 가능한 상태로 만들 때 필요한 최소 절차입니다."
                size="lg"
                onClose={() => setIsGuideDialogOpen(false)}
            >
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                        <div className="font-semibold text-slate-900">1. 로그인 이메일 등록</div>
                        <div className="mt-2 text-sm leading-7 text-slate-600">실제로 로그인에 사용할 이메일을 입력합니다. 저장만으로는 접근이 열리지 않고, 계정 발급까지 해야 비밀번호 로그인이 가능합니다.</div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                        <div className="font-semibold text-slate-900">2. 직책 선택</div>
                        <div className="mt-2 text-sm leading-7 text-slate-600">직책 이름과 시스템 권한은 분리되어 있습니다. 회장과 개발 관리자는 서로 다른 이름이어도 같은 최고 권한을 가질 수 있습니다.</div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                        <div className="font-semibold text-slate-900">3. 계정 발급</div>
                        <div className="mt-2 text-sm leading-7 text-slate-600">관리 열의 `계정 발급` 버튼으로 임시 비밀번호를 만듭니다. 기존 계정이 있으면 새 임시 비밀번호로 재발급됩니다.</div>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                        <div className="font-semibold text-slate-900">4. 승인 및 상태 확인</div>
                        <div className="mt-2 text-sm leading-7 text-slate-600">승인 체크가 꺼져 있거나 휴면/비활성 상태면 로그인은 되더라도 실제 접근이 제한됩니다.</div>
                    </div>
                </div>
                <div className="mt-4 rounded-[24px] border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm leading-7 text-indigo-900">
                    접근 준비 큐에 잡히는 이유는 이메일 미등록, 승인 대기, 보류/비활성 상태 중 하나입니다. 표에서 바로 수정하거나 접근 준비 큐 팝업에서 일괄 처리할 수 있습니다.
                </div>
            </AppDialog>

            <AppDialog
                isOpen={isBulkImportDialogOpen}
                title="CSV 대량 등록"
                description="파일 업로드 또는 붙여넣기로 새 멤버 생성과 기존 멤버 갱신을 한 번에 처리합니다."
                size="xl"
                onClose={() => setIsBulkImportDialogOpen(false)}
            >
                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
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
            </AppDialog>

            <AppDialog
                isOpen={Boolean(provisionedAccount)}
                title="임시 비밀번호 발급 완료"
                description="아래 비밀번호를 회원에게 안전하게 전달해 주세요. 첫 로그인 뒤에는 새 비밀번호 설정이 강제됩니다."
                size="md"
                onClose={() => setProvisionedAccount(null)}
            >
                {provisionedAccount && (
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm text-slate-500">회원</div>
                            <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.memberName}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm text-slate-500">로그인 이메일</div>
                            <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.email}</div>
                        </div>
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                            <div className="text-sm text-indigo-700">임시 비밀번호</div>
                            <div className="mt-2 break-all font-mono text-lg font-bold text-indigo-950">{provisionedAccount.temporaryPassword}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-600">
                            {provisionedAccount.isExistingAccount
                                ? '기존 계정의 비밀번호를 새 임시 비밀번호로 재설정했습니다.'
                                : '새 계정을 만들고 임시 비밀번호를 발급했습니다.'}
                        </div>
                    </div>
                )}
            </AppDialog>

            <AppDialog
                isOpen={isQueueDialogOpen}
                title="접근 준비 큐"
                description="로그인 이메일, 승인 상태, 회원 상태가 아직 맞지 않은 멤버만 따로 모아 둔 목록입니다."
                size="xl"
                onClose={() => setIsQueueDialogOpen(false)}
            >
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">이메일 미등록</div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.missingEmail}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">승인 필요</div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.waitingApproval}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">보류/비활성</div>
                        <div className="mt-2 text-2xl font-bold text-slate-900">{accessPreparation.dormantOrInactive}</div>
                    </div>
                </div>

                <div className="space-y-4">
                    {approvalQueue.length === 0 ? (
                        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-6 py-10 text-center">
                            <div className="text-lg font-semibold text-emerald-800">현재 처리할 접근 준비 대상이 없습니다.</div>
                            <div className="mt-2 text-sm text-emerald-700">로그인 이메일이 등록되고 승인된 회원은 즉시 서비스에 접근할 수 있습니다.</div>
                        </div>
                    ) : (
                        approvalQueue.map((member) => {
                            const approvalTags = getApprovalTags(member);
                            const isSavingRow = savingMemberId === member.id;
                            const canApprove = Boolean(member.loginEmail);

                            return (
                                <div key={member.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-lg font-bold text-slate-900">{member.name}</div>
                                                <div className="mt-1 text-sm text-slate-500">{member.loginEmail ?? '로그인 이메일이 아직 등록되지 않았습니다.'}</div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {approvalTags.map((tag) => (
                                                    <span key={tag.label} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${tag.className}`}>
                                                        {tag.label}
                                                    </span>
                                                ))}
                                            </div>

                                            <div className="text-sm text-slate-500">
                                                직책 {member.roleName ?? '미지정'} · 팀 {getMemberTeamLabels(member).join(', ') || '미지정'} · 가입일 {formatDate(member.joinedAt)}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 lg:justify-end">
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
                        })
                    )}
                </div>
            </AppDialog>
        </div>
    );
};
