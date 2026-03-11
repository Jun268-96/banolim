import type { ActivityLog, AuditLogEntry, Badge, BadgeTone, Category, CorrectionRequest, CorrectionRequestStatus, Member, MemberBadge, RoleSummary, SeasonSummary, TeamSummary, TeamType, SeasonStatus } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Database, Json } from '../types/database';

type MemberRow = Database['public']['Tables']['members']['Row'];
type RoleRow = Database['public']['Tables']['roles']['Row'];
type TeamRow = Database['public']['Tables']['teams']['Row'];
type SeasonRow = Database['public']['Tables']['seasons']['Row'];
type ActivityRecordRow = Database['public']['Tables']['activity_records']['Row'];
type PointLedgerRow = Database['public']['Tables']['point_ledgers']['Row'];
type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
type CorrectionRequestRow = Database['public']['Tables']['correction_requests']['Row'];
type MemberScoreSummaryRow = Database['public']['Views']['member_score_summary']['Row'];
type PointRuleCatalogRow = Database['public']['Views']['point_rule_catalog']['Row'];
type MyMemberOverviewRow = Database['public']['Functions']['get_my_member_overview']['Returns'][number];
type MyActivityLogRow = Database['public']['Functions']['get_my_activity_logs']['Returns'][number];
type MyMemberBadgeRow = Database['public']['Functions']['get_my_member_badges']['Returns'][number];

const createLocalId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const normalizeLoginEmail = (value?: string | null) => {
    const normalized = value?.trim().toLowerCase() ?? '';
    return normalized.length > 0 ? normalized : null;
};

let localMembers: Member[] = [
    {
        id: 'm1',
        name: '이동섭',
        score: 180,
        loginEmail: 'leader@banollim.app',
        isApproved: true,
        roleId: 'r1',
        roleName: '회장',
        teamId: 't1',
        teamName: '임원진',
        status: 'active',
        joinedAt: '2026-03-01',
        isVisible: true,
    },
    {
        id: 'm2',
        name: '김주영',
        score: 135,
        loginEmail: 'vice@banollim.app',
        isApproved: true,
        roleId: 'r2',
        roleName: '부회장',
        teamId: 't1',
        teamName: '임원진',
        status: 'active',
        joinedAt: '2026-03-01',
        isVisible: true,
    },
    {
        id: 'm3',
        name: '김세현',
        score: 95,
        loginEmail: 'plan@banollim.app',
        isApproved: true,
        roleId: 'r3',
        roleName: '기획팀장',
        teamId: 't2',
        teamName: '기획팀',
        status: 'active',
        joinedAt: '2026-03-02',
        isVisible: true,
    },
    {
        id: 'm4',
        name: '이민희',
        score: 40,
        loginEmail: null,
        isApproved: false,
        roleId: null,
        roleName: '홍보팀장',
        teamId: 't3',
        teamName: '홍보팀',
        status: 'dormant',
        joinedAt: '2026-03-03',
        isVisible: true,
    },
];

let localCategories: Category[] = [
    {
        id: 'p1',
        activityTypeId: 'at_attendance_present',
        categoryName: '정기모임 출석',
        groupName: 'attendance',
        pointValue: 10,
        penaltyPoint: 0,
        conditionSummary: '정시 참석 시 기본 점수 지급',
        conditionJson: { summary: '정시 참석 시 기본 점수 지급' },
        version: 1,
        isActive: true,
    },
    {
        id: 'p2',
        activityTypeId: 'at_study',
        categoryName: '스터디 참여',
        groupName: 'study',
        pointValue: 15,
        penaltyPoint: 0,
        conditionSummary: '스터디 출석 또는 실습 참여 완료',
        conditionJson: { summary: '스터디 출석 또는 실습 참여 완료' },
        version: 1,
        isActive: true,
    },
    {
        id: 'p3',
        activityTypeId: 'at_presentation',
        categoryName: '발표',
        groupName: 'contribution',
        pointValue: 30,
        penaltyPoint: 0,
        conditionSummary: '정기 발표 또는 세션 리딩',
        conditionJson: { summary: '정기 발표 또는 세션 리딩' },
        version: 2,
        isActive: true,
    },
    {
        id: 'p4',
        activityTypeId: 'at_attendance_late',
        categoryName: '지각',
        groupName: 'attendance',
        pointValue: -5,
        penaltyPoint: 5,
        conditionSummary: '정기모임 시작 이후 입장',
        conditionJson: { summary: '정기모임 시작 이후 입장' },
        version: 1,
        isActive: true,
    },
    {
        id: 'p5',
        activityTypeId: 'at_attendance_absent',
        categoryName: '불참',
        groupName: 'attendance',
        pointValue: 0,
        penaltyPoint: 0,
        conditionSummary: '사전 공유된 불참 처리 규칙 적용',
        conditionJson: { summary: '사전 공유된 불참 처리 규칙 적용' },
        version: 1,
        isActive: true,
    },
];

let localLogs: ActivityLog[] = [
    {
        id: 'l1',
        recordId: 'record_l1',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        memberId: 'm1',
        categoryId: 'p1',
        pointDelta: 10,
        reason: '정기모임 출석',
        note: '주간 정기모임',
        evidenceUrl: 'https://example.com/attendance-sheet',
        recordStatus: 'confirmed',
    },
    {
        id: 'l2',
        recordId: 'record_l2',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        memberId: 'm2',
        categoryId: 'p3',
        pointDelta: 30,
        reason: '발표',
        note: 'AI 스터디 세션',
        evidenceUrl: 'https://example.com/slides/ai-study',
        recordStatus: 'confirmed',
    },
];

const localAuditLogs: AuditLogEntry[] = [
    {
        id: 'audit_1',
        actorId: null,
        actorName: '로컬 운영자',
        entityType: 'activity_record',
        entityId: 'record_l1',
        action: 'created',
        summary: '이동섭 · 정기모임 출석 기록 생성',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        diff: {
            memberId: 'm1',
            memberName: '이동섭',
            pointRuleId: 'p1',
            ruleName: '정기모임 출석',
            delta: 10,
            reason: '정기모임 출석',
        },
    },
    {
        id: 'audit_2',
        actorId: null,
        actorName: '로컬 운영자',
        entityType: 'activity_record',
        entityId: 'record_l2',
        action: 'created',
        summary: '김주영 · 발표 기록 생성',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        diff: {
            memberId: 'm2',
            memberName: '김주영',
            pointRuleId: 'p3',
            ruleName: '발표',
            delta: 30,
            reason: '발표',
        },
    },
];

