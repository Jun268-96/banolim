import React, { useEffect, useMemo, useState } from 'react';
import type { AuditLogEntry, Member, MemberStatus, TeamSummary, TeamType } from '../../types';
import {
    addMember,
    deleteMember,
    hardDeleteHiddenMember,
    provisionMemberPasswordAuth,
    updateMember,
} from '../../lib/api/admin/members';
import { adjustMemberScore, adjustMemberScoreBulk } from '../../lib/api/admin/scores';
import {
    addTeam,
    deleteTeam,
    replaceTeamMembers,
    updateTeam,
} from '../../lib/api/admin/teams';
import { useAuth } from '../auth/auth-context';
import { AddMemberDialog } from './dialogs/AddMemberDialog';
import { AddTeamDialog } from './dialogs/AddTeamDialog';
import { BulkImportDialog } from './dialogs/BulkImportDialog';
import { EditTeamDialog } from './dialogs/EditTeamDialog';
import { HiddenMemberDeleteDialog } from './dialogs/HiddenMemberDeleteDialog';
import { ProvisionedAccountDialog } from './dialogs/ProvisionedAccountDialog';
import { TeamAssignmentDialog } from './dialogs/TeamAssignmentDialog';
import { TeamDeleteDialog } from './dialogs/TeamDeleteDialog';
import { useDashboardResources } from './hooks/useDashboardResources';
import { RoleSettingsDialog } from './RoleSettingsDialog';
import { DashboardHeaderSection } from './sections/DashboardHeaderSection';
import { HiddenMembersSection } from './sections/HiddenMembersSection';
import { HistorySection } from './sections/HistorySection';
import { MembersTableSection } from './sections/MembersTableSection';
import { MemberAccountDialog } from './dialogs/MemberAccountDialog';
import { MemberScoreAdjustDialog } from './dialogs/MemberScoreAdjustDialog';
import { OrganizationSection } from './sections/OrganizationSection';
import { TeamsSection } from './sections/TeamsSection';