const localCorrectionRequests: CorrectionRequest[] = [
    {
        id: 'correction_1',
        requesterMemberId: 'm1',
        requesterName: '이동섭',
        activityRecordId: 'record_l1',
        status: 'pending',
        reason: '주간 정기모임이 아니라 월간 전체모임 출석으로 기록되어 메모 수정이 필요합니다.',
        reviewNote: null,
        reviewedBy: null,
        reviewedByName: null,
        reviewedAt: null,
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        activitySummary: '정기모임 출석',
        activityOccurredAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        activityPointDelta: 10,
    },
];

const localBadges: Badge[] = [
    {
        id: 'badge_first_step',
        code: 'first_step',
        name: '첫 발자국',
        description: '첫 활동 기록을 남겼습니다.',
        iconKey: 'bandi-core',
        tone: 'gold',
        sortOrder: 10,
        isActive: true,
    },
    {
        id: 'badge_steady_rhythm',
        code: 'steady_rhythm',
        name: '꾸준한 리듬',
        description: '서로 다른 날짜에 3회 이상 활동을 이어갔습니다.',
        iconKey: 'bandi-orbit',
        tone: 'emerald',
        sortOrder: 20,
        isActive: true,
    },
    {
        id: 'badge_attendance_radar',
        code: 'attendance_radar',
        name: '출석 레이더',
        description: '출석 계열 활동을 5회 이상 기록했습니다.',
        iconKey: 'school-signal',
        tone: 'sky',
        sortOrder: 30,
        isActive: true,
    },
    {
        id: 'badge_spotlight',
        code: 'spotlight',
        name: '스포트라이트',
        description: '발표 또는 고점수 기여를 남겼습니다.',
        iconKey: 'bandi-flash',
        tone: 'rose',
        sortOrder: 40,
        isActive: true,
    },
    {
        id: 'badge_multi_tool',
        code: 'multi_tool',
        name: '멀티 플레이어',
        description: '서로 다른 활동 유형 4개 이상을 경험했습니다.',
        iconKey: 'didi-toolkit',
        tone: 'sky',
        sortOrder: 50,
        isActive: true,
    },
    {
        id: 'badge_archive_keeper',
        code: 'archive_keeper',
        name: '기록 보관자',
        description: '증빙 링크가 포함된 활동을 2건 이상 남겼습니다.',
        iconKey: 'didi-archive',
        tone: 'emerald',
        sortOrder: 60,
        isActive: true,
    },
];

const localMemberBadges: MemberBadge[] = [];

const localRoles: RoleSummary[] = [
    { id: 'r1', name: '회장', permissionScope: 'super_admin', rankOrder: 10 },
    { id: 'r2', name: '부회장', permissionScope: 'operator', rankOrder: 20 },
    { id: 'r3', name: '기획팀장', permissionScope: 'operator', rankOrder: 30 },
    { id: 'r4', name: '일반회원', permissionScope: 'member', rankOrder: 100 },
];

const localTeams: TeamSummary[] = [
    { id: 't1', name: '임원진', type: 'core', isActive: true },
    { id: 't2', name: '기획팀', type: 'core', isActive: true },
    { id: 't3', name: '홍보팀', type: 'core', isActive: true },
    { id: 't4', name: '운영팀', type: 'core', isActive: true },
    { id: 't5', name: '스터디', type: 'study', isActive: true },
];

const localCurrentSeason: SeasonSummary = {
    id: 'season_2026_spring',
    name: '2026 상반기',
    status: 'active',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
};

const localSeasons: SeasonSummary[] = [
    localCurrentSeason,
    {
        id: 'season_2025_fall',
        name: '2025 하반기',
        status: 'closed',
        startDate: '2025-09-01',
        endDate: '2026-02-28',
    },
];

const sortMembers = (members: Member[]) => [...members].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

const enrichLocalLogs = () => {
    const memberMap = new Map(localMembers.map((member) => [member.id, member]));
    const categoryMap = new Map(localCategories.map((category) => [category.id, category]));

    return [...localLogs]
        .map((log) => ({
            ...log,
            memberName: memberMap.get(log.memberId)?.name ?? '알 수 없는 멤버',
            categoryName: categoryMap.get(log.categoryId)?.categoryName ?? '알 수 없는 규칙',
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

const getLocalSelfMember = (memberId?: string | null) => {
    const sortedMembers = sortMembers(localMembers);

    if (!memberId) {
        return sortedMembers[0] ?? null;
    }

    return sortedMembers.find((member) => member.id === memberId) ?? null;
};

const getLocalSelfLogs = (memberId?: string | null) => {
    const targetId = memberId ?? getLocalSelfMember()?.id;
    if (!targetId) {
        return [] as ActivityLog[];
    }

    return enrichLocalLogs().filter((log) => log.memberId === targetId);
};

const sortAuditLogs = (auditLogs: AuditLogEntry[]) =>
    [...auditLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const sortCorrectionRequests = (requests: CorrectionRequest[]) =>
    [...requests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const logLocalAuditEntry = (entry: Omit<AuditLogEntry, 'id' | 'createdAt'> & { createdAt?: string }) => {
    localAuditLogs.push({
        id: createLocalId('audit'),
        createdAt: entry.createdAt ?? new Date().toISOString(),
        ...entry,
    });
};

const getLocalCorrectionRequests = (requesterMemberId?: string | null) =>
    sortCorrectionRequests(
        localCorrectionRequests
            .filter((request) => !requesterMemberId || request.requesterMemberId === requesterMemberId)
            .map((request) => ({ ...request })),
    );

const badgeToneByCode: Record<string, BadgeTone> = {
    first_step: 'gold',
    steady_rhythm: 'emerald',
    attendance_radar: 'sky',
    spotlight: 'rose',
    multi_tool: 'sky',
    archive_keeper: 'emerald',
};

const getEffectiveLocalLogsForMember = (memberId: string) =>
    enrichLocalLogs().filter((log) => log.memberId === memberId && !log.isReversal && log.recordStatus !== 'reversed');

const getEligibleLocalBadgeCodes = (memberId: string) => {
    const logs = getEffectiveLocalLogsForMember(memberId);
    const attendanceCount = logs.filter((log) => /(출석|참석|지각|불참)/.test(log.categoryName ?? log.reason ?? '')).length;
    const distinctActiveDays = new Set(logs.map((log) => log.timestamp.slice(0, 10))).size;
    const spotlightCount = logs.filter((log) => log.pointDelta >= 20 || /(발표|세션|리딩)/.test(log.categoryName ?? log.reason ?? '')).length;
    const uniqueCategoryCount = new Set(logs.map((log) => log.categoryName ?? log.categoryId)).size;
    const evidenceCount = logs.filter((log) => Boolean(log.evidenceUrl)).length;

    return new Set([
        ...(logs.length > 0 ? ['first_step'] : []),
        ...(distinctActiveDays >= 3 ? ['steady_rhythm'] : []),
        ...(attendanceCount >= 5 ? ['attendance_radar'] : []),
        ...(spotlightCount >= 1 ? ['spotlight'] : []),
        ...(uniqueCategoryCount >= 4 ? ['multi_tool'] : []),
        ...(evidenceCount >= 2 ? ['archive_keeper'] : []),
    ]);
};

const syncLocalMemberBadges = (memberId?: string | null) => {
    const targetIds = memberId ? [memberId] : localMembers.map((member) => member.id);
    const activeSeasonId = localCurrentSeason.id;

    targetIds.forEach((targetId) => {
        const eligibleCodes = getEligibleLocalBadgeCodes(targetId);

        for (const badge of localBadges) {
            if (!eligibleCodes.has(badge.code)) {
                continue;
            }

            const alreadyAwarded = localMemberBadges.some((entry) => entry.memberId === targetId && entry.badgeCode === badge.code);
            if (alreadyAwarded) {
                continue;
            }

            localMemberBadges.push({
                id: createLocalId('member_badge'),
                memberId: targetId,
                badgeId: badge.id,
                badgeCode: badge.code,
                badgeName: badge.name,
                badgeDescription: badge.description,
                iconKey: badge.iconKey,
                tone: badge.tone ?? badgeToneByCode[badge.code] ?? 'sky',
                awardedAt: new Date().toISOString(),
                seasonId: activeSeasonId,
            });
        }
    });
};

const getLocalMemberBadges = (memberId?: string | null) => {
    const targetId = memberId ?? getLocalSelfMember()?.id;
    if (!targetId) {
        return [] as MemberBadge[];
    }

    syncLocalMemberBadges(targetId);

    return [...localMemberBadges]
        .filter((entry) => entry.memberId === targetId)
        .sort((a, b) => {
            const badgeA = localBadges.find((badge) => badge.id === a.badgeId);
            const badgeB = localBadges.find((badge) => badge.id === b.badgeId);
            return (badgeA?.sortOrder ?? 999) - (badgeB?.sortOrder ?? 999) || b.awardedAt.localeCompare(a.awardedAt);
        });
};

const parseJsonObject = (value: Json): Record<string, unknown> | null => {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return null;
    }

    return value as Record<string, unknown>;
};

const fallback = <T>(task: string, getLocalValue: () => T, error?: unknown): T => {
    if (error) {
        console.warn(`[data] ${task} failed, using local fallback instead.`, error);
    }

    return getLocalValue();
};

const getSupabaseClient = () => {
    if (!supabase) {
        throw new Error('Supabase 클라이언트가 설정되지 않았습니다.');
    }

    return supabase;
};

const createActivityCode = () => `manual-${Date.now()}`;

const getConditionSummary = (value: Json | Record<string, unknown> | null | undefined) => {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return null;
    }

    const summary = (value as Record<string, unknown>).summary;
    return typeof summary === 'string' && summary.trim().length > 0 ? summary.trim() : null;
};

interface CategoryInput {
    categoryName: string;
    pointValue: number;
    penaltyPoint?: number;
    conditionSummary?: string;
    groupName?: string;
}

interface ActivityEntryOptions {
    occurredAt?: string;
    reason?: string;
    evidenceUrl?: string;
}

export const getMembers = async (options?: { includeLoginEmail?: boolean }): Promise<Member[]> => {
    const includeLoginEmail = options?.includeLoginEmail ?? false;

    if (!isSupabaseConfigured) {
        return sortMembers(
            localMembers.map((member) => ({
                ...member,
                loginEmail: includeLoginEmail ? member.loginEmail ?? null : null,
            })),
        );
    }

    try {
        const client = getSupabaseClient();
        const memberQuery = includeLoginEmail
            ? client
                .from('members')
                .select('id, name, login_email, role_id, team_id, status, joined_at, is_approved, is_visible')
                .eq('is_visible', true)
            : client
                .from('members')
                .select('id, name, role_id, team_id, status, joined_at, is_approved, is_visible')
                .eq('is_visible', true);
        const [summaryResult, memberResult, roleResult, teamResult] = await Promise.all([
            client.from('member_score_summary').select('id, name, is_approved, score'),
            memberQuery,
            client.from('roles').select('id, name'),
            client.from('teams').select('id, name'),
        ]);

        if (summaryResult.error) throw summaryResult.error;
        if (memberResult.error) throw memberResult.error;
        if (roleResult.error) throw roleResult.error;
        if (teamResult.error) throw teamResult.error;

        const summaryRows = (summaryResult.data ?? []) as MemberScoreSummaryRow[];
        const memberRows = (memberResult.data ?? []) as Array<
            Pick<MemberRow, 'id' | 'name' | 'role_id' | 'team_id' | 'status' | 'joined_at' | 'is_approved' | 'is_visible'> & {
                login_email?: string | null;
            }
        >;
        const roleRows = (roleResult.data ?? []) as RoleRow[];
        const teamRows = (teamResult.data ?? []) as TeamRow[];

        const summaryMap = new Map<string, MemberScoreSummaryRow>(summaryRows.map((summary) => [summary.id, summary]));
        const roleMap = new Map<string, string>(roleRows.map((role) => [role.id, role.name]));
        const teamMap = new Map<string, string>(teamRows.map((team) => [team.id, team.name]));

        return sortMembers(
            memberRows.map((member) => {
                const summary = summaryMap.get(member.id);

                return {
                    id: member.id,
                    name: member.name,
                    score: summary?.score ?? 0,
                    loginEmail: includeLoginEmail ? member.login_email ?? null : null,
                    isApproved: member.is_approved,
                    roleId: member.role_id,
                    roleName: member.role_id ? roleMap.get(member.role_id) ?? null : null,
                    teamId: member.team_id,
                    teamName: member.team_id ? teamMap.get(member.team_id) ?? null : null,
                    status: member.status,
                    joinedAt: member.joined_at,
                    isVisible: member.is_visible,
                };
            }),
        );
    } catch (error) {
        return fallback(
            'getMembers',
            () =>
                sortMembers(
                    localMembers.map((member) => ({
                        ...member,
                        loginEmail: includeLoginEmail ? member.loginEmail ?? null : null,
                    })),
                ),
            error,
        );
    }
};

export const getCategories = async (): Promise<Category[]> => {
    if (!isSupabaseConfigured) {
        return localCategories
            .filter((category) => category.isActive !== false)
            .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('point_rule_catalog')
            .select('id, activity_type_id, category_name, group_name, point_value, penalty_point, condition_json, is_active, version')
            .eq('is_active', true)
            .order('category_name', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as PointRuleCatalogRow[]).map((category) => ({
            id: category.id,
            activityTypeId: category.activity_type_id,
            categoryName: category.category_name,
            groupName: category.group_name,
            pointValue: category.point_value,
            penaltyPoint: category.penalty_point,
            conditionSummary: getConditionSummary(category.condition_json),
            conditionJson: parseJsonObject(category.condition_json),
            isActive: category.is_active,
            version: category.version,
        }));
    } catch (error) {
        return fallback(
            'getCategories',
            () =>
                localCategories
                    .filter((category) => category.isActive !== false)
                    .sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
            error,
        );
    }
};

export const getLogs = async (): Promise<ActivityLog[]> => {
    if (!isSupabaseConfigured) {
        return enrichLocalLogs();
    }

    try {
        const client = getSupabaseClient();
        const [ledgerResult, recordResult, members, categories] = await Promise.all([
            client
                .from('point_ledgers')
                .select('id, record_id, member_id, point_rule_id, delta, reason, created_at, reversal_of')
                .order('created_at', { ascending: false }),
            client.from('activity_records').select('id, note, evidence_url, occurred_at, status'),
            getMembers(),
            getCategories(),
        ]);

        if (ledgerResult.error) throw ledgerResult.error;
        if (recordResult.error) throw recordResult.error;

        const recordRows = (recordResult.data ?? []) as Pick<ActivityRecordRow, 'id' | 'note' | 'evidence_url' | 'occurred_at' | 'status'>[];
        const ledgerRows = (ledgerResult.data ?? []) as Pick<PointLedgerRow, 'id' | 'record_id' | 'member_id' | 'point_rule_id' | 'delta' | 'reason' | 'created_at' | 'reversal_of'>[];
        const recordMap = new Map<string, Pick<ActivityRecordRow, 'id' | 'note' | 'evidence_url' | 'occurred_at' | 'status'>>(recordRows.map((record) => [record.id, record]));
        const memberMap = new Map(members.map((member) => [member.id, member.name]));
        const categoryMap = new Map(categories.map((category) => [category.id, category.categoryName]));

        return ledgerRows.map((ledger) => {
            const record = recordMap.get(ledger.record_id);

            return {
                id: ledger.id,
                recordId: ledger.record_id,
                timestamp: ledger.reversal_of ? ledger.created_at : record?.occurred_at ?? ledger.created_at,
                memberId: ledger.member_id,
                categoryId: ledger.point_rule_id,
                pointDelta: ledger.delta,
                reason: ledger.reason,
                note: record?.note ?? null,
                evidenceUrl: record?.evidence_url ?? null,
                memberName: memberMap.get(ledger.member_id) ?? '알 수 없는 멤버',
                categoryName: categoryMap.get(ledger.point_rule_id) ?? '알 수 없는 규칙',
                reversalOf: ledger.reversal_of,
                isReversal: Boolean(ledger.reversal_of),
                recordStatus: record?.status ?? 'confirmed',
            };
        });
    } catch (error) {
        return fallback('getLogs', () => enrichLocalLogs(), error);
    }
};

const mapMyMemberOverviewRow = (row: MyMemberOverviewRow): Member => ({
    id: row.id,
    name: row.name,
    score: row.score,
    isApproved: row.is_approved,
    roleId: row.role_id,
    roleName: row.role_name,
    teamId: row.team_id,
    teamName: row.team_name,
    status: row.status,
    joinedAt: row.joined_at,
    isVisible: row.is_visible,
});

const mapMyActivityLogRow = (row: MyActivityLogRow): ActivityLog => ({
    id: row.id,
    recordId: row.record_id,
    timestamp: row.timestamp,
    memberId: row.member_id,
    memberName: row.member_name,
    categoryId: row.category_id,
    categoryName: row.category_name,
    pointDelta: row.point_delta,
    reason: row.reason,
    note: row.note,
    evidenceUrl: row.evidence_url,
    reversalOf: row.reversal_of,
    isReversal: row.is_reversal,
    recordStatus: row.record_status,
});

const mapMyMemberBadgeRow = (row: MyMemberBadgeRow): MemberBadge => ({
    id: row.id,
    memberId: row.member_id,
    badgeId: row.badge_id,
    badgeCode: row.badge_code,
    badgeName: row.badge_name,
    badgeDescription: row.badge_description,
    iconKey: row.icon_key,
    tone: (row.tone as BadgeTone | null) ?? 'sky',
    awardedAt: row.awarded_at,
    seasonId: row.season_id,
});

const mapCorrectionRequestRow = (
    row: CorrectionRequestRow,
    logs: ActivityLog[],
    members: Member[],
): CorrectionRequest => {
    const relatedLog = logs.find((log) => log.recordId === row.activity_record_id && !log.isReversal) ?? null;
    const requester = members.find((member) => member.id === row.requester_member_id) ?? null;
    const reviewer = row.reviewed_by ? members.find((member) => member.id === row.reviewed_by) ?? null : null;

    return {
        id: row.id,
        requesterMemberId: row.requester_member_id,
        requesterName: requester?.name ?? relatedLog?.memberName ?? '알 수 없는 회원',
        activityRecordId: row.activity_record_id,
        status: row.status as CorrectionRequestStatus,
        reason: row.reason,
        reviewNote: row.review_note,
        reviewedBy: row.reviewed_by,
        reviewedByName: reviewer?.name ?? null,
        reviewedAt: row.reviewed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        activitySummary: relatedLog?.categoryName ?? relatedLog?.reason ?? '활동 기록',
        activityOccurredAt: relatedLog?.timestamp ?? null,
        activityPointDelta: relatedLog?.pointDelta ?? null,
    };
};

export const getMyMemberOverview = async (memberId?: string | null): Promise<Member | null> => {
    if (!isSupabaseConfigured) {
        return getLocalSelfMember(memberId);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('get_my_member_overview');

        if (error) {
            throw error;
        }

        const rows = (data ?? []) as MyMemberOverviewRow[];
        if (rows.length === 0) {
            return null;
        }

        return mapMyMemberOverviewRow(rows[0]);
    } catch (error) {
        return fallback('getMyMemberOverview', () => getLocalSelfMember(memberId), error);
    }
};

export const getMyActivityLogs = async (memberId?: string | null): Promise<ActivityLog[]> => {
    if (!isSupabaseConfigured) {
        return getLocalSelfLogs(memberId);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('get_my_activity_logs');

        if (error) {
            throw error;
        }

        return ((data ?? []) as MyActivityLogRow[]).map(mapMyActivityLogRow);
    } catch (error) {
        return fallback('getMyActivityLogs', () => getLocalSelfLogs(memberId), error);
    }
};

export const getMyMemberBadges = async (memberId?: string | null): Promise<MemberBadge[]> => {
    if (!isSupabaseConfigured) {
        return getLocalMemberBadges(memberId);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('get_my_member_badges');

        if (error) {
            throw error;
        }

        return ((data ?? []) as MyMemberBadgeRow[]).map(mapMyMemberBadgeRow);
    } catch (error) {
        return fallback('getMyMemberBadges', () => getLocalMemberBadges(memberId), error);
    }
};

export const getAuditLogs = async (): Promise<AuditLogEntry[]> => {
    if (!isSupabaseConfigured) {
        return sortAuditLogs(localAuditLogs);
    }

    try {
        const client = getSupabaseClient();
        const [auditResult, actorResult] = await Promise.all([
            client
                .from('audit_logs')
                .select('id, actor_id, entity_type, entity_id, action, diff_json, created_at')
                .order('created_at', { ascending: false })
                .limit(20),
            client.from('members').select('id, name'),
        ]);

        if (auditResult.error) throw auditResult.error;
        if (actorResult.error) throw actorResult.error;

        const auditRows = (auditResult.data ?? []) as Pick<AuditLogRow, 'id' | 'actor_id' | 'entity_type' | 'entity_id' | 'action' | 'diff_json' | 'created_at'>[];
        const actorRows = (actorResult.data ?? []) as Pick<MemberRow, 'id' | 'name'>[];
        const actorMap = new Map(actorRows.map((actor) => [actor.id, actor.name]));

        return auditRows.map((audit) => {
            const diff = parseJsonObject(audit.diff_json);
            const summary = typeof diff?.summary === 'string'
                ? diff.summary
                : `${audit.entity_type} · ${audit.action}`;

            return {
                id: audit.id,
                actorId: audit.actor_id,
                actorName: audit.actor_id ? actorMap.get(audit.actor_id) ?? '알 수 없는 운영자' : '시스템',
                entityType: audit.entity_type,
                entityId: audit.entity_id,
                action: audit.action,
                summary,
                createdAt: audit.created_at,
                diff,
            };
        });
    } catch (error) {
        return fallback('getAuditLogs', () => sortAuditLogs(localAuditLogs), error);
    }
};

export const getCorrectionRequests = async (options?: { requesterMemberId?: string | null }): Promise<CorrectionRequest[]> => {
    const requesterMemberId = options?.requesterMemberId ?? null;

    if (!isSupabaseConfigured) {
        return getLocalCorrectionRequests(requesterMemberId);
    }

    try {
        const client = getSupabaseClient();
        const requestQuery = client
            .from('correction_requests')
            .select('id, requester_member_id, activity_record_id, status, reason, review_note, reviewed_by, reviewed_at, created_at, updated_at')
            .order('created_at', { ascending: false });

        const filteredQuery = requesterMemberId
            ? requestQuery.eq('requester_member_id', requesterMemberId)
            : requestQuery;

        const [requestResult, logs, members] = await Promise.all([
            filteredQuery,
            getLogs(),
            getMembers({ includeLoginEmail: false }),
        ]);

        if (requestResult.error) {
            throw requestResult.error;
        }

        return ((requestResult.data ?? []) as CorrectionRequestRow[]).map((row) => mapCorrectionRequestRow(row, logs, members));
    } catch (error) {
        return fallback('getCorrectionRequests', () => getLocalCorrectionRequests(requesterMemberId), error);
    }
};

export const addMember = async (name: string, loginEmail?: string | null): Promise<Member> => {
    const normalizedLoginEmail = normalizeLoginEmail(loginEmail);

    if (!isSupabaseConfigured) {
        const newMember: Member = {
            id: createLocalId('member'),
            name,
            score: 0,
            loginEmail: normalizedLoginEmail,
            isApproved: false,
            roleName: null,
            teamName: null,
            status: 'active',
            joinedAt: new Date().toISOString().slice(0, 10),
        };
        localMembers.push(newMember);
        return newMember;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('members')
            .insert({
                name,
                login_email: normalizedLoginEmail,
                is_approved: false,
                status: 'active',
            })
            .select('id, name, login_email, is_approved, status, joined_at')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            score: 0,
            loginEmail: data.login_email,
            isApproved: data.is_approved,
            roleId: null,
            roleName: null,
            teamId: null,
            teamName: null,
            status: data.status,
            joinedAt: data.joined_at,
            isVisible: true,
        };
    } catch (error) {
        const newMember: Member = {
            id: createLocalId('member'),
            name,
            score: 0,
            loginEmail: normalizedLoginEmail,
            isApproved: false,
            roleId: null,
            roleName: null,
            teamId: null,
            teamName: null,
            status: 'active',
            joinedAt: new Date().toISOString().slice(0, 10),
            isVisible: true,
        };
        localMembers.push(newMember);
        return fallback('addMember', () => newMember, error);
    }
};

export const getCurrentSeason = async (): Promise<SeasonSummary | null> => {
    if (!isSupabaseConfigured) {
        return localCurrentSeason;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('seasons')
            .select('id, name, status, start_date, end_date')
            .eq('status', 'active')
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            status: data.status,
            startDate: data.start_date,
            endDate: data.end_date,
        };
    } catch (error) {
        return fallback('getCurrentSeason', () => localCurrentSeason, error);
    }
};

export const getRoles = async (): Promise<RoleSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localRoles].sort((a, b) => a.rankOrder - b.rankOrder);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('roles')
            .select('id, name, permission_scope, rank_order')
            .order('rank_order', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Pick<RoleRow, 'id' | 'name' | 'permission_scope' | 'rank_order'>[]).map((role) => ({
            id: role.id,
            name: role.name,
            permissionScope: role.permission_scope,
            rankOrder: role.rank_order,
        }));
    } catch (error) {
        return fallback('getRoles', () => [...localRoles].sort((a, b) => a.rankOrder - b.rankOrder), error);
    }
};