const memberStatusOptions: MemberStatus[] = ['active', 'dormant', 'inactive'];
const memberStatusLabels: Record<MemberStatus, string> = {
    active: '활동 중',
    dormant: '휴면',
    inactive: '비활성',
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

type MemberDisplayMode = 'table' | 'teams' | 'organization';
type MemberSortMode = 'name-asc' | 'name-desc' | 'joined-desc' | 'role-order';
type MemberStatusFilter = 'all' | MemberStatus;
type MemberAccountFilter = 'all' | 'needs-email' | 'needs-account' | 'password-reset' | 'ready';
type MemberFilterPanel = 'team' | 'role' | 'status' | 'account' | null;

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


const getMemberAccountFilterKey = (member: Member): Exclude<MemberAccountFilter, 'all'> => {
    if (!member.loginEmail) {
        return 'needs-email';
    }

    if (!member.authUserId) {
        return 'needs-account';
    }

    if (member.passwordResetRequired) {
        return 'password-reset';
    }

    return 'ready';
};

const memberAccountFilterLabels: Record<Exclude<MemberAccountFilter, 'all'>, string> = {
    'needs-email': '이메일 미등록',
    'needs-account': '계정 미발급',
    'password-reset': '첫 로그인 대기',
    ready: '계정 준비 완료',
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
    if (changes.team || changes.teams) badges.push('팀');
    if (changes.status) badges.push('상태');
    if (changes.visibility) badges.push('노출');
    if (changes.name) badges.push('이름');

    return badges;
};

export const DashboardTab: React.FC = () => {
    const { permissions } = useAuth();
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberLoginEmail, setNewMemberLoginEmail] = useState('');
    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamType, setNewTeamType] = useState<TeamType>('core');
    const [searchQuery, setSearchQuery] = useState('');
    const [displayMode, setDisplayMode] = useState<MemberDisplayMode>('table');
    const [sortMode, setSortMode] = useState<MemberSortMode>('role-order');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState('all');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<MemberStatusFilter>('all');
    const [selectedAccountFilter, setSelectedAccountFilter] = useState<MemberAccountFilter>('all');
    const [openFilterPanel, setOpenFilterPanel] = useState<MemberFilterPanel>(null);
    const [selectedTeamManagementId, setSelectedTeamManagementId] = useState<string | null>(null);
    const [teamAssignmentQuery, setTeamAssignmentQuery] = useState('');
    const [draftTeamMemberIds, setDraftTeamMemberIds] = useState<string[]>([]);
    const [historyMemberId, setHistoryMemberId] = useState<string | null>(null);
    const [bulkCsvText, setBulkCsvText] = useState('');
    const [bulkImportStatus, setBulkImportStatus] = useState<string | null>(null);
    const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
    const [hardDeletingMemberId, setHardDeletingMemberId] = useState<string | null>(null);
    const [isSavingTeamAssignment, setIsSavingTeamAssignment] = useState(false);
    const [isSavingTeamEdit, setIsSavingTeamEdit] = useState(false);
    const [isDeletingTeam, setIsDeletingTeam] = useState(false);
    const [isImportingMembers, setIsImportingMembers] = useState(false);
    const [provisioningMemberId, setProvisioningMemberId] = useState<string | null>(null);
    const [provisionedAccount, setProvisionedAccount] = useState<{
        memberName: string;
        email: string;
        isExistingAccount: boolean;
        inviteSent: boolean;
        actionLink?: string;
        linkExpiresInHours?: number;
    } | null>(null);
    const [isBulkImportDialogOpen, setIsBulkImportDialogOpen] = useState(false);
    const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
    const [isAddTeamDialogOpen, setIsAddTeamDialogOpen] = useState(false);
    const [isTeamAssignmentDialogOpen, setIsTeamAssignmentDialogOpen] = useState(false);
    const [isEditTeamDialogOpen, setIsEditTeamDialogOpen] = useState(false);
    const [isRoleSettingsDialogOpen, setIsRoleSettingsDialogOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isHiddenMembersOpen, setIsHiddenMembersOpen] = useState(false);
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingTeamName, setEditingTeamName] = useState('');
    const [editingTeamType, setEditingTeamType] = useState<TeamType>('core');
    const [teamIdPendingDelete, setTeamIdPendingDelete] = useState<string | null>(null);
    const [hiddenMemberIdPendingDelete, setHiddenMemberIdPendingDelete] = useState<string | null>(null);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => new Set());
    const [scoreAdjustTargets, setScoreAdjustTargets] = useState<Member[] | null>(null);
    const [accountDialogMemberId, setAccountDialogMemberId] = useState<string | null>(null);
    const {
        members,
        hiddenMembers,
        roles,
        teams,
        auditLogs,
        errors: resourceErrors,
        isLoading,
        refreshData,
    } = useDashboardResources(permissions.canManageMembers);

    const failedResourceLabels = useMemo(() => {
        const labelMap: Record<string, string> = {
            members: '멤버 목록',
            roles: '역할',
            teams: '팀',
            auditLogs: '감사 로그',
        };
        return Object.keys(resourceErrors)
            .map((key) => labelMap[key] ?? key)
            .filter(Boolean);
    }, [resourceErrors]);

    const hasResourceErrors = failedResourceLabels.length > 0;
    const [isRetryingResources, setIsRetryingResources] = useState(false);
    const handleRetryResources = async () => {
        setIsRetryingResources(true);
        try {
            await refreshData();
        } finally {
            setIsRetryingResources(false);
        }
    };


    const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);
    const roleByName = useMemo(() => new Map(roles.map((role) => [role.name.trim().toLowerCase(), role])), [roles]);
    const teamByName = useMemo(() => new Map(teams.map((team) => [team.name.trim().toLowerCase(), team])), [teams]);

    const matchesMemberFilters = (
        member: Member,
        {
            query,
            roleFilter,
            teamFilter,
            statusFilter,
            accountFilter,
        }: {
            query: string;
            roleFilter: string;
            teamFilter: string;
            statusFilter: MemberStatusFilter;
            accountFilter: MemberAccountFilter;
        },
    ) => {
        if (query && !member.name.toLowerCase().includes(query)) {
            return false;
        }

        if (roleFilter !== 'all' && (member.roleId ?? '') !== roleFilter) {
            return false;
        }

        if (teamFilter !== 'all' && !(member.teamIds ?? []).includes(teamFilter) && (member.teamId ?? '') !== teamFilter) {
            return false;
        }

        if (statusFilter !== 'all' && (member.status ?? 'active') !== statusFilter) {
            return false;
        }

        if (accountFilter !== 'all' && getMemberAccountFilterKey(member) !== accountFilter) {
            return false;
        }

        return true;
    };

    const searchQueryNormalized = searchQuery.trim().toLowerCase();

    const filteredMembers = useMemo(() => {
        const scoped = members.filter((member) =>
            matchesMemberFilters(member, {
                query: searchQueryNormalized,
                roleFilter: selectedRoleFilter,
                teamFilter: selectedTeamFilter,
                statusFilter: selectedStatusFilter,
                accountFilter: selectedAccountFilter,
            }),
        );

        return [...scoped].sort((a, b) => {
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
    }, [members, roleById, searchQueryNormalized, selectedRoleFilter, selectedTeamFilter, selectedStatusFilter, selectedAccountFilter, sortMode]);


    const roleFilterOptions = useMemo(
        () =>
            roles.map((role) => ({
                id: role.id,
                label: role.name,
                count: members.filter((member) =>
                    matchesMemberFilters(member, {
                        query: searchQueryNormalized,
                        roleFilter: 'all',
                        teamFilter: selectedTeamFilter,
                        statusFilter: selectedStatusFilter,
                        accountFilter: selectedAccountFilter,
                    }) && (member.roleId ?? '') === role.id,
                ).length,
            })),
        [members, roles, searchQueryNormalized, selectedAccountFilter, selectedStatusFilter, selectedTeamFilter],
    );

    const teamFilterOptions = useMemo(
        () =>
            teams.map((team) => ({
                id: team.id,
                label: team.name,
                count: members.filter((member) =>
                    matchesMemberFilters(member, {
                        query: searchQueryNormalized,
                        roleFilter: selectedRoleFilter,
                        teamFilter: 'all',
                        statusFilter: selectedStatusFilter,
                        accountFilter: selectedAccountFilter,
                    }) && ((member.teamIds ?? []).includes(team.id) || member.teamId === team.id),
                ).length,
            })),
        [members, teams, searchQueryNormalized, selectedAccountFilter, selectedRoleFilter, selectedStatusFilter],
    );

    const statusFilterOptions = useMemo(
        () =>
            memberStatusOptions.map((status) => ({
                id: status,
                label: memberStatusLabels[status],
                count: members.filter((member) =>
                    matchesMemberFilters(member, {
                        query: searchQueryNormalized,
                        roleFilter: selectedRoleFilter,
                        teamFilter: selectedTeamFilter,
                        statusFilter: 'all',
                        accountFilter: selectedAccountFilter,
                    }) && (member.status ?? 'active') === status,
                ).length,
            })),
        [members, searchQueryNormalized, selectedAccountFilter, selectedRoleFilter, selectedTeamFilter],
    );

    const accountFilterOptions = useMemo(
        () =>
            (Object.entries(memberAccountFilterLabels) as Array<[Exclude<MemberAccountFilter, 'all'>, string]>).map(([id, label]) => ({
                id,
                label,
                count: members.filter((member) =>
                    matchesMemberFilters(member, {
                        query: searchQueryNormalized,
                        roleFilter: selectedRoleFilter,
                        teamFilter: selectedTeamFilter,
                        statusFilter: selectedStatusFilter,
                        accountFilter: 'all',
                    }) && getMemberAccountFilterKey(member) === id,
                ).length,
            })),
        [members, searchQueryNormalized, selectedRoleFilter, selectedStatusFilter, selectedTeamFilter],
    );

    const allMembers = useMemo(() => [...members, ...hiddenMembers], [hiddenMembers, members]);

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

    const hiddenTeamMembers = useMemo(() => {
        if (!selectedTeamForManagement) {
            return [];
        }

        return [...hiddenMembers]
            .filter((member) => {
                const teamIds = member.teamIds ?? [];
                return teamIds.includes(selectedTeamForManagement.id) || member.teamId === selectedTeamForManagement.id;
            })
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [hiddenMembers, selectedTeamForManagement]);

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

    const actualAssignedMemberIds = useMemo(
        () => dedupeTeamIds([...teamMembers.map((member) => member.id), ...hiddenTeamMembers.map((member) => member.id)]).sort((left, right) => left.localeCompare(right)),
        [hiddenTeamMembers, teamMembers],
    );

    const persistedDraftTeamMemberIds = useMemo(
        () => dedupeTeamIds([...draftTeamMemberIds, ...hiddenTeamMembers.map((member) => member.id)]).sort((left, right) => left.localeCompare(right)),
        [draftTeamMemberIds, hiddenTeamMembers],
    );

    const hasTeamAssignmentChanges = useMemo(() => {
        if (actualAssignedMemberIds.length !== persistedDraftTeamMemberIds.length) {
            return true;
        }

        return actualAssignedMemberIds.some((memberId, index) => memberId !== persistedDraftTeamMemberIds[index]);
    }, [actualAssignedMemberIds, persistedDraftTeamMemberIds]);

    const editingTeam = useMemo(
        () => teams.find((team) => team.id === editingTeamId) ?? null,
        [editingTeamId, teams],
    );
    const teamPendingDelete = useMemo(
        () => teams.find((team) => team.id === teamIdPendingDelete) ?? null,
        [teamIdPendingDelete, teams],
    );
    const hiddenMemberPendingDelete = useMemo(
        () => hiddenMembers.find((member) => member.id === hiddenMemberIdPendingDelete) ?? null,
        [hiddenMemberIdPendingDelete, hiddenMembers],
    );

    const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
    const memberNameSuggestions = useMemo(
        () => [...new Set(members.map((member) => member.name))].sort((a, b) => a.localeCompare(b)),
        [members],
    );

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

    const showActionError = (error: unknown) => {
        alert(error instanceof Error ? error.message : '작업을 완료하지 못했습니다.');
    };

    const openTeamAssignmentDialog = (team: TeamSummary) => {
        setSelectedTeamManagementId(team.id);
        setTeamAssignmentQuery('');
        setDraftTeamMemberIds(
            members
                .filter((member) => (member.teamIds ?? []).includes(team.id) || member.teamId === team.id)
                .map((member) => member.id),
        );
        setIsTeamAssignmentDialogOpen(true);
    };

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

    const handleRestoreMember = async (memberId: string) => {
        setSavingMemberId(memberId);
        try {
            await updateMember(memberId, {
                status: 'active',
                isVisible: true,
            });
            await refreshData();
        } finally {
            setSavingMemberId(null);
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

    const handleOpenTeamEdit = (team: TeamSummary) => {
        setEditingTeamId(team.id);
        setEditingTeamName(team.name);
        setEditingTeamType(team.type);
        setIsEditTeamDialogOpen(true);
    };

    const handleSaveTeamEdit = async () => {
        if (!editingTeamId || !editingTeamName.trim()) {
            return;
        }

        setIsSavingTeamEdit(true);
        try {
            await updateTeam(editingTeamId, {
                name: editingTeamName.trim(),
                type: editingTeamType,
            });
            await refreshData();
            setIsEditTeamDialogOpen(false);
        } catch (error) {
            showActionError(error);
        } finally {
            setIsSavingTeamEdit(false);
        }
    };

    const handleSaveTeamAssignment = async () => {
        if (!selectedTeamForManagement) {
            return;
        }

        setIsSavingTeamAssignment(true);
        try {
            await replaceTeamMembers(selectedTeamForManagement.id, persistedDraftTeamMemberIds);
            await refreshData();
            setIsTeamAssignmentDialogOpen(false);
        } catch (error) {
            showActionError(error);
        } finally {
            setIsSavingTeamAssignment(false);
        }
    };

    const handleResetTeamAssignmentDraft = () => {
        if (!selectedTeamForManagement) {
            return;
        }

        setDraftTeamMemberIds(
            members
                .filter((member) => (member.teamIds ?? []).includes(selectedTeamForManagement.id) || member.teamId === selectedTeamForManagement.id)
                .map((member) => member.id),
        );
    };

    const handleDeleteTeamConfirm = async () => {
        if (!teamPendingDelete) {
            return;
        }

        setIsDeletingTeam(true);
        try {
            await deleteTeam(teamPendingDelete.id);
            await refreshData();
            setIsTeamAssignmentDialogOpen(false);
            setIsEditTeamDialogOpen(false);
            setEditingTeamId(null);
            setTeamIdPendingDelete(null);
        } catch (error) {
            showActionError(error);
        } finally {
            setIsDeletingTeam(false);
        }
    };

    const handleHardDeleteMemberConfirm = async () => {
        if (!hiddenMemberPendingDelete) {
            return;
        }

        setHardDeletingMemberId(hiddenMemberPendingDelete.id);
        try {
            await hardDeleteHiddenMember(hiddenMemberPendingDelete.id);
            await refreshData();
            setHiddenMemberIdPendingDelete(null);
        } catch (error) {
            showActionError(error);
        } finally {
            setHardDeletingMemberId(null);
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
            void refreshData();
        } catch (error) {
            showActionError(error);
        } finally {
            setProvisioningMemberId(null);
        }
    };

    const handleToggleMemberSelection = (memberId: string) => {
        setSelectedMemberIds((prev) => {
            const next = new Set(prev);
            if (next.has(memberId)) {
                next.delete(memberId);
            } else {
                next.add(memberId);
            }
            return next;
        });
    };

    const handleToggleAllVisibleSelection = (memberIds: string[], nextSelected: boolean) => {
        setSelectedMemberIds((prev) => {
            const next = new Set(prev);
            if (nextSelected) {
                memberIds.forEach((id) => next.add(id));
            } else {
                memberIds.forEach((id) => next.delete(id));
            }
            return next;
        });
    };

    const handleClearMemberSelection = () => {
        setSelectedMemberIds(new Set());
    };

    const handleAdjustSingleMemberScore = (member: Member) => {
        setScoreAdjustTargets([member]);
    };

    const handleAdjustSelectedMembersScore = () => {
        if (selectedMemberIds.size === 0) return;
        const targets = members.filter((member) => selectedMemberIds.has(member.id));
        if (targets.length === 0) return;
        setScoreAdjustTargets(targets);
    };

    const handleScoreAdjustSubmit = async (delta: number, reason: string) => {
        const targets = scoreAdjustTargets;
        if (!targets || targets.length === 0) {
            throw new Error('대상 멤버가 없습니다.');
        }
        if (targets.length === 1) {
            await adjustMemberScore(targets[0].id, delta, reason);
        } else {
            await adjustMemberScoreBulk(targets.map((member) => member.id), delta, reason);
        }
        setSelectedMemberIds(new Set());
        await refreshData();
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
            <DashboardHeaderSection
                displayMode={displayMode}
                canManageMembers={permissions.canManageMembers}
                onChangeDisplayMode={setDisplayMode}
                onOpenRoleSettings={() => setIsRoleSettingsDialogOpen(true)}
                onOpenAddMember={() => setIsAddMemberDialogOpen(true)}
                onOpenBulkImport={() => setIsBulkImportDialogOpen(true)}
            />

            {hasResourceErrors && (
                <div
                    role="alert"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                    <span>
                        일부 데이터를 불러오지 못했습니다: {failedResourceLabels.join(', ')}. 나머지 정보는 기존 값을 그대로 보여드립니다.
                    </span>
                    <button
                        type="button"
                        onClick={() => void handleRetryResources()}
                        disabled={isRetryingResources}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isRetryingResources ? '다시 불러오는 중...' : '다시 시도'}
                    </button>
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 px-6 py-3 text-sm text-slate-500">
                    로그인 이메일과 계정 발급이 완료된 회원만 실제 서비스에 로그인할 수 있습니다. 표 보기는 기본 관리용, 팀 지정은 다중 소속 관리용, 조직도는 구조 파악용입니다.
                </div>
                {displayMode === 'table' && (
                    <MembersTableSection
                        canManageMembers={permissions.canManageMembers}
                        members={members}
                        filteredMembers={filteredMembers}
                        roles={roles}
                        teams={teams}
                        memberNameSuggestions={memberNameSuggestions}
                        searchQuery={searchQuery}
                        searchQueryNormalized={searchQueryNormalized}
                        sortMode={sortMode}
                        selectedRoleFilter={selectedRoleFilter}
                        selectedTeamFilter={selectedTeamFilter}
                        selectedStatusFilter={selectedStatusFilter}
                        selectedAccountFilter={selectedAccountFilter}
                        openFilterPanel={openFilterPanel}
                        historyMemberId={historyMemberId}
                        savingMemberId={savingMemberId}
                        roleFilterOptions={roleFilterOptions}
                        teamFilterOptions={teamFilterOptions}
                        statusFilterOptions={statusFilterOptions}
                        accountFilterOptions={accountFilterOptions}
                        memberStatusOptions={memberStatusOptions}
                        memberStatusLabels={memberStatusLabels}
                        memberAccountFilterLabels={memberAccountFilterLabels}
                        matchesMemberFilters={matchesMemberFilters}
                        onChangeSearchQuery={setSearchQuery}
                        onChangeSortMode={setSortMode}
                        onChangeRoleFilter={setSelectedRoleFilter}
                        onChangeTeamFilter={setSelectedTeamFilter}
                        onChangeStatusFilter={setSelectedStatusFilter}
                        onChangeAccountFilter={setSelectedAccountFilter}
                        onChangeOpenFilterPanel={setOpenFilterPanel}
                        onResetFilters={() => {
                            setSearchQuery('');
                            setSortMode('role-order');
                            setSelectedRoleFilter('all');
                            setSelectedTeamFilter('all');
                            setSelectedStatusFilter('all');
                            setSelectedAccountFilter('all');
                            setOpenFilterPanel(null);
                        }}
                        onSelectHistoryMember={setHistoryMemberId}
                        onUpdateMember={(memberId, updates) => {
                            void handleMemberUpdate(memberId, updates);
                        }}
                        onOpenMemberAccount={(member) => {
                            setAccountDialogMemberId(member.id);
                        }}
                        selectedMemberIds={selectedMemberIds}
                        onToggleMemberSelection={handleToggleMemberSelection}
                        onToggleAllVisibleSelection={handleToggleAllVisibleSelection}
                        onAdjustSingleMemberScore={handleAdjustSingleMemberScore}
                        onAdjustSelectedMembersScore={handleAdjustSelectedMembersScore}
                        onClearMemberSelection={handleClearMemberSelection}
                    />
                )}

                {displayMode === 'teams' && (
                    <TeamsSection
                        teams={teams}
                        members={members}
                        hiddenMembers={hiddenMembers}
                        teamTypeLabels={teamTypeLabels}
                        onAddTeam={() => setIsAddTeamDialogOpen(true)}
                        onOpenTeamAssignment={openTeamAssignmentDialog}
                        onEditTeam={handleOpenTeamEdit}
                        onDeleteTeam={setTeamIdPendingDelete}
                    />
                )}

                {displayMode === 'organization' && (
                    <OrganizationSection
                        members={filteredMembers}
                        selectedMemberId={historyMemberId}
                        onSelectMember={setHistoryMemberId}
                    />
                )}
            </div>

            {permissions.canManageMembers && (
                <HistorySection
                    isOpen={isHistoryOpen}
                    historyMember={historyMember}
                    historyMemberId={historyMemberId}
                    members={members}
                    memberHistoryEntries={memberHistoryEntries}
                    memberStatusLabels={memberStatusLabels}
                    onToggle={() => setIsHistoryOpen((prev) => !prev)}
                    onChangeHistoryMemberId={setHistoryMemberId}
                    getChangeBadges={getHistoryChangeBadges}
                    formatDateTime={formatDateTime}
                />
            )}

            {permissions.canManageMembers && (
                <HiddenMembersSection
                    isOpen={isHiddenMembersOpen}
                    hiddenMembers={hiddenMembers}
                    savingMemberId={savingMemberId}
                    hardDeletingMemberId={hardDeletingMemberId}
                    memberStatusLabels={memberStatusLabels}
                    onToggle={() => setIsHiddenMembersOpen((prev) => !prev)}
                    onRestoreMember={(memberId) => {
                        void handleRestoreMember(memberId);
                    }}
                    onRequestDeleteMember={setHiddenMemberIdPendingDelete}
                    getMemberTeamLabels={getMemberTeamLabels}
                    formatDate={formatDate}
                />
            )}

            <AddMemberDialog
                isOpen={isAddMemberDialogOpen}
                memberName={newMemberName}
                memberLoginEmail={newMemberLoginEmail}
                onClose={() => setIsAddMemberDialogOpen(false)}
                onSubmit={async (event) => {
                    await handleAddMember(event);
                    setIsAddMemberDialogOpen(false);
                }}
                onChangeMemberName={setNewMemberName}
                onChangeMemberLoginEmail={setNewMemberLoginEmail}
            />

            <BulkImportDialog
                isOpen={isBulkImportDialogOpen}
                csvText={bulkCsvText}
                importStatus={bulkImportStatus}
                importErrors={parsedBulkImport.errors}
                previewRows={parsedBulkImport.rows}
                emailIncludedCount={parsedBulkImport.rows.filter((row) => row.loginEmail).length}
                isImporting={isImportingMembers}
                onClose={() => setIsBulkImportDialogOpen(false)}
                onChangeCsvText={setBulkCsvText}
                onLoadSample={() => setBulkCsvText(sampleMemberCsv)}
                onReset={() => {
                    setBulkCsvText('');
                    setBulkImportStatus(null);
                }}
                onFileChange={(event) => void handleMemberCsvFile(event)}
                onExecuteImport={() => void handleBulkImportMembers()}
            />

            <ProvisionedAccountDialog
                provisionedAccount={provisionedAccount}
                onClose={() => setProvisionedAccount(null)}
            />

            <MemberScoreAdjustDialog
                isOpen={scoreAdjustTargets !== null && scoreAdjustTargets.length > 0}
                targets={scoreAdjustTargets ?? []}
                onClose={() => setScoreAdjustTargets(null)}
                onSubmit={handleScoreAdjustSubmit}
            />

            <MemberAccountDialog
                isOpen={accountDialogMemberId !== null}
                member={members.find((candidate) => candidate.id === accountDialogMemberId) ?? null}
                isSaving={savingMemberId === accountDialogMemberId}
                isProvisioning={provisioningMemberId === accountDialogMemberId}
                onClose={() => setAccountDialogMemberId(null)}
                normalizeLoginEmail={normalizeLoginEmail}
                formatDate={formatDate}
                formatDateTime={formatDateTime}
                onUpdateLoginEmail={(memberId, loginEmail) => {
                    void handleMemberUpdate(memberId, { loginEmail });
                }}
                onProvisionAccount={(member) => {
                    void handleProvisionMemberAccount(member);
                }}
                onDelete={(memberId) => {
                    void handleDeleteMember(memberId);
                }}
            />

            <RoleSettingsDialog
                isOpen={isRoleSettingsDialogOpen}
                onClose={() => setIsRoleSettingsDialogOpen(false)}
                onUpdated={refreshData}
            />

            <AddTeamDialog
                isOpen={isAddTeamDialogOpen}
                teamName={newTeamName}
                teamType={newTeamType}
                teamTypeOptions={teamTypeOptions}
                teamTypeLabels={teamTypeLabels}
                onClose={() => setIsAddTeamDialogOpen(false)}
                onSubmit={async (event) => {
                    try {
                        await handleAddTeam(event);
                        setDraftTeamMemberIds([]);
                        setTeamAssignmentQuery('');
                        setIsAddTeamDialogOpen(false);
                        setIsTeamAssignmentDialogOpen(true);
                    } catch (error) {
                        showActionError(error);
                    }
                }}
                onChangeTeamName={setNewTeamName}
                onChangeTeamType={setNewTeamType}
            />

            <EditTeamDialog
                isOpen={isEditTeamDialogOpen}
                editingTeam={editingTeam}
                editingTeamName={editingTeamName}
                editingTeamType={editingTeamType}
                isSaving={isSavingTeamEdit}
                allMembers={allMembers}
                teamTypeOptions={teamTypeOptions}
                teamTypeLabels={teamTypeLabels}
                onClose={() => {
                    setIsEditTeamDialogOpen(false);
                    setEditingTeamId(null);
                }}
                onSave={() => {
                    void handleSaveTeamEdit();
                }}
                onChangeTeamName={setEditingTeamName}
                onChangeTeamType={setEditingTeamType}
            />

            <TeamAssignmentDialog
                isOpen={isTeamAssignmentDialogOpen}
                selectedTeam={selectedTeamForManagement}
                teamTypeLabels={teamTypeLabels}
                actualAssignedCount={actualAssignedMemberIds.length}
                teamAssignmentQuery={teamAssignmentQuery}
                draftTeamMemberIds={draftTeamMemberIds}
                hiddenTeamMembers={hiddenTeamMembers}
                teamMembers={teamMembers}
                assignableMembers={assignableMembers}
                hasTeamAssignmentChanges={hasTeamAssignmentChanges}
                isSavingTeamAssignment={isSavingTeamAssignment}
                onClose={() => setIsTeamAssignmentDialogOpen(false)}
                onChangeQuery={setTeamAssignmentQuery}
                onToggleMember={(memberId) => {
                    setDraftTeamMemberIds((current) =>
                        current.includes(memberId)
                            ? current.filter((currentMemberId) => currentMemberId !== memberId)
                            : [...current, memberId],
                    );
                }}
                onResetDraft={handleResetTeamAssignmentDraft}
                onSave={() => {
                    void handleSaveTeamAssignment();
                }}
                getMemberTeamLabels={getMemberTeamLabels}
            />

            <TeamDeleteDialog
                teamPendingDelete={teamPendingDelete}
                members={members}
                hiddenMembers={hiddenMembers}
                isDeletingTeam={isDeletingTeam}
                onClose={() => setTeamIdPendingDelete(null)}
                onDelete={() => {
                    void handleDeleteTeamConfirm();
                }}
            />

            <HiddenMemberDeleteDialog
                hiddenMemberPendingDelete={hiddenMemberPendingDelete}
                hardDeletingMemberId={hardDeletingMemberId}
                onClose={() => setHiddenMemberIdPendingDelete(null)}
                onDelete={() => {
                    void handleHardDeleteMemberConfirm();
                }}
            />

        </div>
    );
};