export const addRole = async (name: string, permissionScope: string, rankOrder: number): Promise<RoleSummary> => {
    if (!isSupabaseConfigured) {
        const role: RoleSummary = {
            id: createLocalId('role'),
            name,
            permissionScope,
            rankOrder,
        };
        localRoles.push(role);
        return role;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('roles')
            .insert({
                name,
                permission_scope: permissionScope,
                rank_order: rankOrder,
            })
            .select('id, name, permission_scope, rank_order')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            permissionScope: data.permission_scope,
            rankOrder: data.rank_order,
        };
    } catch (error) {
        const role: RoleSummary = {
            id: createLocalId('role'),
            name,
            permissionScope,
            rankOrder,
        };
        localRoles.push(role);
        return fallback('addRole', () => role, error);
    }
};

export const getTeams = async (): Promise<TeamSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localTeams].sort((a, b) => a.name.localeCompare(b.name));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('teams')
            .select('id, name, type, is_active')
            .order('name', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Pick<TeamRow, 'id' | 'name' | 'type' | 'is_active'>[]).map((team) => ({
            id: team.id,
            name: team.name,
            type: team.type,
            isActive: team.is_active,
        }));
    } catch (error) {
        return fallback('getTeams', () => [...localTeams].sort((a, b) => a.name.localeCompare(b.name)), error);
    }
};

export const addTeam = async (name: string, type: TeamType): Promise<TeamSummary> => {
    if (!isSupabaseConfigured) {
        const team: TeamSummary = {
            id: createLocalId('team'),
            name,
            type,
            isActive: true,
        };
        localTeams.push(team);
        return team;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('teams')
            .insert({
                name,
                type,
                is_active: true,
            })
            .select('id, name, type, is_active')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            type: data.type,
            isActive: data.is_active,
        };
    } catch (error) {
        const team: TeamSummary = {
            id: createLocalId('team'),
            name,
            type,
            isActive: true,
        };
        localTeams.push(team);
        return fallback('addTeam', () => team, error);
    }
};

export const getSeasons = async (): Promise<SeasonSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localSeasons].sort((a, b) => b.startDate.localeCompare(a.startDate));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('seasons')
            .select('id, name, status, start_date, end_date')
            .order('start_date', { ascending: false });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Pick<SeasonRow, 'id' | 'name' | 'status' | 'start_date' | 'end_date'>[]).map((season) => ({
            id: season.id,
            name: season.name,
            status: season.status,
            startDate: season.start_date,
            endDate: season.end_date,
        }));
    } catch (error) {
        return fallback('getSeasons', () => [...localSeasons].sort((a, b) => b.startDate.localeCompare(a.startDate)), error);
    }
};

export const addSeason = async (
    name: string,
    startDate: string,
    endDate: string,
    status: SeasonStatus,
): Promise<SeasonSummary> => {
    if (!isSupabaseConfigured) {
        const season: SeasonSummary = {
            id: createLocalId('season'),
            name,
            status,
            startDate,
            endDate,
        };
        localSeasons.push(season);
        return season;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('seasons')
            .insert({
                name,
                start_date: startDate,
                end_date: endDate,
                status,
            })
            .select('id, name, status, start_date, end_date')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            status: data.status,
            startDate: data.start_date,
            endDate: data.end_date,
        };
    } catch (error) {
        const season: SeasonSummary = {
            id: createLocalId('season'),
            name,
            status,
            startDate,
            endDate,
        };
        localSeasons.push(season);
        return fallback('addSeason', () => season, error);
    }
};

export const deleteMember = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localMembers = localMembers.filter((member) => member.id !== id);
        localLogs = localLogs.filter((log) => log.memberId !== id);
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('members')
            .update({
                status: 'inactive',
                is_visible: false,
            })
            .eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        localMembers = localMembers.filter((member) => member.id !== id);
        localLogs = localLogs.filter((log) => log.memberId !== id);
        fallback('deleteMember', () => undefined, error);
    }
};

export const updateMember = async (
    id: string,
    updates: Partial<Pick<Member, 'name' | 'loginEmail' | 'roleId' | 'teamId' | 'status' | 'isApproved' | 'isVisible'>>,
): Promise<void> => {
    if (!isSupabaseConfigured) {
        localMembers = localMembers.map((member) => {
            if (member.id !== id) {
                return member;
            }

            const nextRoleId = updates.roleId !== undefined ? updates.roleId : member.roleId ?? null;
            const nextTeamId = updates.teamId !== undefined ? updates.teamId : member.teamId ?? null;

            return {
                ...member,
                name: updates.name ?? member.name,
                loginEmail: updates.loginEmail !== undefined ? normalizeLoginEmail(updates.loginEmail) : member.loginEmail ?? null,
                roleId: nextRoleId,
                roleName: nextRoleId ? localRoles.find((role) => role.id === nextRoleId)?.name ?? null : null,
                teamId: nextTeamId,
                teamName: nextTeamId ? localTeams.find((team) => team.id === nextTeamId)?.name ?? null : null,
                status: updates.status ?? member.status,
                isApproved: updates.isApproved ?? member.isApproved,
                isVisible: updates.isVisible ?? member.isVisible,
            };
        });
        return;
    }

    try {
        const client = getSupabaseClient();
        const payload: Database['public']['Tables']['members']['Update'] = {};

        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.loginEmail !== undefined) payload.login_email = normalizeLoginEmail(updates.loginEmail);
        if (updates.roleId !== undefined) payload.role_id = updates.roleId;
        if (updates.teamId !== undefined) payload.team_id = updates.teamId;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.isApproved !== undefined) payload.is_approved = updates.isApproved;
        if (updates.isVisible !== undefined) payload.is_visible = updates.isVisible;

        const { error } = await client.from('members').update(payload).eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        fallback('updateMember', () => undefined, error);
    }
};

export const addCategory = async ({
    categoryName,
    pointValue,
    penaltyPoint = pointValue < 0 ? Math.abs(pointValue) : 0,
    conditionSummary = '',
    groupName = 'manual',
}: CategoryInput): Promise<Category> => {
    const normalizedConditionSummary = conditionSummary.trim();
    const normalizedGroupName = groupName.trim() || 'manual';
    const conditionJson = normalizedConditionSummary ? { summary: normalizedConditionSummary } : {};

    if (!isSupabaseConfigured) {
        const newCategory: Category = {
            id: createLocalId('rule'),
            activityTypeId: createLocalId('activity_type'),
            categoryName,
            groupName: normalizedGroupName,
            pointValue,
            penaltyPoint,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson,
            version: 1,
            isActive: true,
        };
        localCategories.push(newCategory);
        return newCategory;
    }

    try {
        const client = getSupabaseClient();
        const { data: activityType, error: activityTypeError } = await client
            .from('activity_types')
            .insert({
                code: createActivityCode(),
                name: categoryName,
                group_name: normalizedGroupName,
            })
            .select('id, group_name')
            .single();

        if (activityTypeError) {
            throw activityTypeError;
        }

        const { data: pointRule, error: pointRuleError } = await client
            .from('point_rules')
            .insert({
                activity_type_id: activityType.id,
                base_point: pointValue,
                penalty_point: penaltyPoint,
                condition_json: conditionJson,
                is_active: true,
                version: 1,
            })
            .select('id, activity_type_id, base_point, penalty_point, condition_json, is_active, version')
            .single();

        if (pointRuleError) {
            throw pointRuleError;
        }

        return {
            id: pointRule.id,
            activityTypeId: pointRule.activity_type_id,
            categoryName,
            groupName: activityType.group_name,
            pointValue: pointRule.base_point,
            penaltyPoint: pointRule.penalty_point,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson: parseJsonObject(pointRule.condition_json),
            version: pointRule.version,
            isActive: pointRule.is_active,
        };
    } catch (error) {
        const newCategory: Category = {
            id: createLocalId('rule'),
            activityTypeId: createLocalId('activity_type'),
            categoryName,
            groupName: normalizedGroupName,
            pointValue,
            penaltyPoint,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson,
            version: 1,
            isActive: true,
        };
        localCategories.push(newCategory);
        return fallback('addCategory', () => newCategory, error);
    }
};

export const createCategoryVersion = async (
    sourceRuleId: string,
    {
        pointValue,
        penaltyPoint = 0,
        conditionSummary = '',
    }: Pick<CategoryInput, 'pointValue' | 'penaltyPoint' | 'conditionSummary'>,
): Promise<Category | null> => {
    const normalizedConditionSummary = conditionSummary.trim();
    const conditionJson = normalizedConditionSummary ? { summary: normalizedConditionSummary } : {};

    if (!isSupabaseConfigured) {
        const sourceCategory = localCategories.find((category) => category.id === sourceRuleId);
        if (!sourceCategory || !sourceCategory.activityTypeId) {
            return null;
        }

        localCategories = localCategories.map((category) =>
            category.id === sourceRuleId
                ? {
                    ...category,
                    isActive: false,
                }
                : category,
        );

        const nextCategory: Category = {
            id: createLocalId('rule'),
            activityTypeId: sourceCategory.activityTypeId,
            categoryName: sourceCategory.categoryName,
            groupName: sourceCategory.groupName ?? 'manual',
            pointValue,
            penaltyPoint,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson,
            version: (sourceCategory.version ?? 1) + 1,
            isActive: true,
        };
        localCategories.push(nextCategory);
        return nextCategory;
    }

    try {
        const client = getSupabaseClient();
        const { data: newRuleId, error: createError } = await client.rpc('create_point_rule_version', {
            p_source_rule_id: sourceRuleId,
            p_base_point: pointValue,
            p_penalty_point: penaltyPoint,
            p_condition_json: conditionJson,
        });

        if (createError) {
            throw createError;
        }

        const { data: insertedRule, error: insertedRuleError } = await client
            .from('point_rule_catalog')
            .select('id, activity_type_id, category_name, group_name, point_value, penalty_point, condition_json, is_active, version')
            .eq('id', newRuleId)
            .single();

        if (insertedRuleError) {
            throw insertedRuleError;
        }

        return {
            id: insertedRule.id,
            activityTypeId: insertedRule.activity_type_id,
            categoryName: insertedRule.category_name,
            groupName: insertedRule.group_name,
            pointValue: insertedRule.point_value,
            penaltyPoint: insertedRule.penalty_point,
            conditionSummary: getConditionSummary(insertedRule.condition_json),
            conditionJson: parseJsonObject(insertedRule.condition_json),
            version: insertedRule.version,
            isActive: insertedRule.is_active,
        };
    } catch (error) {
        return fallback('createCategoryVersion', () => null, error);
    }
};

export const deleteCategory = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localCategories = localCategories.map((category) =>
            category.id === id
                ? {
                    ...category,
                    isActive: false,
                }
                : category,
        );
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('point_rules')
            .update({ is_active: false })
            .eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        localCategories = localCategories.map((category) =>
            category.id === id
                ? {
                    ...category,
                    isActive: false,
                }
                : category,
        );
        fallback('deleteCategory', () => undefined, error);
    }
};

export const createActivityEntry = async (
    memberId: string,
    categoryId: string,
    note?: string,
    options?: ActivityEntryOptions,
): Promise<void> => {
    const trimmedNote = note?.trim() || null;
    const occurredAt = options?.occurredAt ?? new Date().toISOString();
    const evidenceUrl = options?.evidenceUrl?.trim() || null;
    const recordId = createLocalId('record');

    if (!isSupabaseConfigured) {
        const category = localCategories.find((item) => item.id === categoryId);
        const member = localMembers.find((item) => item.id === memberId);

        if (!category || !member) {
            return;
        }

        member.score += category.pointValue;
        localLogs.push({
            id: createLocalId('log'),
            recordId,
            timestamp: occurredAt,
            memberId,
            categoryId,
            pointDelta: category.pointValue,
            reason: options?.reason ?? trimmedNote ?? category.categoryName,
            note: trimmedNote,
            evidenceUrl,
            memberName: member.name,
            categoryName: category.categoryName,
            recordStatus: 'confirmed',
        });
        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'activity_record',
            entityId: recordId,
            action: 'created',
            summary: `${member.name} · ${category.categoryName} 기록 생성`,
            diff: {
                memberId,
                memberName: member.name,
                pointRuleId: categoryId,
                ruleName: category.categoryName,
                delta: category.pointValue,
                reason: options?.reason ?? trimmedNote ?? category.categoryName,
                occurredAt,
                evidenceUrl,
            },
        });
        syncLocalMemberBadges(memberId);
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.rpc('create_activity_entry', {
            p_member_id: memberId,
            p_point_rule_id: categoryId,
            p_note: trimmedNote,
            p_reason: options?.reason ?? trimmedNote ?? '수동 활동 기록',
            p_occurred_at: occurredAt,
            p_evidence_url: evidenceUrl,
        });

        if (error) throw error;
    } catch (error) {
        const category = localCategories.find((item) => item.id === categoryId);
        const member = localMembers.find((item) => item.id === memberId);

        if (category && member) {
            member.score += category.pointValue;
            localLogs.push({
                id: createLocalId('log'),
                recordId,
                timestamp: occurredAt,
                memberId,
                categoryId,
                pointDelta: category.pointValue,
                reason: options?.reason ?? trimmedNote ?? category.categoryName,
                note: trimmedNote,
                evidenceUrl,
                memberName: member.name,
                categoryName: category.categoryName,
                recordStatus: 'confirmed',
            });
            logLocalAuditEntry({
                actorId: null,
                actorName: '로컬 운영자',
                entityType: 'activity_record',
                entityId: recordId,
                action: 'created',
                summary: `${member.name} · ${category.categoryName} 기록 생성`,
                diff: {
                    memberId,
                    memberName: member.name,
                    pointRuleId: categoryId,
                    ruleName: category.categoryName,
                    delta: category.pointValue,
                    reason: options?.reason ?? trimmedNote ?? category.categoryName,
                    occurredAt,
                    evidenceUrl,
                },
            });
            syncLocalMemberBadges(memberId);
        }

        fallback('createActivityEntry', () => undefined, error);
    }
};

export const awardPoints = async (memberId: string, categoryId: string): Promise<void> => {
    await createActivityEntry(memberId, categoryId, '멤버 대시보드에서 빠른 점수 반영');
};

export const createBatchActivityEntries = async (
    memberIds: string[],
    categoryId: string,
    note?: string,
    options?: ActivityEntryOptions,
): Promise<void> => {
    const trimmedNote = note?.trim() || null;
    const occurredAt = options?.occurredAt ?? new Date().toISOString();
    const evidenceUrl = options?.evidenceUrl?.trim() || null;

    if (isSupabaseConfigured) {
        try {
            const client = getSupabaseClient();
            const { error } = await client.rpc('create_batch_activity_entries', {
                p_member_ids: memberIds,
                p_point_rule_id: categoryId,
                p_note: trimmedNote,
                p_reason: options?.reason ?? trimmedNote ?? '수동 일괄 활동 기록',
                p_occurred_at: occurredAt,
                p_evidence_url: evidenceUrl,
            });

            if (error) {
                throw error;
            }

            return;
        } catch (error) {
            fallback('createBatchActivityEntries', () => undefined, error);
        }
    }

    for (const memberId of memberIds) {
        await createActivityEntry(memberId, categoryId, trimmedNote ?? undefined, {
            ...options,
            evidenceUrl: evidenceUrl ?? undefined,
        });
    }
};

export const reverseActivityEntry = async (recordId: string, note?: string): Promise<void> => {
    const trimmedNote = note?.trim() || null;
    const applyLocalReversal = () => {
        const originalLog = localLogs.find((log) => log.recordId === recordId && !log.reversalOf);
        const hasReversal = localLogs.some((log) => log.reversalOf === originalLog?.id);

        if (!originalLog || hasReversal) {
            return;
        }

        const category = localCategories.find((item) => item.id === originalLog.categoryId);
        const member = localMembers.find((item) => item.id === originalLog.memberId);

        if (member) {
            member.score -= originalLog.pointDelta;
        }

        const reversalTimestamp = new Date().toISOString();

        localLogs = localLogs.map((log) =>
            log.recordId === recordId
                ? {
                    ...log,
                    recordStatus: 'reversed',
                }
                : log,
        );

        localLogs.push({
            id: createLocalId('log'),
            recordId,
            timestamp: reversalTimestamp,
            memberId: originalLog.memberId,
            categoryId: originalLog.categoryId,
            pointDelta: originalLog.pointDelta * -1,
            reason: trimmedNote ?? `기록 취소 · ${originalLog.reason ?? originalLog.categoryName ?? '원본 기록'}`,
            note: originalLog.note ?? null,
            evidenceUrl: originalLog.evidenceUrl ?? null,
            memberName: member?.name ?? originalLog.memberName ?? null,
            categoryName: category?.categoryName ?? originalLog.categoryName ?? null,
            reversalOf: originalLog.id,
            isReversal: true,
            recordStatus: 'reversed',
        });
        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'activity_record',
            entityId: recordId,
            action: 'reversed',
            summary: `${member?.name ?? originalLog.memberName ?? '알 수 없는 멤버'} · ${category?.categoryName ?? originalLog.categoryName ?? '활동'} 기록 취소`,
            createdAt: reversalTimestamp,
            diff: {
                memberId: originalLog.memberId,
                memberName: member?.name ?? originalLog.memberName ?? null,
                pointRuleId: originalLog.categoryId,
                ruleName: category?.categoryName ?? originalLog.categoryName ?? null,
                reversalOf: originalLog.id,
                delta: originalLog.pointDelta * -1,
                reason: trimmedNote ?? `기록 취소 · ${originalLog.reason ?? originalLog.categoryName ?? '원본 기록'}`,
            },
        });
        syncLocalMemberBadges(originalLog.memberId);
    };

    if (!isSupabaseConfigured) {
        applyLocalReversal();
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.rpc('reverse_activity_entry', {
            p_record_id: recordId,
            p_note: trimmedNote,
        });

        if (error) {
            throw error;
        }
    } catch (error) {
        applyLocalReversal();
        fallback('reverseActivityEntry', () => undefined, error);
    }
};

export const submitCorrectionRequest = async (recordId: string, reason: string): Promise<void> => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        throw new Error('정정 요청 사유를 입력해 주세요.');
    }

    const applyLocalSubmit = () => {
        const relatedLog = enrichLocalLogs().find((log) => log.recordId === recordId && !log.isReversal);
        const requester = relatedLog
            ? localMembers.find((member) => member.id === relatedLog.memberId) ?? null
            : getLocalSelfMember();

        if (!relatedLog || !requester) {
            throw new Error('정정 요청 대상을 찾지 못했습니다.');
        }

        const hasOpenRequest = localCorrectionRequests.some(
            (request) =>
                request.requesterMemberId === requester.id &&
                request.activityRecordId === recordId &&
                (request.status === 'pending' || request.status === 'reviewing'),
        );

        if (hasOpenRequest) {
            throw new Error('이미 처리 중인 정정 요청이 있습니다.');
        }

        const createdAt = new Date().toISOString();
        localCorrectionRequests.push({
            id: createLocalId('correction'),
            requesterMemberId: requester.id,
            requesterName: requester.name,
            activityRecordId: recordId,
            status: 'pending',
            reason: trimmedReason,
            reviewNote: null,
            reviewedBy: null,
            reviewedByName: null,
            reviewedAt: null,
            createdAt,
            updatedAt: createdAt,
            activitySummary: relatedLog.categoryName ?? relatedLog.reason ?? '활동 기록',
            activityOccurredAt: relatedLog.timestamp,
            activityPointDelta: relatedLog.pointDelta,
        });
    };

    if (!isSupabaseConfigured) {
        applyLocalSubmit();
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.rpc('submit_correction_request', {
            p_record_id: recordId,
            p_reason: trimmedReason,
        });

        if (error) {
            throw error;
        }
    } catch (error) {
        applyLocalSubmit();
        fallback('submitCorrectionRequest', () => undefined, error);
    }
};

export const updateCorrectionRequestStatus = async (
    requestId: string,
    status: CorrectionRequestStatus,
    reviewNote?: string,
): Promise<void> => {
    const trimmedReviewNote = reviewNote?.trim() || null;

    const applyLocalUpdate = () => {
        const reviewer = getLocalSelfMember();
        const request = localCorrectionRequests.find((item) => item.id === requestId);

        if (!request) {
            throw new Error('정정 요청을 찾지 못했습니다.');
        }

        const updatedAt = new Date().toISOString();
        request.status = status;
        request.reviewNote = trimmedReviewNote;
        request.reviewedBy = reviewer?.id ?? null;
        request.reviewedByName = reviewer?.name ?? '로컬 운영자';
        request.reviewedAt = updatedAt;
        request.updatedAt = updatedAt;
    };

    if (!isSupabaseConfigured) {
        applyLocalUpdate();
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.rpc('update_correction_request_status', {
            p_request_id: requestId,
            p_status: status,
            p_review_note: trimmedReviewNote,
        });

        if (error) {
            throw error;
        }
    } catch (error) {
        applyLocalUpdate();
        fallback('updateCorrectionRequestStatus', () => undefined, error);
    }
};
