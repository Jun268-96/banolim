import type {
    ActivityGroup,
    ActivityLog,
    AttendanceSession,
    AttendanceSessionMember,
    AttendanceStatus,
    AttendanceTargetGroup,
    AnnouncementItem,
    AuditLogEntry,
    Badge,
    BadgeUpsertInput,
    Category,
    CorrectionRequest,
    CorrectionRequestStatus,
    HardDeleteMemberResult,
    Member,
    MemberBadge,
    RoleSummary,
    ScheduleEventItem,
    SeasonSummary,
    SeasonDataResetResult,
    SiteBanner,
    TeamDeleteResult,
    TeamMemberUpdateResult,
    TeamSummary,
    TeamType,
    SeasonStatus,
} from '../types';
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from './supabase';
import type { Database, Json } from '../types/database';
import { getSupabaseClient } from './api/shared/client';
import { mapBadgeRow, mapMemberBadgeRow } from './api/mappers/badges';
import {
    parseHardDeleteMemberResult,
    parseSeasonDataResetResult,
    parseTeamDeleteResult,
    parseTeamMemberUpdateResult,
} from './api/mappers/results';
import {
    filterMembersForAttendanceGroup,
    getAttendanceRule,
    getAttendanceTargetGroupLabel,
} from './domain/attendance';
import { filterEffectiveActivityLogs } from './domain/activityLogs';
import { getErrorMessage, isMissingSupabaseRelationError, isNetworkFetchError } from './api/shared/errors';
import {
    clearLatestDataFallbackState,
    notifySiteBannerListeners,
    reportDataFallback,
    subscribeToDataFallbackState,
    subscribeToSiteBannerChanges,
    getLatestDataFallbackState,
} from './api/shared/fallbackState';
import { localState } from './api/shared/localState';

const sendPushNotification = (title: string, body: string): void => {
    if (!isSupabaseConfigured) return;
    void fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey ?? '',
            Authorization: `Bearer ${supabaseAnonKey ?? ''}`,
        },
        body: JSON.stringify({ title, body, url: '/' }),
    }).catch(() => {
        // 알림 전송 실패는 무시 (fire-and-forget)
    });
};
import {
    computeBadgeMetrics,
    getBadgeCriteriaSummary,
    hasBadgeCriteria,
    isBadgeEarnedByMetrics,
    normalizeBadgeCode,
    normalizeBadgeCriteria,
} from './badges';

type MemberRow = Database['public']['Tables']['members']['Row'];
type RoleRow = Database['public']['Tables']['roles']['Row'];
type TeamRow = Database['public']['Tables']['teams']['Row'];
type BadgeRow = Database['public']['Tables']['badges']['Row'];
type MemberTeamLinkRow = Database['public']['Tables']['member_team_links']['Row'];
type SeasonRow = Database['public']['Tables']['seasons']['Row'];
type ActivityGroupRow = Database['public']['Tables']['activity_groups']['Row'];
type ActivityRecordRow = Database['public']['Tables']['activity_records']['Row'];
type PointLedgerRow = Database['public']['Tables']['point_ledgers']['Row'];
type AuditLogRow = Database['public']['Tables']['audit_logs']['Row'];
type CorrectionRequestRow = Database['public']['Tables']['correction_requests']['Row'];
type SiteBannerRow = Database['public']['Tables']['site_banners']['Row'];
type AttendanceSessionRow = Database['public']['Tables']['attendance_sessions']['Row'];
type AttendanceSessionMemberRow = Database['public']['Tables']['attendance_session_members']['Row'];
type MemberScoreSummaryRow = Database['public']['Views']['member_score_summary']['Row'];
type PointRuleCatalogRow = Database['public']['Views']['point_rule_catalog']['Row'];
type MyMemberOverviewRow = Database['public']['Functions']['get_my_member_overview']['Returns'][number];
type MyActivityLogRow = Database['public']['Functions']['get_my_activity_logs']['Returns'][number];
type MyMemberBadgeRow = Database['public']['Functions']['get_my_member_badges']['Returns'][number];
type GetAuditLogsOptions = {
    entityType?: string;
    entityId?: string;
    limit?: number;
};
export {
    clearLatestDataFallbackState,
    getLatestDataFallbackState,
    subscribeToDataFallbackState,
    subscribeToSiteBannerChanges,
};

const createLocalId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const createAttendanceCode = () => Math.random().toString(36).replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 8);
const createActivityGroupCode = (name: string) => {
    const asciiSlug = name
        .normalize('NFKD')
        .replace(/[^\p{ASCII}]/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    const base = asciiSlug || 'group';
    return `${base}-${Math.random().toString(36).slice(2, 6)}`;
};
const normalizeLoginEmail = (value?: string | null) => {
    const normalized = value?.trim().toLowerCase() ?? '';
    return normalized.length > 0 ? normalized : null;
};
const attendanceStatusLabels: Record<AttendanceStatus, string> = {
    present: '참석',
    late: '지각',
    absent: '결석',
};
const dedupeTeamIds = (teamIds: Array<string | null | undefined>) => [...new Set(teamIds.filter((teamId): teamId is string => Boolean(teamId)))];

const getLocalRoleById = (roleId?: string | null) => localState.roles.find((role) => role.id === roleId) ?? null;
const getLocalTeamById = (teamId?: string | null) => localState.teams.find((team) => team.id === teamId) ?? null;

const buildLocalMemberAuditSummary = (memberName: string, changes: Record<string, unknown>, action: 'created' | 'updated') => {
    if (action === 'created') {
        return `${memberName} 멤버 등록`;
    }

    if (changes.role) return `${memberName} · 직책/권한 변경`;
    if (changes.loginEmail) return `${memberName} · 로그인 이메일 변경`;
    if (changes.approval) return `${memberName} · 승인 상태 변경`;
    if (changes.status) return `${memberName} · 회원 상태 변경`;
    if (changes.team || changes.teams) return `${memberName} · 소속 팀 변경`;
    return `${memberName} · 회원 정보 수정`;
};

const cachedMemberResults = new Map<string, Member[]>();

const normalizeBadgeInput = (input: BadgeUpsertInput): BadgeUpsertInput => {
    const finalCode = normalizeBadgeCode(input.code);
    const normalizedCriteria = normalizeBadgeCriteria(input.criteria);

    if (!input.name.trim()) {
        throw new Error('배지 이름을 입력해 주세요.');
    }

    if (!finalCode) {
        throw new Error('배지 코드를 입력해 주세요.');
    }

    if (!input.description.trim()) {
        throw new Error('배지 설명을 입력해 주세요.');
    }

    if (input.isActive && !hasBadgeCriteria(normalizedCriteria)) {
        throw new Error('활성 배지는 최소 한 개 이상의 획득 조건이 필요합니다.');
    }

    return {
        code: finalCode,
        name: input.name.trim(),
        description: input.description.trim(),
        iconKey: input.iconKey.trim() || 'bandi-core',
        imageUrl: input.imageUrl?.trim() ? input.imageUrl.trim() : null,
        tone: input.tone,
        evaluationScope: input.evaluationScope,
        criteria: normalizedCriteria,
        sortOrder: Number.isFinite(input.sortOrder) ? Math.max(0, Math.floor(input.sortOrder)) : 100,
        isActive: input.isActive,
    };
};

const sleep = (ms: number) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const getLocalMemberTeamIds = (memberId: string) =>
    dedupeTeamIds(localState.memberTeamLinks.filter((link) => link.memberId === memberId).map((link) => link.teamId));

const getLocalMemberTeamNames = (memberId: string) =>
    getLocalMemberTeamIds(memberId)
        .map((teamId) => getLocalTeamById(teamId)?.name ?? null)
        .filter((teamName): teamName is string => Boolean(teamName));

const syncLocalMemberTeamState = (memberId: string, requestedTeamIds: string[]) => {
    const normalizedTeamIds = dedupeTeamIds(requestedTeamIds).filter((teamId) => Boolean(getLocalTeamById(teamId)));
    localState.memberTeamLinks = [
        ...localState.memberTeamLinks.filter((link) => link.memberId !== memberId),
        ...normalizedTeamIds.map((teamId) => ({
            id: createLocalId('member_team'),
            memberId,
            teamId,
            createdAt: new Date().toISOString(),
        })),
    ];

    const primaryTeamId = normalizedTeamIds[0] ?? null;
    const teamNames = normalizedTeamIds
        .map((teamId) => getLocalTeamById(teamId)?.name ?? null)
        .filter((teamName): teamName is string => Boolean(teamName));

    localState.members = localState.members.map((member) =>
        member.id === memberId
            ? {
                ...member,
                teamId: primaryTeamId,
                teamName: teamNames[0] ?? null,
                teamIds: normalizedTeamIds,
                teamNames,
            }
            : member,
    );
};

const getLocalCurrentSeasonSummary = () =>
    [...localState.seasons]
        .filter((season) => season.status === 'active')
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;

const isTimestampInSeason = (timestamp: string, season: SeasonSummary) => {
    const targetTime = new Date(timestamp).getTime();
    const seasonStartTime = new Date(`${season.startDate}T00:00:00`).getTime();
    const seasonEndTime = season.endDate ? new Date(`${season.endDate}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY;

    return targetTime >= seasonStartTime && targetTime <= seasonEndTime;
};

const sortMembers = (members: Member[]) => [...members].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
const sortAnnouncements = (items: AnnouncementItem[]) =>
    [...items].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || (b.startAt ?? b.createdAt).localeCompare(a.startAt ?? a.createdAt));
const sortScheduleEvents = (items: ScheduleEventItem[]) =>
    [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));
const sortSiteBanners = (items: SiteBanner[]) =>
    [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt));
const sortAttendanceSessions = (items: AttendanceSession[]) =>
    [...items].sort((a, b) => {
        if (a.isActive !== b.isActive) {
            return Number(b.isActive) - Number(a.isActive);
        }

        return b.startsAt.localeCompare(a.startsAt);
    });

const getLocalCategoryById = (categoryId?: string | null) =>
    localState.categories.find((category) => category.id === categoryId) ?? null;

const rebuildLocalAttendanceSessions = () => {
    const teamMap = new Map(localState.teams.map((team) => [team.id, team.name]));

    localState.attendanceSessions = sortAttendanceSessions(localState.attendanceSessions.map((session) =>
        mapAttendanceSession(
            {
                id: session.id,
                title: session.title,
                session_code: session.sessionCode,
                point_rule_id: session.pointRuleId,
                season_id: session.seasonId ?? null,
                starts_at: session.startsAt,
                ends_at: session.endsAt ?? null,
                note: session.note ?? null,
                is_active: session.isActive,
                is_hidden: session.isHidden,
                created_at: session.createdAt,
                target_group_type: session.targetGroupType,
                target_team_id: session.targetTeamId ?? null,
            },
            localState.attendanceSessionMembers.filter((entry) => entry.sessionId === session.id),
            teamMap,
        ),
    ));
};

const refreshLocalMemberBadgesForMembers = (memberIds: string[]) => {
    const normalizedMemberIds = [...new Set(memberIds.filter(Boolean))];

    if (normalizedMemberIds.length === 0) {
        return 0;
    }

    normalizedMemberIds.forEach((memberId) => syncLocalMemberBadges(memberId));

    return localState.memberBadges.filter((badge) => normalizedMemberIds.includes(badge.memberId)).length;
};

const removeLocalActivityRecords = (predicate: (log: ActivityLog, category: Category | null) => boolean) => {
    const targetedLogs = localState.logs.filter((log) => predicate(log, getLocalCategoryById(log.categoryId)));
    const targetedRecordIds = new Set(targetedLogs.map((log) => log.recordId).filter((recordId): recordId is string => Boolean(recordId)));
    const targetedMemberIds = [...new Set(targetedLogs.map((log) => log.memberId))];
    const pointLedgerCount = localState.logs.filter((log) => log.recordId && targetedRecordIds.has(log.recordId)).length;
    const correctionRequestCount = localState.correctionRequests.filter((request) =>
        Boolean(request.activityRecordId && targetedRecordIds.has(request.activityRecordId)),
    ).length;

    localState.logs = localState.logs.filter((log) => !log.recordId || !targetedRecordIds.has(log.recordId));
    localState.attendanceSessionMembers = localState.attendanceSessionMembers.map((entry) =>
        entry.activityRecordId && targetedRecordIds.has(entry.activityRecordId)
            ? { ...entry, activityRecordId: null }
            : entry,
    );

    for (let index = localState.correctionRequests.length - 1; index >= 0; index -= 1) {
        if (localState.correctionRequests[index].activityRecordId && targetedRecordIds.has(localState.correctionRequests[index].activityRecordId!)) {
            localState.correctionRequests.splice(index, 1);
        }
    }

    rebuildLocalAttendanceSessions();

    return {
        activityRecordCount: targetedRecordIds.size,
        pointLedgerCount,
        correctionRequestCount,
        memberIds: targetedMemberIds,
    };
};

const enrichLocalLogs = () => {
    const memberMap = new Map(localState.members.map((member) => [member.id, member]));
    const categoryMap = new Map(localState.categories.map((category) => [category.id, category]));

    return [...localState.logs]
        .map((log) => ({
            ...log,
            memberName: memberMap.get(log.memberId)?.name ?? '알 수 없는 멤버',
            categoryName: categoryMap.get(log.categoryId)?.categoryName ?? '알 수 없는 규칙',
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

const getLocalSelfMember = (memberId?: string | null) => {
    const sortedMembers = sortMembers(localState.members);

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
    localState.auditLogs.push({
        id: createLocalId('audit'),
        createdAt: entry.createdAt ?? new Date().toISOString(),
        ...entry,
    });
};

const getLocalCorrectionRequests = (requesterMemberId?: string | null) =>
    sortCorrectionRequests(
        localState.correctionRequests
            .filter((request) => !requesterMemberId || request.requesterMemberId === requesterMemberId)
            .map((request) => ({ ...request })),
    );

const getEffectiveLocalLogsForMember = (memberId: string) =>
    filterEffectiveActivityLogs(enrichLocalLogs()).filter((log) => log.memberId === memberId);

const getLocalBadgeMetricsForScope = (memberId: string, badge: Badge, seasonId?: string | null) => {
    const effectiveLogs = getEffectiveLocalLogsForMember(memberId);
    const scopedLogs = badge.evaluationScope === 'lifetime'
        ? effectiveLogs
        : effectiveLogs.filter((log) => {
            const targetSeason = localState.seasons.find((season) => season.id === seasonId) ?? null;
            return targetSeason ? isTimestampInSeason(log.timestamp, targetSeason) : false;
        });

    return computeBadgeMetrics(scopedLogs);
};

const syncLocalMemberBadges = (memberId?: string | null) => {
    const targetIds = memberId ? [memberId] : localState.members.map((member) => member.id);
    const activeSeasonId = getLocalCurrentSeasonSummary()?.id ?? localState.currentSeason.id;

    targetIds.forEach((targetId) => {
        const badgesBySort = [...localState.badges].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));

        badgesBySort.forEach((badge) => {
            const existingAward = localState.memberBadges.find((entry) => entry.memberId === targetId && entry.badgeId === badge.id) ?? null;
            const targetSeasonId = badge.evaluationScope === 'season'
                ? existingAward?.seasonId ?? activeSeasonId
                : null;
            const metrics = getLocalBadgeMetricsForScope(targetId, badge, targetSeasonId);
            const isEligible = badge.isActive !== false && isBadgeEarnedByMetrics(badge.criteria, metrics);

            if (isEligible && !existingAward) {
                localState.memberBadges.push({
                    id: createLocalId('member_badge'),
                    memberId: targetId,
                    badgeId: badge.id,
                    badgeCode: badge.code,
                    badgeName: badge.name,
                    badgeDescription: badge.description,
                    iconKey: badge.iconKey,
                    imageUrl: badge.imageUrl ?? null,
                    tone: badge.tone ?? 'sky',
                    evaluationScope: badge.evaluationScope ?? 'season',
                    criteria: normalizeBadgeCriteria(badge.criteria),
                    awardedAt: new Date().toISOString(),
                    seasonId: targetSeasonId,
                });
            }

            if (!isEligible && existingAward) {
                const targetIndex = localState.memberBadges.findIndex((entry) => entry.id === existingAward.id);
                if (targetIndex >= 0) {
                    localState.memberBadges.splice(targetIndex, 1);
                }
            }

            if (isEligible && existingAward) {
                const targetIndex = localState.memberBadges.findIndex((entry) => entry.id === existingAward.id);
                if (targetIndex >= 0) {
                    localState.memberBadges.splice(targetIndex, 1, {
                        ...existingAward,
                        badgeCode: badge.code,
                        badgeName: badge.name,
                        badgeDescription: badge.description,
                        iconKey: badge.iconKey,
                        imageUrl: badge.imageUrl ?? null,
                        tone: badge.tone ?? 'sky',
                        evaluationScope: badge.evaluationScope ?? 'season',
                        criteria: normalizeBadgeCriteria(badge.criteria),
                        seasonId: targetSeasonId,
                    });
                }
            }
        });
    });
};

const getLocalMemberBadges = (memberId?: string | null) => {
    const targetId = memberId ?? getLocalSelfMember()?.id;
    if (!targetId) {
        return [] as MemberBadge[];
    }

    syncLocalMemberBadges(targetId);

    return [...localState.memberBadges]
        .filter((entry) => entry.memberId === targetId)
        .sort((a, b) => {
            const badgeA = localState.badges.find((badge) => badge.id === a.badgeId);
            const badgeB = localState.badges.find((badge) => badge.id === b.badgeId);
            return (badgeA?.sortOrder ?? 999) - (badgeB?.sortOrder ?? 999) || b.awardedAt.localeCompare(a.awardedAt);
        });
};

const getAllLocalMemberBadges = () => {
    localState.members.forEach((member) => syncLocalMemberBadges(member.id));

    return [...localState.memberBadges].sort((a, b) => b.awardedAt.localeCompare(a.awardedAt));
};

const parseJsonObject = (value: Json): Record<string, unknown> | null => {
    if (!value || Array.isArray(value) || typeof value !== 'object') {
        return null;
    }

    return value as Record<string, unknown>;
};

const mapAttendanceSessionMember = (
    row: Pick<AttendanceSessionMemberRow, 'id' | 'session_id' | 'member_id' | 'attendance_status' | 'activity_record_id' | 'created_at' | 'updated_at'>,
    memberMap: Map<string, Member>,
): AttendanceSessionMember => {
    const member = memberMap.get(row.member_id);
    const teamNames = member?.teamNames ?? (member?.teamName ? [member.teamName] : []);

    return {
        id: row.id,
        sessionId: row.session_id,
        memberId: row.member_id,
        memberName: member?.name ?? '알 수 없는 멤버',
        roleName: member?.roleName ?? null,
        teamNames,
        status: (row.attendance_status as AttendanceStatus) ?? 'present',
        activityRecordId: row.activity_record_id ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
};

const buildAttendanceStatusCounts = (entries: AttendanceSessionMember[]) =>
    entries.reduce<Record<AttendanceStatus, number>>((acc, entry) => {
        acc[entry.status] += 1;
        return acc;
    }, {
        present: 0,
        late: 0,
        absent: 0,
    });

const mapAttendanceSession = (
    row: Pick<
        AttendanceSessionRow,
        'id' | 'title' | 'session_code' | 'point_rule_id' | 'season_id' | 'starts_at' | 'ends_at' | 'note' | 'is_active' | 'is_hidden' | 'created_at' | 'target_group_type' | 'target_team_id'
    >,
    entries: AttendanceSessionMember[],
    teamMap: Map<string, string>,
): AttendanceSession => ({
    id: row.id,
    title: row.title,
    sessionCode: row.session_code,
    pointRuleId: row.point_rule_id,
    pointRuleName: null,
    seasonId: row.season_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    note: row.note,
    isActive: row.is_active,
    isHidden: row.is_hidden ?? false,
    createdAt: row.created_at,
    targetGroupType: (row.target_group_type as AttendanceTargetGroup) ?? 'all',
    targetTeamId: row.target_team_id ?? null,
    targetGroupLabel: getAttendanceTargetGroupLabel(
        (row.target_group_type as AttendanceTargetGroup) ?? 'all',
        row.target_team_id,
        teamMap,
    ),
    memberCount: entries.length,
    statusCounts: buildAttendanceStatusCounts(entries),
    entries,
});

const fallback = <T>(task: string, getLocalValue: () => T, error?: unknown): T => {
    if (error) {
        reportDataFallback(task, error);
        console.warn(`[data] ${task} failed, using local fallback instead.`, error);
    }

    return getLocalValue();
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
    conditionSummary?: string;
    groupName?: string;
}

interface ActivityGroupInput {
    name: string;
    sortOrder: number;
}

interface ActivityEntryOptions {
    occurredAt?: string;
    reason?: string;
    evidenceUrl?: string;
}

const createLocalActivityEntryRecord = (
    memberId: string,
    categoryId: string,
    note?: string | null,
    options?: ActivityEntryOptions,
) => {
    const trimmedNote = note?.trim() || null;
    const occurredAt = options?.occurredAt ?? new Date().toISOString();
    const evidenceUrl = options?.evidenceUrl?.trim() || null;
    const recordId = createLocalId('record');
    const category = localState.categories.find((item) => item.id === categoryId);
    const member = localState.members.find((item) => item.id === memberId);

    if (!category || !member) {
        throw new Error('활동 기록에 필요한 멤버 또는 규칙을 찾지 못했습니다.');
    }

    member.score += category.pointValue;
    localState.logs.push({
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
    return recordId;
};

const reverseLocalActivityEntryRecord = (recordId: string, note?: string | null) => {
    const trimmedNote = note?.trim() || null;
    const originalLog = localState.logs.find((log) => log.recordId === recordId && !log.reversalOf);
    const hasReversal = localState.logs.some((log) => log.reversalOf === originalLog?.id);

    if (!originalLog || hasReversal) {
        return;
    }

    const category = localState.categories.find((item) => item.id === originalLog.categoryId);
    const member = localState.members.find((item) => item.id === originalLog.memberId);

    if (member) {
        member.score -= originalLog.pointDelta;
    }

    const reversalTimestamp = new Date().toISOString();

    localState.logs = localState.logs.map((log) =>
        log.recordId === recordId
            ? {
                ...log,
                recordStatus: 'reversed',
            }
            : log,
    );

    localState.logs.push({
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

export const createActivityEntryRecord = async (
    memberId: string,
    categoryId: string,
    note?: string,
    options?: ActivityEntryOptions,
): Promise<string> => {
    const trimmedNote = note?.trim() || null;
    const occurredAt = options?.occurredAt ?? new Date().toISOString();
    const evidenceUrl = options?.evidenceUrl?.trim() || null;

    if (!isSupabaseConfigured) {
        return createLocalActivityEntryRecord(memberId, categoryId, trimmedNote, options);
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('create_activity_entry', {
        p_member_id: memberId,
        p_point_rule_id: categoryId,
        p_note: trimmedNote ?? undefined,
        p_reason: options?.reason ?? trimmedNote ?? '수동 활동 기록',
        p_occurred_at: occurredAt,
        p_evidence_url: evidenceUrl ?? undefined,
    });

    if (error) {
        throw error;
    }

    return data as string;
};

export const createBatchActivityEntryRecords = async (
    memberIds: string[],
    categoryId: string,
    note?: string,
    options?: ActivityEntryOptions,
): Promise<string[]> => {
    const trimmedNote = note?.trim() || null;
    const occurredAt = options?.occurredAt ?? new Date().toISOString();
    const evidenceUrl = options?.evidenceUrl?.trim() || null;

    if (!isSupabaseConfigured) {
        const recordIds: string[] = [];
        for (const memberId of memberIds) {
            recordIds.push(await createActivityEntryRecord(memberId, categoryId, trimmedNote ?? undefined, {
                ...options,
                evidenceUrl: evidenceUrl ?? undefined,
            }));
        }
        return recordIds;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('create_batch_activity_entries', {
        p_member_ids: memberIds,
        p_point_rule_id: categoryId,
        p_note: trimmedNote ?? undefined,
        p_reason: options?.reason ?? trimmedNote ?? '수동 일괄 활동 기록',
        p_occurred_at: occurredAt,
        p_evidence_url: evidenceUrl ?? undefined,
    });

    if (error) {
        throw error;
    }

    return (data as string[]) ?? [];
};

export const reverseActivityEntryRecord = async (recordId: string, note?: string): Promise<string | null> => {
    const trimmedNote = note?.trim() || null;

    if (!isSupabaseConfigured) {
        reverseLocalActivityEntryRecord(recordId, trimmedNote);
        return recordId;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('reverse_activity_entry', {
        p_record_id: recordId,
        p_note: trimmedNote ?? undefined,
    });

    if (error) {
        throw error;
    }

    return (data as string) ?? null;
};

export const getMembers = async (options?: { includeLoginEmail?: boolean; includeHidden?: boolean }): Promise<Member[]> => {
    const includeLoginEmail = options?.includeLoginEmail ?? false;
    const includeHidden = options?.includeHidden ?? false;
    const cacheKey = `members:${includeLoginEmail ? 'email' : 'public'}:${includeHidden ? 'all' : 'visible'}`;

    if (!isSupabaseConfigured) {
        return sortMembers(
            localState.members
                .filter((member) => includeHidden || member.isVisible !== false)
                .map((member) => ({
                    ...member,
                    teamIds: member.teamIds ?? getLocalMemberTeamIds(member.id),
                    teamNames: member.teamNames ?? getLocalMemberTeamNames(member.id),
                    loginEmail: includeLoginEmail ? member.loginEmail ?? null : null,
                })),
        );
    }

    try {
        const client = getSupabaseClient();
        const memberQuery = includeLoginEmail
            ? client
                .from('members')
                .select('id, name, login_email, role_id, team_id, status, joined_at, is_approved, is_visible, auth_user_id, auth_provisioned_at, password_reset_required, email_delivery_failed')
            : client
                .from('members')
                .select('id, name, role_id, team_id, status, joined_at, is_approved, is_visible, auth_user_id, auth_provisioned_at, password_reset_required, email_delivery_failed');

        if (!includeHidden) {
            memberQuery.eq('is_visible', true);
        }

        const loadMemberData = async () => Promise.all([
            client.from('member_score_summary').select('id, name, is_approved, score'),
            memberQuery,
            client.from('roles').select('id, name'),
            client.from('teams').select('id, name'),
            client.from('member_team_links').select('member_id, team_id'),
        ]);

        let results: Awaited<ReturnType<typeof loadMemberData>> | null = null;

        try {
            results = await loadMemberData();
        } catch (error) {
            if (!isNetworkFetchError(error)) {
                throw error;
            }

            for (const delay of [300, 900]) {
                await sleep(delay);
                try {
                    results = await loadMemberData();
                    break;
                } catch (retryError) {
                    if (!isNetworkFetchError(retryError)) {
                        throw retryError;
                    }
                }
            }

            if (!results) {
                throw error;
            }
        }

        const [summaryResult, memberResult, roleResult, teamResult, memberTeamLinkResult] = results;

        if (summaryResult.error) throw summaryResult.error;
        if (memberResult.error) throw memberResult.error;
        if (roleResult.error) throw roleResult.error;
        if (teamResult.error) throw teamResult.error;
        if (memberTeamLinkResult.error) throw memberTeamLinkResult.error;

        const summaryRows = (summaryResult.data ?? []) as MemberScoreSummaryRow[];
        const memberRows = (memberResult.data ?? []) as Array<
            Pick<MemberRow, 'id' | 'name' | 'role_id' | 'team_id' | 'status' | 'joined_at' | 'is_approved' | 'is_visible' | 'auth_user_id' | 'auth_provisioned_at' | 'password_reset_required' | 'email_delivery_failed'> & {
                login_email?: string | null;
            }
        >;
        const roleRows = (roleResult.data ?? []) as RoleRow[];
        const teamRows = (teamResult.data ?? []) as TeamRow[];
        const memberTeamLinkRows = (memberTeamLinkResult.data ?? []) as Pick<MemberTeamLinkRow, 'member_id' | 'team_id'>[];

        const summaryMap = new Map<string, MemberScoreSummaryRow>(
            summaryRows.flatMap((summary) => (summary.id ? [[summary.id, summary] as const] : [])),
        );
        const roleMap = new Map<string, string>(roleRows.map((role) => [role.id, role.name]));
        const teamMap = new Map<string, string>(teamRows.map((team) => [team.id, team.name]));
        const memberTeamMap = new Map<string, string[]>();

        memberTeamLinkRows.forEach((link) => {
            const current = memberTeamMap.get(link.member_id) ?? [];
            memberTeamMap.set(link.member_id, dedupeTeamIds([...current, link.team_id]));
        });

        const members = sortMembers(
            memberRows.map((member) => {
                const summary = summaryMap.get(member.id);
                const teamIds = dedupeTeamIds([member.team_id, ...(memberTeamMap.get(member.id) ?? [])]);
                const teamNames = teamIds
                    .map((teamId) => teamMap.get(teamId) ?? null)
                    .filter((teamName): teamName is string => Boolean(teamName));

                return {
                    id: member.id,
                    name: member.name,
                    score: summary?.score ?? 0,
                    loginEmail: includeLoginEmail ? member.login_email ?? null : null,
                    authUserId: member.auth_user_id ?? null,
                    authProvisionedAt: member.auth_provisioned_at ?? null,
                    passwordResetRequired: member.password_reset_required ?? false,
                    emailDeliveryFailed: member.email_delivery_failed ?? false,
                    isApproved: member.is_approved,
                    roleId: member.role_id,
                    roleName: member.role_id ? roleMap.get(member.role_id) ?? null : null,
                    teamId: member.team_id ?? teamIds[0] ?? null,
                    teamName: member.team_id ? teamMap.get(member.team_id) ?? null : teamNames[0] ?? null,
                    teamIds,
                    teamNames,
                    status: member.status,
                    joinedAt: member.joined_at,
                    isVisible: member.is_visible,
                };
            }),
        );
        cachedMemberResults.set(cacheKey, members);
        return members;
    } catch (error) {
        if (isSupabaseConfigured && isNetworkFetchError(error)) {
            const cached = cachedMemberResults.get(cacheKey);
            if (cached) {
                reportDataFallback('getMembers', `${getErrorMessage(error)} · 마지막으로 불러온 멤버 목록을 표시합니다.`);
                console.warn('[data] getMembers failed after retry, returning the last successful cached member list.', error);
                return cached.map((member) => ({ ...member }));
            }

            reportDataFallback('getMembers', error);
            console.warn('[data] getMembers failed after retry, returning an empty list instead of local fallback.', error);
            return [];
        }

        return fallback(
            'getMembers',
            () =>
                sortMembers(
                    localState.members
                        .filter((member) => includeHidden || member.isVisible !== false)
                        .map((member) => ({
                            ...member,
                            loginEmail: includeLoginEmail ? member.loginEmail ?? null : null,
                        })),
                ),
            error,
        );
    }
};

export const isRegisteredLoginEmail = async (email: string): Promise<boolean> => {
    const normalizedEmail = normalizeLoginEmail(email);

    if (!normalizedEmail) {
        return false;
    }

    if (!isSupabaseConfigured) {
        return localState.members.some((member) => normalizeLoginEmail(member.loginEmail) === normalizedEmail);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('is_registered_login_email', {
            p_email: normalizedEmail,
        });

        if (error) {
            throw error;
        }

        return Boolean(data);
    } catch (error) {
        console.warn('[data] isRegisteredLoginEmail failed.', error);
        throw new Error('로그인 이메일 확인에 실패했습니다. 운영진에게 인증 설정을 확인해 달라고 요청해 주세요.');
    }
};

export const provisionMemberPasswordAuth = async (memberId: string): Promise<{
    email: string;
    memberName: string;
    isExistingAccount: boolean;
    inviteSent: boolean;
    emailDeliveryFailed: boolean;
    actionLink?: string;
    linkExpiresInHours?: number;
}> => {
    const member = localState.members.find((entry) => entry.id === memberId) ?? null;

    if (!isSupabaseConfigured) {
        if (!member?.loginEmail) {
            throw new Error('로그인 이메일이 등록된 멤버만 계정을 발급할 수 있습니다.');
        }

        const provisionedAt = new Date().toISOString();

        localState.members = localState.members.map((entry) =>
            entry.id === memberId
                ? {
                    ...entry,
                    authUserId: entry.authUserId ?? createLocalId('auth'),
                    authProvisionedAt: provisionedAt,
                    passwordResetRequired: true,
                    isApproved: true,
                }
                : entry,
        );

        return {
            email: member.loginEmail,
            memberName: member.name,
            isExistingAccount: Boolean(member.authUserId),
            inviteSent: false,
            emailDeliveryFailed: false,
        };
    }

    const client = getSupabaseClient();
    const {
        data: { session },
    } = await client.auth.getSession();

    if (!session?.access_token) {
        throw new Error('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 계정을 발급해 주세요.');
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase 함수 엔드포인트 설정이 비어 있습니다.');
    }

    const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

    const response = await fetch(`${supabaseUrl}/functions/v1/provision-member-auth`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memberId, redirectTo }),
    });

    const payload = await response
        .json()
        .catch(async () => ({ error: await response.text().catch(() => '') }));

    if (!response.ok) {
        const functionMessage =
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                ? payload.error
                : null;

        throw new Error(functionMessage || '계정을 발급하지 못했습니다.');
    }

    const data = payload as Record<string, unknown>;

    return {
        email: String(data?.email ?? ''),
        memberName: String(data?.memberName ?? ''),
        isExistingAccount: Boolean(data?.isExistingAccount),
        inviteSent: Boolean(data?.inviteSent),
        emailDeliveryFailed: Boolean(data?.emailDeliveryFailed),
        actionLink: typeof data?.actionLink === 'string' && data.actionLink.length > 0 ? data.actionLink : undefined,
        linkExpiresInHours:
            typeof data?.linkExpiresInHours === 'number' && Number.isFinite(data.linkExpiresInHours)
                ? data.linkExpiresInHours
                : undefined,
    };
};

export const completeMyPasswordSetup = async (): Promise<void> => {
    if (!isSupabaseConfigured) {
        return;
    }

    const client = getSupabaseClient();
    const { error } = await client.rpc('complete_my_password_setup');

    if (error) {
        throw error;
    }
};

export const getActivityGroups = async (): Promise<ActivityGroup[]> => {
    if (!isSupabaseConfigured) {
        return [...localState.activityGroups]
            .filter((group) => group.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('activity_groups')
            .select('code, name, sort_order, is_active')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Pick<ActivityGroupRow, 'code' | 'name' | 'sort_order' | 'is_active'>[]).map((group) => ({
            code: group.code,
            name: group.name,
            sortOrder: group.sort_order,
            isActive: group.is_active,
        }));
    } catch (error) {
        return fallback(
            'getActivityGroups',
            () =>
                [...localState.activityGroups]
                    .filter((group) => group.isActive)
                    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
            error,
        );
    }
};

export const addActivityGroup = async ({ name, sortOrder }: ActivityGroupInput): Promise<ActivityGroup> => {
    const normalizedName = name.trim();
    const nextSortOrder = Number.isFinite(sortOrder) ? sortOrder : 100;

    if (!normalizedName) {
        throw new Error('활동 분류 이름을 입력해 주세요.');
    }

    const code = createActivityGroupCode(normalizedName);

    if (!isSupabaseConfigured) {
        const nextGroup: ActivityGroup = {
            code,
            name: normalizedName,
            sortOrder: nextSortOrder,
            isActive: true,
        };
        localState.activityGroups.push(nextGroup);
        return nextGroup;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('activity_groups')
        .insert({
            code,
            name: normalizedName,
            sort_order: nextSortOrder,
            is_active: true,
        })
        .select('code, name, sort_order, is_active')
        .single();

    if (error) {
        throw error;
    }

    return {
        code: data.code,
        name: data.name,
        sortOrder: data.sort_order,
        isActive: data.is_active,
    };
};

export const updateActivityGroup = async (
    code: string,
    { name, sortOrder }: ActivityGroupInput,
): Promise<ActivityGroup> => {
    const normalizedName = name.trim();
    const nextSortOrder = Number.isFinite(sortOrder) ? sortOrder : 100;

    if (!normalizedName) {
        throw new Error('활동 분류 이름을 입력해 주세요.');
    }

    if (!isSupabaseConfigured) {
        const nextGroup: ActivityGroup = {
            code,
            name: normalizedName,
            sortOrder: nextSortOrder,
            isActive: true,
        };
        localState.activityGroups = localState.activityGroups.map((group) => (group.code === code ? nextGroup : group));
        return nextGroup;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('activity_groups')
        .update({
            name: normalizedName,
            sort_order: nextSortOrder,
        })
        .eq('code', code)
        .select('code, name, sort_order, is_active')
        .single();

    if (error) {
        throw error;
    }

    return {
        code: data.code,
        name: data.name,
        sortOrder: data.sort_order,
        isActive: data.is_active,
    };
};

export const deleteActivityGroup = async (code: string): Promise<void> => {
    const isUsedLocally = localState.categories.some((category) => category.groupName === code);
    if (!isSupabaseConfigured) {
        if (isUsedLocally) {
            throw new Error('이 분류를 사용하는 규칙이 있어 삭제할 수 없습니다.');
        }
        localState.activityGroups = localState.activityGroups.filter((group) => group.code !== code);
        return;
    }

    const client = getSupabaseClient();
    const { count, error: usageError } = await client
        .from('activity_types')
        .select('id', { count: 'exact', head: true })
        .eq('group_name', code);

    if (usageError) {
        throw usageError;
    }

    if ((count ?? 0) > 0) {
        throw new Error('이 분류를 사용하는 규칙이 있어 삭제할 수 없습니다.');
    }

    const { error } = await client.from('activity_groups').delete().eq('code', code);
    if (error) {
        throw error;
    }
};

export const getCategories = async (): Promise<Category[]> => {
    if (!isSupabaseConfigured) {
        return localState.categories
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
            id: category.id!,
            activityTypeId: category.activity_type_id!,
            categoryName: category.category_name!,
            groupName: category.group_name!,
            pointValue: category.point_value!,
            penaltyPoint: category.penalty_point ?? undefined,
            conditionSummary: getConditionSummary(category.condition_json),
            conditionJson: parseJsonObject(category.condition_json),
            isActive: category.is_active ?? undefined,
            version: category.version!,
        }));
    } catch (error) {
        return fallback(
            'getCategories',
            () =>
                localState.categories
                    .filter((category) => category.isActive !== false)
                    .sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
            error,
        );
    }
};

export const getLogs = async (cachedMembers?: Member[]): Promise<ActivityLog[]> => {
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
            cachedMembers ?? getMembers(),
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
    authUserId: row.auth_user_id,
    authProvisionedAt: row.auth_provisioned_at,
    passwordResetRequired: row.password_reset_required,
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

        return ((data ?? []) as MyMemberBadgeRow[]).map(mapMemberBadgeRow);
    } catch (error) {
        return fallback('getMyMemberBadges', () => getLocalMemberBadges(memberId), error);
    }
};

export const getBadges = async (options?: { includeInactive?: boolean }): Promise<Badge[]> => {
    const includeInactive = options?.includeInactive ?? false;

    if (!isSupabaseConfigured) {
        return [...localState.badges]
            .filter((badge) => includeInactive || badge.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
    }

    try {
        const client = getSupabaseClient();
        let query = client
            .from('badges')
            .select('id, code, name, description, icon_key, image_url, tone, evaluation_scope, criteria_json, sort_order, is_active')
            .order('sort_order', { ascending: true });

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return ((data ?? []) as Array<
            Pick<BadgeRow, 'id' | 'code' | 'name' | 'description' | 'icon_key' | 'image_url' | 'tone' | 'evaluation_scope' | 'criteria_json' | 'sort_order' | 'is_active'>
        >).map(mapBadgeRow);
    } catch (error) {
        return fallback(
            'getBadges',
            () => [...localState.badges]
                .filter((badge) => includeInactive || badge.isActive !== false)
                .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name)),
            error,
        );
    }
};

export const getMemberBadges = async (): Promise<MemberBadge[]> => {
    if (!isSupabaseConfigured) {
        return getAllLocalMemberBadges();
    }

    try {
        const client = getSupabaseClient();
        const [memberBadgeResult, badgeResult] = await Promise.all([
            client
                .from('member_badges')
                .select('id, member_id, badge_id, awarded_at, season_id')
                .order('awarded_at', { ascending: false }),
            client
                .from('badges')
                .select('id, code, name, description, icon_key, image_url, tone, evaluation_scope, criteria_json, sort_order, is_active'),
        ]);

        if (memberBadgeResult.error) {
            throw memberBadgeResult.error;
        }

        if (badgeResult.error) {
            throw badgeResult.error;
        }

        const badgeRows = (badgeResult.data ?? []) as Array<
            Pick<Database['public']['Tables']['badges']['Row'], 'id' | 'code' | 'name' | 'description' | 'icon_key' | 'image_url' | 'tone' | 'evaluation_scope' | 'criteria_json' | 'sort_order' | 'is_active'>
        >;
        const memberBadgeRows = (memberBadgeResult.data ?? []) as Array<
            Pick<Database['public']['Tables']['member_badges']['Row'], 'id' | 'member_id' | 'badge_id' | 'awarded_at' | 'season_id'>
        >;

        const badgeMap = new Map(badgeRows.map((badge) => [badge.id, badge]));

        return memberBadgeRows.flatMap((entry) => {
            const badge = badgeMap.get(entry.badge_id);
            if (!badge) {
                return [];
            }

            const mappedBadge = mapBadgeRow(badge);

            return [{
                id: entry.id,
                memberId: entry.member_id,
                badgeId: entry.badge_id,
                badgeCode: mappedBadge.code,
                badgeName: mappedBadge.name,
                badgeDescription: mappedBadge.description,
                iconKey: mappedBadge.iconKey,
                imageUrl: mappedBadge.imageUrl,
                tone: mappedBadge.tone,
                evaluationScope: mappedBadge.evaluationScope,
                criteria: mappedBadge.criteria,
                awardedAt: entry.awarded_at,
                seasonId: entry.season_id,
            }];
        });
    } catch (error) {
        return fallback('getMemberBadges', () => getAllLocalMemberBadges(), error);
    }
};

export const addBadge = async (input: BadgeUpsertInput): Promise<Badge> => {
    const normalizedInput = normalizeBadgeInput(input);

    if (!isSupabaseConfigured) {
        const badge: Badge = {
            id: createLocalId('badge'),
            ...normalizedInput,
        };
        localState.badges = [...localState.badges, badge].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
        refreshLocalMemberBadgesForMembers(localState.members.map((member) => member.id));
        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'badge',
            entityId: badge.id,
            action: 'created',
            summary: `${badge.name} 배지 등록`,
            diff: {
                summary: `${badge.name} 배지 등록`,
                badgeId: badge.id,
                badgeCode: badge.code,
                criteria: badge.criteria,
                criteriaSummary: getBadgeCriteriaSummary(badge.criteria, badge.evaluationScope),
            },
        });
        return badge;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('badges')
        .insert({
            code: normalizedInput.code,
            name: normalizedInput.name,
            description: normalizedInput.description,
            icon_key: normalizedInput.iconKey,
            image_url: normalizedInput.imageUrl ?? null,
            tone: normalizedInput.tone,
            evaluation_scope: normalizedInput.evaluationScope,
            criteria_json: normalizedInput.criteria as unknown as Json,
            sort_order: normalizedInput.sortOrder,
            is_active: normalizedInput.isActive,
        })
        .select('id, code, name, description, icon_key, image_url, tone, evaluation_scope, criteria_json, sort_order, is_active')
        .single();

    if (error) {
        throw error;
    }

    const { error: refreshError } = await client.rpc('refresh_all_member_badges');
    if (refreshError) {
        throw refreshError;
    }
    return mapBadgeRow(data);
};

export const updateBadge = async (id: string, input: BadgeUpsertInput): Promise<Badge> => {
    const normalizedInput = normalizeBadgeInput(input);

    if (!isSupabaseConfigured) {
        const existingBadge = localState.badges.find((badge) => badge.id === id);
        if (!existingBadge) {
            throw new Error('수정할 배지를 찾지 못했습니다.');
        }

        const nextBadge: Badge = {
            ...existingBadge,
            ...normalizedInput,
        };
        localState.badges = localState.badges
            .map((badge) => (badge.id === id ? nextBadge : badge))
            .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
        refreshLocalMemberBadgesForMembers(localState.members.map((member) => member.id));
        return nextBadge;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('badges')
        .update({
            code: normalizedInput.code,
            name: normalizedInput.name,
            description: normalizedInput.description,
            icon_key: normalizedInput.iconKey,
            image_url: normalizedInput.imageUrl ?? null,
            tone: normalizedInput.tone,
            evaluation_scope: normalizedInput.evaluationScope,
            criteria_json: normalizedInput.criteria as unknown as Json,
            sort_order: normalizedInput.sortOrder,
            is_active: normalizedInput.isActive,
        })
        .eq('id', id)
        .select('id, code, name, description, icon_key, image_url, tone, evaluation_scope, criteria_json, sort_order, is_active')
        .single();

    if (error) {
        throw error;
    }

    const { error: refreshError } = await client.rpc('refresh_all_member_badges');
    if (refreshError) {
        throw refreshError;
    }
    return mapBadgeRow(data);
};

export const deleteBadge = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.badges = localState.badges.filter((badge) => badge.id !== id);
        for (let index = localState.memberBadges.length - 1; index >= 0; index -= 1) {
            if (localState.memberBadges[index].badgeId === id) {
                localState.memberBadges.splice(index, 1);
            }
        }
        return;
    }

    const client = getSupabaseClient();
    const { error } = await client.from('badges').delete().eq('id', id);

    if (error) {
        throw error;
    }

    const { error: refreshError } = await client.rpc('refresh_all_member_badges');
    if (refreshError) {
        throw refreshError;
    }
};

export const getAuditLogs = async (options?: GetAuditLogsOptions): Promise<AuditLogEntry[]> => {
    const entityType = options?.entityType ?? null;
    const entityId = options?.entityId ?? null;
    const limit = options?.limit ?? 20;

    if (!isSupabaseConfigured) {
        return sortAuditLogs(
            localState.auditLogs.filter((entry) => (!entityType || entry.entityType === entityType) && (!entityId || entry.entityId === entityId)),
        ).slice(0, limit);
    }

    try {
        const client = getSupabaseClient();
        let auditQuery = client
            .from('audit_logs')
            .select('id, actor_id, entity_type, entity_id, action, diff_json, created_at')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (entityType) {
            auditQuery = auditQuery.eq('entity_type', entityType);
        }

        if (entityId) {
            auditQuery = auditQuery.eq('entity_id', entityId);
        }

        const [auditResult, actorResult] = await Promise.all([
            auditQuery,
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
        return fallback(
            'getAuditLogs',
            () =>
                sortAuditLogs(
                    localState.auditLogs.filter((entry) => (!entityType || entry.entityType === entityType) && (!entityId || entry.entityId === entityId)),
                ).slice(0, limit),
            error,
        );
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
            authUserId: null,
            authProvisionedAt: null,
            passwordResetRequired: false,
            isApproved: true,
            roleName: null,
            teamName: null,
            teamIds: [],
            teamNames: [],
            status: 'active',
            joinedAt: new Date().toISOString().slice(0, 10),
        };
        localState.members.push(newMember);
        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'member',
            entityId: newMember.id,
            action: 'created',
            summary: `${newMember.name} 멤버 등록`,
            diff: {
                summary: `${newMember.name} 멤버 등록`,
                memberName: newMember.name,
                changes: {
                    loginEmail: { to: normalizedLoginEmail },
                    status: { to: newMember.status },
                },
            },
        });
        return newMember;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('members')
            .insert({
                name,
                login_email: normalizedLoginEmail,
                is_approved: true,
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
            authUserId: null,
            authProvisionedAt: null,
            passwordResetRequired: false,
            isApproved: data.is_approved,
            roleId: null,
            roleName: null,
            teamId: null,
            teamName: null,
            teamIds: [],
            teamNames: [],
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
            authUserId: null,
            authProvisionedAt: null,
            passwordResetRequired: false,
            isApproved: true,
            roleId: null,
            roleName: null,
            teamId: null,
            teamName: null,
            status: 'active',
            joinedAt: new Date().toISOString().slice(0, 10),
            isVisible: true,
        };
        localState.members.push(newMember);
        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'member',
            entityId: newMember.id,
            action: 'created',
            summary: `${newMember.name} 멤버 등록`,
            diff: {
                summary: `${newMember.name} 멤버 등록`,
                memberName: newMember.name,
                changes: {
                    loginEmail: { to: normalizedLoginEmail },
                    status: { to: newMember.status },
                },
            },
        });
        return fallback('addMember', () => newMember, error);
    }
};

export const getCurrentSeason = async (): Promise<SeasonSummary | null> => {
    if (!isSupabaseConfigured) {
        return getLocalCurrentSeasonSummary();
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
        return fallback('getCurrentSeason', () => localState.currentSeason, error);
    }
};

export const getRoles = async (): Promise<RoleSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localState.roles].sort((a, b) => a.rankOrder - b.rankOrder);
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
        return fallback('getRoles', () => [...localState.roles].sort((a, b) => a.rankOrder - b.rankOrder), error);
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
        localState.roles.push(role);
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
        localState.roles.push(role);
        return fallback('addRole', () => role, error);
    }
};

export const updateRole = async (
    id: string,
    {
        name,
        permissionScope,
        rankOrder,
    }: {
        name: string;
        permissionScope: string;
        rankOrder: number;
    },
): Promise<RoleSummary> => {
    if (!isSupabaseConfigured) {
        const roleIndex = localState.roles.findIndex((role) => role.id === id);
        const previousRole = roleIndex >= 0 ? localState.roles[roleIndex] : null;

        if (roleIndex >= 0) {
            localState.roles.splice(roleIndex, 1, {
                ...localState.roles[roleIndex],
                name,
                permissionScope,
                rankOrder,
            });
        }

        if (previousRole && previousRole.name !== name) {
            localState.members = localState.members.map((member) =>
                member.roleId === id
                    ? {
                        ...member,
                        roleName: name,
                    }
                    : member,
            );
        }

        const updated = localState.roles.find((role) => role.id === id);
        if (!updated) {
            throw new Error('수정할 역할을 찾지 못했습니다.');
        }

        return updated;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('roles')
            .update({
                name,
                permission_scope: permissionScope,
                rank_order: rankOrder,
            })
            .eq('id', id)
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
        return fallback('updateRole', () => {
            const role = localState.roles.find((item) => item.id === id);
            if (!role) {
                throw new Error('수정할 역할을 찾지 못했습니다.');
            }
            return role;
        }, error);
    }
};

export const deleteRole = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        const roleIndex = localState.roles.findIndex((role) => role.id === id);
        if (roleIndex >= 0) {
            localState.roles.splice(roleIndex, 1);
        }
        localState.members = localState.members.map((member) =>
            member.roleId === id
                ? {
                    ...member,
                    roleId: null,
                    roleName: null,
                }
                : member,
        );
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.from('roles').delete().eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        fallback('deleteRole', () => undefined, error);
    }
};

export const getTeams = async (): Promise<TeamSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localState.teams].sort((a, b) => a.name.localeCompare(b.name));
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
        return fallback('getTeams', () => [...localState.teams].sort((a, b) => a.name.localeCompare(b.name)), error);
    }
};

export const getAnnouncements = async (): Promise<AnnouncementItem[]> => {
    if (!isSupabaseConfigured) {
        return sortAnnouncements(localState.announcements.filter((item) => item.isActive));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('announcements')
            .select('id, title, body, starts_at, ends_at, is_pinned, is_active, created_at')
            .eq('is_active', true)
            .order('is_pinned', { ascending: false })
            .order('starts_at', { ascending: false });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Array<
            Pick<Database['public']['Tables']['announcements']['Row'], 'id' | 'title' | 'body' | 'starts_at' | 'ends_at' | 'is_pinned' | 'is_active' | 'created_at'>
        >).map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            startAt: item.starts_at,
            endAt: item.ends_at,
            isPinned: item.is_pinned,
            isActive: item.is_active,
            createdAt: item.created_at,
        }));
    } catch (error) {
        return fallback('getAnnouncements', () => sortAnnouncements(localState.announcements.filter((item) => item.isActive)), error);
    }
};

const mapSiteBanner = (
    row: Pick<SiteBannerRow, 'id' | 'title' | 'image_url' | 'display_order' | 'is_active' | 'created_at'>,
): SiteBanner => ({
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
});

export const getSiteBanners = async (): Promise<SiteBanner[]> => {
    if (!isSupabaseConfigured) {
        return sortSiteBanners(localState.siteBanners.filter((item) => item.isActive));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('site_banners')
            .select('id, title, image_url, display_order, is_active, created_at')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        return sortSiteBanners(
            ((data ?? []) as Array<
                Pick<SiteBannerRow, 'id' | 'title' | 'image_url' | 'display_order' | 'is_active' | 'created_at'>
            >).map(mapSiteBanner),
        );
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['site_banners'])) {
            console.warn('[data] site_banners table is unavailable in Supabase; falling back to the bundled default banner.');
            return [];
        }

        return fallback('getSiteBanners', () => sortSiteBanners(localState.siteBanners.filter((item) => item.isActive)), error);
    }
};

export const addSiteBanner = async (input: { title?: string | null; imageUrl: string }): Promise<SiteBanner> => {
    const imageUrl = input.imageUrl.trim();
    const title = input.title?.trim() || null;

    if (!imageUrl) {
        throw new Error('배너 이미지 링크 또는 파일을 선택해 주세요.');
    }

    if (!isSupabaseConfigured) {
        const nextDisplayOrder = sortSiteBanners(localState.siteBanners).at(-1)?.displayOrder ?? 0;
        const item: SiteBanner = {
            id: createLocalId('banner'),
            title,
            imageUrl,
            displayOrder: nextDisplayOrder + 1,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        localState.siteBanners.push(item);
        notifySiteBannerListeners();
        return item;
    }

    try {
        const client = getSupabaseClient();
        const currentBanners = await getSiteBanners();
        const nextDisplayOrder = currentBanners.at(-1)?.displayOrder ?? 0;
        const { data, error } = await client
            .from('site_banners')
            .insert({
                title,
                image_url: imageUrl,
                display_order: nextDisplayOrder + 1,
                is_active: true,
            })
            .select('id, title, image_url, display_order, is_active, created_at')
            .single();

        if (error || !data) {
            throw error ?? new Error('배너를 추가하지 못했습니다.');
        }

        notifySiteBannerListeners();
        return mapSiteBanner(data);
    } catch (error) {
        const nextDisplayOrder = sortSiteBanners(localState.siteBanners).at(-1)?.displayOrder ?? 0;
        const item: SiteBanner = {
            id: createLocalId('banner'),
            title,
            imageUrl,
            displayOrder: nextDisplayOrder + 1,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        localState.siteBanners.push(item);
        notifySiteBannerListeners();
        return fallback('addSiteBanner', () => item, error);
    }
};

export const moveSiteBanner = async (id: string, direction: 'up' | 'down'): Promise<void> => {
    const moveLocal = () => {
        const sorted = sortSiteBanners(localState.siteBanners);
        const currentIndex = sorted.findIndex((item) => item.id === id);
        if (currentIndex === -1) {
            return;
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= sorted.length) {
            return;
        }

        const current = sorted[currentIndex];
        const target = sorted[targetIndex];
        [current.displayOrder, target.displayOrder] = [target.displayOrder, current.displayOrder];
        localState.siteBanners = sortSiteBanners(sorted);
        notifySiteBannerListeners();
    };

    if (!isSupabaseConfigured) {
        moveLocal();
        return;
    }

    try {
        const banners = await getSiteBanners();
        const currentIndex = banners.findIndex((item) => item.id === id);
        if (currentIndex === -1) {
            return;
        }

        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= banners.length) {
            return;
        }

        const current = banners[currentIndex];
        const target = banners[targetIndex];
        const client = getSupabaseClient();
        const { error } = await client.rpc('swap_banner_display_order', {
            p_first_banner_id: current.id,
            p_second_banner_id: target.id,
        });

        if (error) {
            throw error;
        }

        notifySiteBannerListeners();
    } catch (error) {
        moveLocal();
        fallback('moveSiteBanner', () => undefined, error);
    }
};

export const deleteSiteBanner = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.siteBanners = localState.siteBanners.filter((item) => item.id !== id);
        notifySiteBannerListeners();
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.from('site_banners').update({ is_active: false }).eq('id', id);
        if (error) {
            throw error;
        }
        notifySiteBannerListeners();
    } catch (error) {
        localState.siteBanners = localState.siteBanners.filter((item) => item.id !== id);
        notifySiteBannerListeners();
        fallback('deleteSiteBanner', () => undefined, error);
    }
};

export const addAnnouncement = async (input: {
    title: string;
    body: string;
    startAt?: string | null;
    endAt?: string | null;
    isPinned?: boolean;
}): Promise<AnnouncementItem> => {
    const payload = {
        title: input.title.trim(),
        body: input.body.trim(),
        startAt: input.startAt ?? null,
        endAt: input.endAt ?? null,
        isPinned: input.isPinned ?? false,
    };

    if (!isSupabaseConfigured) {
        const item: AnnouncementItem = {
            id: createLocalId('notice'),
            title: payload.title,
            body: payload.body,
            startAt: payload.startAt,
            endAt: payload.endAt,
            isPinned: payload.isPinned,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        localState.announcements.push(item);
        return item;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('announcements')
            .insert({
                title: payload.title,
                body: payload.body,
                starts_at: payload.startAt,
                ends_at: payload.endAt,
                is_pinned: payload.isPinned,
                is_active: true,
            })
            .select('id, title, body, starts_at, ends_at, is_pinned, is_active, created_at')
            .single();

        if (error) {
            throw error;
        }

        const result = {
            id: data.id,
            title: data.title,
            body: data.body,
            startAt: data.starts_at,
            endAt: data.ends_at,
            isPinned: data.is_pinned,
            isActive: data.is_active,
            createdAt: data.created_at,
        };
        sendPushNotification('새 공지', data.title);
        return result;
    } catch (error) {
        const item: AnnouncementItem = {
            id: createLocalId('notice'),
            title: payload.title,
            body: payload.body,
            startAt: payload.startAt,
            endAt: payload.endAt,
            isPinned: payload.isPinned,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        localState.announcements.push(item);
        return fallback('addAnnouncement', () => item, error);
    }
};

export const deleteAnnouncement = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.announcements = localState.announcements.filter((item) => item.id !== id);
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.from('announcements').update({ is_active: false }).eq('id', id);
        if (error) {
            throw error;
        }
    } catch (error) {
        localState.announcements = localState.announcements.filter((item) => item.id !== id);
        fallback('deleteAnnouncement', () => undefined, error);
    }
};

export const getScheduleEvents = async (): Promise<ScheduleEventItem[]> => {
    if (!isSupabaseConfigured) {
        return sortScheduleEvents(localState.scheduleEvents.filter((item) => item.isActive));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('schedule_events')
            .select('id, title, description, location, start_at, end_at, season_id, is_active, created_at')
            .eq('is_active', true)
            .order('start_at', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Array<
            Pick<Database['public']['Tables']['schedule_events']['Row'], 'id' | 'title' | 'description' | 'location' | 'start_at' | 'end_at' | 'season_id' | 'is_active' | 'created_at'>
        >).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            location: item.location,
            startAt: item.start_at,
            endAt: item.end_at,
            seasonId: item.season_id,
            isActive: item.is_active,
            createdAt: item.created_at,
        }));
    } catch (error) {
        return fallback('getScheduleEvents', () => sortScheduleEvents(localState.scheduleEvents.filter((item) => item.isActive)), error);
    }
};

export const getAttendanceSessions = async (): Promise<AttendanceSession[]> => {
    if (!isSupabaseConfigured) {
        return sortAttendanceSessions(localState.attendanceSessions);
    }

    try {
        const client = getSupabaseClient();
        const [sessionResult, entryResult, memberResult, teamResult] = await Promise.all([
            client
                .from('attendance_sessions')
                .select('id, title, session_code, point_rule_id, season_id, starts_at, ends_at, note, is_active, is_hidden, created_at, target_group_type, target_team_id')
                .order('starts_at', { ascending: false }),
            client
                .from('attendance_session_members')
                .select('id, session_id, member_id, attendance_status, activity_record_id, created_at, updated_at'),
            getMembers(),
            client.from('teams').select('id, name'),
        ]);

        if (sessionResult.error) {
            throw sessionResult.error;
        }

        if (entryResult.error) {
            throw entryResult.error;
        }

        if (teamResult.error) {
            throw teamResult.error;
        }

        const sessions = (sessionResult.data ?? []) as Array<Pick<
            AttendanceSessionRow,
            'id' | 'title' | 'session_code' | 'point_rule_id' | 'season_id' | 'starts_at' | 'ends_at' | 'note' | 'is_active' | 'is_hidden' | 'created_at' | 'target_group_type' | 'target_team_id'
        >>;
        const entryRows = (entryResult.data ?? []) as Array<Pick<
            AttendanceSessionMemberRow,
            'id' | 'session_id' | 'member_id' | 'attendance_status' | 'activity_record_id' | 'created_at' | 'updated_at'
        >>;
        const memberMap = new Map(memberResult.map((member) => [member.id, member]));
        const teamMap = new Map(((teamResult.data ?? []) as Pick<TeamRow, 'id' | 'name'>[]).map((team) => [team.id, team.name]));
        const entriesBySession = entryRows.reduce<Map<string, AttendanceSessionMember[]>>((acc, row) => {
            const current = acc.get(row.session_id) ?? [];
            current.push(mapAttendanceSessionMember(row, memberMap));
            acc.set(row.session_id, current);
            return acc;
        }, new Map());

        return sortAttendanceSessions(
            sessions.map((session) => mapAttendanceSession(session, entriesBySession.get(session.id) ?? [], teamMap)),
        );
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['attendance_sessions', 'attendance_session_members'])) {
            console.warn('[data] attendance session tables are unavailable in Supabase; returning an empty list instead.');
            return [];
        }

        return fallback('getAttendanceSessions', () => sortAttendanceSessions(localState.attendanceSessions), error);
    }
};

export const createAttendanceSession = async (input: {
    title: string;
    startsAt: string;
    targetGroupType: AttendanceTargetGroup;
    targetTeamId?: string | null;
    note?: string;
}): Promise<AttendanceSession> => {
    const title = input.title.trim();
    const note = input.note?.trim() || null;

    if (!title) {
        throw new Error('출석 세션 제목을 입력해 주세요.');
    }

    const [categories, members, season, teams] = await Promise.all([
        getCategories(),
        getMembers(),
        getCurrentSeason(),
        getTeams(),
    ]);
    const presentRule = getAttendanceRule(categories, 'present');
    const targetMembers = filterMembersForAttendanceGroup(members, input.targetGroupType, input.targetTeamId);
    const teamMap = new Map(teams.map((team) => [team.id, team.name]));

    if (!presentRule) {
        throw new Error('출석 세션을 만들려면 먼저 참석 규칙이 필요합니다. 설정에서 출석 규칙을 확인해 주세요.');
    }

    if (targetMembers.length === 0) {
        throw new Error('선택한 대상 그룹에 속한 멤버가 없습니다.');
    }

    const createLocalSession = async () => {
        const createdAt = new Date().toISOString();
        const sessionId = createLocalId('attendance_session');
        const recordIds = await createBatchActivityEntryRecords(
            targetMembers.map((member) => member.id),
            presentRule.id,
            note ?? undefined,
            {
                occurredAt: input.startsAt,
                reason: `${title} · ${attendanceStatusLabels.present}`,
            },
        );
        const entries = targetMembers.map<AttendanceSessionMember>((member, index) => ({
            id: createLocalId('attendance_entry'),
            sessionId,
            memberId: member.id,
            memberName: member.name,
            roleName: member.roleName ?? null,
            teamNames: member.teamNames ?? (member.teamName ? [member.teamName] : []),
            status: 'present',
            activityRecordId: recordIds[index] ?? null,
            createdAt,
            updatedAt: createdAt,
        }));

        localState.attendanceSessionMembers = [...localState.attendanceSessionMembers, ...entries];
        const session: AttendanceSession = {
            id: sessionId,
            title,
            sessionCode: createAttendanceCode(),
            pointRuleId: presentRule.id,
            pointRuleName: presentRule.categoryName,
            seasonId: season?.id ?? null,
            startsAt: input.startsAt,
            endsAt: null,
            note,
            isActive: true,
            isHidden: false,
            createdAt,
            targetGroupType: input.targetGroupType,
            targetTeamId: input.targetTeamId ?? null,
            targetGroupLabel: getAttendanceTargetGroupLabel(input.targetGroupType, input.targetTeamId, teamMap),
            memberCount: entries.length,
            statusCounts: buildAttendanceStatusCounts(entries),
            entries,
        };
        localState.attendanceSessions = sortAttendanceSessions([session, ...localState.attendanceSessions]);
        return session;
    };

    if (!isSupabaseConfigured) {
        return createLocalSession();
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('attendance_sessions')
            .insert({
                title,
                session_code: createAttendanceCode(),
                point_rule_id: presentRule.id,
                season_id: season?.id ?? null,
                starts_at: input.startsAt,
                note,
                is_active: true,
                target_group_type: input.targetGroupType,
                target_team_id: input.targetGroupType === 'team' ? input.targetTeamId ?? null : null,
            })
            .select('id')
            .single();

        if (error || !data) {
            throw error ?? new Error('출석 세션을 만들지 못했습니다.');
        }

        const recordIds = await createBatchActivityEntryRecords(
            targetMembers.map((member) => member.id),
            presentRule.id,
            note ?? undefined,
            {
                occurredAt: input.startsAt,
                reason: `${title} · ${attendanceStatusLabels.present}`,
            },
        );
        const { error: entryError } = await client.from('attendance_session_members').insert(
            targetMembers.map((member, index) => ({
                session_id: data.id,
                member_id: member.id,
                attendance_status: 'present',
                activity_record_id: recordIds[index] ?? null,
            })),
        );

        if (entryError) {
            throw entryError;
        }

        const sessions = await getAttendanceSessions();
        const created = sessions.find((session) => session.id === data.id);
        if (!created) {
            throw new Error('생성된 출석 세션을 다시 불러오지 못했습니다.');
        }

        return created;
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['attendance_sessions', 'attendance_session_members'])) {
            throw new Error('관리자 출석 세션 기능이 아직 실DB에 적용되지 않았습니다. 최신 출석 migration을 먼저 반영해 주세요.');
        }

        throw error;
    }
};

export const setAttendanceSessionActive = async (id: string, isActive: boolean): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.attendanceSessions = localState.attendanceSessions.map((session) =>
            session.id === id
                ? { ...session, isActive }
                : session,
        );
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.from('attendance_sessions').update({ is_active: isActive }).eq('id', id);
        if (error) {
            throw error;
        }
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['attendance_sessions'])) {
            throw new Error('관리자 출석 세션 기능이 아직 실DB에 적용되지 않았습니다. 최신 출석 migration을 먼저 반영해 주세요.');
        }

        throw error;
    }
};

export const closeAttendanceSession = async (id: string): Promise<void> => {
    await setAttendanceSessionActive(id, false);
};

export const setAttendanceSessionHidden = async (id: string, isHidden: boolean): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.attendanceSessions = localState.attendanceSessions.map((session) =>
            session.id === id
                ? { ...session, isHidden }
                : session,
        );
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('attendance_sessions')
            .update({ is_hidden: isHidden })
            .eq('id', id);
        if (error) {
            throw error;
        }
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['attendance_sessions'])) {
            throw new Error('관리자 출석 세션 기능이 아직 실DB에 적용되지 않았습니다. 최신 출석 migration을 먼저 반영해 주세요.');
        }

        throw error;
    }
};

export const updateAttendanceSessionMemberStatus = async (input: {
    sessionId: string;
    memberId: string;
    status: AttendanceStatus;
    title: string;
    startsAt: string;
    note?: string | null;
}): Promise<void> => {
    const categories = await getCategories();
    const targetRule = getAttendanceRule(categories, input.status);

    if (!targetRule) {
        throw new Error(`${attendanceStatusLabels[input.status]} 처리 규칙을 찾지 못했습니다. 설정에서 출석 규칙을 확인해 주세요.`);
    }

    const reason = `${input.title} · ${attendanceStatusLabels[input.status]}`;
    const applyLocalUpdate = async () => {
        const sessionMember = localState.attendanceSessionMembers.find((entry) => entry.sessionId === input.sessionId && entry.memberId === input.memberId);
        if (!sessionMember) {
            throw new Error('출석 세션 멤버 정보를 찾지 못했습니다.');
        }

        if (sessionMember.activityRecordId) {
            await reverseActivityEntryRecord(sessionMember.activityRecordId, `${reason}으로 재조정`);
        }

        const recordId = await createActivityEntryRecord(input.memberId, targetRule.id, input.note ?? undefined, {
            occurredAt: input.startsAt,
            reason,
        });

        localState.attendanceSessionMembers = localState.attendanceSessionMembers.map((entry) =>
            entry.id === sessionMember.id
                ? {
                    ...entry,
                    status: input.status,
                    activityRecordId: recordId,
                    updatedAt: new Date().toISOString(),
                }
                : entry,
        );

        localState.attendanceSessions = localState.attendanceSessions.map((session) =>
            session.id === input.sessionId
                ? mapAttendanceSession(
                    {
                        id: session.id,
                        title: session.title,
                        session_code: session.sessionCode,
                        point_rule_id: session.pointRuleId,
                        season_id: session.seasonId ?? null,
                        starts_at: session.startsAt,
                        ends_at: session.endsAt ?? null,
                        note: session.note ?? null,
                        is_active: session.isActive,
                        is_hidden: session.isHidden,
                        created_at: session.createdAt,
                        target_group_type: session.targetGroupType,
                        target_team_id: session.targetTeamId ?? null,
                    },
                    localState.attendanceSessionMembers.filter((entry) => entry.sessionId === input.sessionId),
                    new Map(localState.teams.map((team) => [team.id, team.name])),
                )
                : session,
        );
    };

    if (!isSupabaseConfigured) {
        await applyLocalUpdate();
        return;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('attendance_session_members')
            .select('id, activity_record_id')
            .eq('session_id', input.sessionId)
            .eq('member_id', input.memberId)
            .single();

        if (error || !data) {
            throw error ?? new Error('출석 세션 멤버 정보를 찾지 못했습니다.');
        }

        if (data.activity_record_id) {
            await reverseActivityEntryRecord(data.activity_record_id, `${reason}으로 재조정`);
        }

        const recordId = await createActivityEntryRecord(input.memberId, targetRule.id, input.note ?? undefined, {
            occurredAt: input.startsAt,
            reason,
        });
        const { error: updateError } = await client
            .from('attendance_session_members')
            .update({
                attendance_status: input.status,
                activity_record_id: recordId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', data.id);

        if (updateError) {
            throw updateError;
        }
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['attendance_sessions', 'attendance_session_members'])) {
            throw new Error('관리자 출석 세션 기능이 아직 실DB에 적용되지 않았습니다. 최신 출석 migration을 먼저 반영해 주세요.');
        }

        throw error;
    }
};

export const submitAttendanceCheckin = async (): Promise<void> => {
    throw new Error('링크 출석은 더 이상 지원되지 않습니다. 운영진이 활동 탭에서 직접 출석 상태를 관리해 주세요.');
};

export const addScheduleEvent = async (input: {
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: string;
    endAt?: string | null;
    seasonId?: string | null;
}): Promise<ScheduleEventItem> => {
    const payload = {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        location: input.location?.trim() || null,
        startAt: input.startAt,
        endAt: input.endAt ?? null,
        seasonId: input.seasonId ?? null,
    };

    if (!isSupabaseConfigured) {
        const item: ScheduleEventItem = {
            id: createLocalId('schedule'),
            title: payload.title,
            description: payload.description,
            location: payload.location,
            startAt: payload.startAt,
            endAt: payload.endAt,
            seasonId: payload.seasonId,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        localState.scheduleEvents.push(item);
        return item;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('schedule_events')
            .insert({
                title: payload.title,
                description: payload.description,
                location: payload.location,
                start_at: payload.startAt,
                end_at: payload.endAt,
                season_id: payload.seasonId,
                is_active: true,
            })
            .select('id, title, description, location, start_at, end_at, season_id, is_active, created_at')
            .single();

        if (error) {
            throw error;
        }

        const result = {
            id: data.id,
            title: data.title,
            description: data.description,
            location: data.location,
            startAt: data.start_at,
            endAt: data.end_at,
            seasonId: data.season_id,
            isActive: data.is_active,
            createdAt: data.created_at,
        };
        const dateLabel = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(data.start_at));
        sendPushNotification('새 일정', `${data.title} — ${dateLabel}`);
        return result;
    } catch (error) {
        const item: ScheduleEventItem = {
            id: createLocalId('schedule'),
            title: payload.title,
            description: payload.description,
            location: payload.location,
            startAt: payload.startAt,
            endAt: payload.endAt,
            seasonId: payload.seasonId,
            isActive: true,
            createdAt: new Date().toISOString(),
        };
        localState.scheduleEvents.push(item);
        return fallback('addScheduleEvent', () => item, error);
    }
};

export const deleteScheduleEvent = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.scheduleEvents = localState.scheduleEvents.filter((item) => item.id !== id);
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.from('schedule_events').update({ is_active: false }).eq('id', id);
        if (error) {
            throw error;
        }
    } catch (error) {
        localState.scheduleEvents = localState.scheduleEvents.filter((item) => item.id !== id);
        fallback('deleteScheduleEvent', () => undefined, error);
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
        localState.teams.push(team);
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
        localState.teams.push(team);
        return fallback('addTeam', () => team, error);
    }
};

export const updateTeam = async (id: string, input: { name: string; type: TeamType }): Promise<TeamSummary> => {
    const name = input.name.trim();

    if (!name) {
        throw new Error('팀 이름을 입력해 주세요.');
    }

    if (!isSupabaseConfigured) {
        const teamIndex = localState.teams.findIndex((team) => team.id === id);
        if (teamIndex < 0) {
            throw new Error('수정할 팀을 찾지 못했습니다.');
        }

        const previousTeam = localState.teams[teamIndex];
        const nextTeam: TeamSummary = {
            ...previousTeam,
            name,
            type: input.type,
        };

        localState.teams.splice(teamIndex, 1, nextTeam);
        localState.members = localState.members.map((member) => {
            const teamIds = getLocalMemberTeamIds(member.id);
            const teamNames = teamIds
                .map((teamId) => getLocalTeamById(teamId)?.name ?? null)
                .filter((teamName): teamName is string => Boolean(teamName));

            return {
                ...member,
                teamName: member.teamId ? getLocalTeamById(member.teamId)?.name ?? null : teamNames[0] ?? null,
                teamIds,
                teamNames,
            };
        });
        rebuildLocalAttendanceSessions();
        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'team',
            entityId: id,
            action: 'updated',
            summary: `${name} 팀 정보 수정`,
            diff: {
                summary: `${name} 팀 정보 수정`,
                teamName: name,
                changes: {
                    name: { from: previousTeam.name, to: name },
                    type: { from: previousTeam.type, to: input.type },
                },
            },
        });
        return nextTeam;
    }

    const client = getSupabaseClient();
    const { data, error } = await client
        .from('teams')
        .update({
            name,
            type: input.type,
        })
        .eq('id', id)
        .select('id, name, type, is_active')
        .single();

    if (error || !data) {
        throw error ?? new Error('팀 정보를 수정하지 못했습니다.');
    }

    return {
        id: data.id,
        name: data.name,
        type: data.type,
        isActive: data.is_active,
    };
};

export const replaceTeamMembers = async (teamId: string, memberIds: string[]): Promise<TeamMemberUpdateResult> => {
    const normalizedMemberIds = [...new Set(memberIds.filter(Boolean))];

    if (!isSupabaseConfigured) {
        const team = localState.teams.find((item) => item.id === teamId) ?? null;
        if (!team) {
            throw new Error('팀 정보를 찾지 못했습니다.');
        }

        const currentMemberIds = localState.members
            .filter((member) => (member.teamIds ?? []).includes(teamId) || member.teamId === teamId)
            .map((member) => member.id);
        const affectedMemberIds = [...new Set([...currentMemberIds, ...normalizedMemberIds])];

        affectedMemberIds.forEach((memberId) => {
            const currentTeamIds = getLocalMemberTeamIds(memberId);
            const nextTeamIds = normalizedMemberIds.includes(memberId)
                ? dedupeTeamIds([...currentTeamIds, teamId])
                : currentTeamIds.filter((currentTeamId) => currentTeamId !== teamId);
            syncLocalMemberTeamState(memberId, nextTeamIds);
        });

        const result: TeamMemberUpdateResult = {
            teamId,
            teamName: team.name,
            memberCount: normalizedMemberIds.length,
            addedCount: normalizedMemberIds.filter((memberId) => !currentMemberIds.includes(memberId)).length,
            removedCount: currentMemberIds.filter((memberId) => !normalizedMemberIds.includes(memberId)).length,
        };

        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'team',
            entityId: teamId,
            action: 'members_replaced',
            summary: `${team.name} 팀원 배정 저장`,
            diff: {
                summary: `${team.name} 팀원 배정 저장`,
                teamName: team.name,
                memberCount: result.memberCount,
                addedCount: result.addedCount,
                removedCount: result.removedCount,
            },
        });

        return result;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('replace_team_members', {
        p_team_id: teamId,
        p_member_ids: normalizedMemberIds,
    });

    if (error) {
        throw error;
    }

    return parseTeamMemberUpdateResult(data);
};

export const deleteTeam = async (teamId: string): Promise<TeamDeleteResult> => {
    if (!isSupabaseConfigured) {
        const teamIndex = localState.teams.findIndex((team) => team.id === teamId);
        if (teamIndex < 0) {
            throw new Error('삭제할 팀을 찾지 못했습니다.');
        }

        const team = localState.teams[teamIndex];
        const affectedMemberIds = [...new Set(
            localState.members
                .filter((member) => (member.teamIds ?? []).includes(teamId) || member.teamId === teamId)
                .map((member) => member.id),
        )];

        localState.memberTeamLinks = localState.memberTeamLinks.filter((link) => link.teamId !== teamId);
        localState.teams.splice(teamIndex, 1);
        affectedMemberIds.forEach((memberId) => {
            syncLocalMemberTeamState(memberId, getLocalMemberTeamIds(memberId));
        });
        rebuildLocalAttendanceSessions();

        const result: TeamDeleteResult = {
            teamId,
            teamName: team.name,
            teamType: team.type,
            affectedMemberCount: affectedMemberIds.length,
        };

        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'team',
            entityId: teamId,
            action: 'deleted',
            summary: `${team.name} 팀 삭제`,
            diff: {
                summary: `${team.name} 팀 삭제`,
                teamName: team.name,
                teamType: team.type,
                affectedMemberCount: affectedMemberIds.length,
            },
        });

        return result;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('delete_team', {
        p_team_id: teamId,
    });

    if (error) {
        throw error;
    }

    return parseTeamDeleteResult(data);
};

export const setMemberTeams = async (memberId: string, nextTeamIds: string[]): Promise<void> => {
    const normalizedTeamIds = dedupeTeamIds(nextTeamIds);

    if (!isSupabaseConfigured) {
        const previousMember = localState.members.find((member) => member.id === memberId);
        const previousTeamIds = getLocalMemberTeamIds(memberId);
        syncLocalMemberTeamState(memberId, normalizedTeamIds);
        const nextMember = localState.members.find((member) => member.id === memberId);

        if (previousMember && nextMember && previousTeamIds.join('|') !== normalizedTeamIds.join('|')) {
            const previousTeamNames = previousTeamIds
                .map((teamId) => getLocalTeamById(teamId)?.name ?? null)
                .filter((teamName): teamName is string => Boolean(teamName));
            const nextTeamNames = normalizedTeamIds
                .map((teamId) => getLocalTeamById(teamId)?.name ?? null)
                .filter((teamName): teamName is string => Boolean(teamName));
            const summary = `${nextMember.name} · 소속 팀 변경`;
            logLocalAuditEntry({
                actorId: null,
                actorName: '로컬 운영자',
                entityType: 'member',
                entityId: memberId,
                action: 'updated',
                summary,
                diff: {
                    summary,
                    memberName: nextMember.name,
                    changes: {
                        teams: {
                            fromIds: previousTeamIds,
                            fromNames: previousTeamNames,
                            toIds: normalizedTeamIds,
                            toNames: nextTeamNames,
                        },
                    },
                },
            });
        }
        return;
    }

    try {
        const client = getSupabaseClient();
        await client.from('member_team_links').delete().eq('member_id', memberId);

        if (normalizedTeamIds.length > 0) {
            const { error: insertError } = await client.from('member_team_links').insert(
                normalizedTeamIds.map((teamId) => ({
                    member_id: memberId,
                    team_id: teamId,
                })),
            );

            if (insertError) {
                throw insertError;
            }
        }

        const { error: memberError } = await client
            .from('members')
            .update({
                team_id: normalizedTeamIds[0] ?? null,
            })
            .eq('id', memberId);

        if (memberError) {
            throw memberError;
        }
    } catch (error) {
        fallback('setMemberTeams', () => undefined, error);
    }
};

export const getSeasons = async (): Promise<SeasonSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localState.seasons].sort((a, b) => b.startDate.localeCompare(a.startDate));
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
        return fallback('getSeasons', () => [...localState.seasons].sort((a, b) => b.startDate.localeCompare(a.startDate)), error);
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
        localState.seasons.push(season);
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
        localState.seasons.push(season);
        return fallback('addSeason', () => season, error);
    }
};

export const resetActivityDataCurrentSeason = async (): Promise<SeasonDataResetResult> => {
    if (!isSupabaseConfigured) {
        const season = getLocalCurrentSeasonSummary();
        if (!season) {
            throw new Error('현재 진행 중인 시즌이 없습니다.');
        }

        const removed = removeLocalActivityRecords((log) => isTimestampInSeason(log.timestamp, season));
        const badgeRefreshCount = refreshLocalMemberBadgesForMembers(removed.memberIds);
        const result: SeasonDataResetResult = {
            seasonId: season.id,
            seasonName: season.name,
            activityRecordCount: removed.activityRecordCount,
            pointLedgerCount: removed.pointLedgerCount,
            correctionRequestCount: removed.correctionRequestCount,
            affectedMemberCount: removed.memberIds.length,
            badgeRefreshCount,
        };

        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'season',
            entityId: season.id,
            action: 'activity_data_reset',
            summary: `${season.name} 시즌 활동 내역 초기화`,
            diff: {
                summary: `${season.name} 시즌 활동 내역 초기화`,
                seasonId: season.id,
                seasonName: season.name,
                activityRecordCount: removed.activityRecordCount,
                pointLedgerCount: removed.pointLedgerCount,
                correctionRequestCount: removed.correctionRequestCount,
                affectedMemberCount: removed.memberIds.length,
                badgeRefreshCount,
            },
        });

        return result;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('reset_activity_data_current_season');

    if (error) {
        throw error;
    }

    return parseSeasonDataResetResult(data);
};

export const resetAttendanceDataCurrentSeason = async (): Promise<SeasonDataResetResult> => {
    if (!isSupabaseConfigured) {
        const season = getLocalCurrentSeasonSummary();
        if (!season) {
            throw new Error('현재 진행 중인 시즌이 없습니다.');
        }

        const sessionIds = new Set(localState.attendanceSessions.filter((session) => session.seasonId === season.id).map((session) => session.id));
        const attendanceSessionCount = sessionIds.size;
        const attendanceSessionMemberCount = localState.attendanceSessionMembers.filter((entry) => sessionIds.has(entry.sessionId)).length;
        localState.attendanceSessions = localState.attendanceSessions.filter((session) => !sessionIds.has(session.id));
        localState.attendanceSessionMembers = localState.attendanceSessionMembers.filter((entry) => !sessionIds.has(entry.sessionId));

        const removed = removeLocalActivityRecords((log, category) =>
            isTimestampInSeason(log.timestamp, season) && category?.groupName === 'attendance',
        );
        const badgeRefreshCount = refreshLocalMemberBadgesForMembers(removed.memberIds);
        const result: SeasonDataResetResult = {
            seasonId: season.id,
            seasonName: season.name,
            activityRecordCount: removed.activityRecordCount,
            pointLedgerCount: removed.pointLedgerCount,
            affectedMemberCount: removed.memberIds.length,
            badgeRefreshCount,
            attendanceSessionCount,
            attendanceSessionMemberCount,
        };

        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'season',
            entityId: season.id,
            action: 'attendance_data_reset',
            summary: `${season.name} 시즌 출석 세션 초기화`,
            diff: {
                summary: `${season.name} 시즌 출석 세션 초기화`,
                seasonId: season.id,
                seasonName: season.name,
                attendanceSessionCount,
                attendanceSessionMemberCount,
                activityRecordCount: removed.activityRecordCount,
                pointLedgerCount: removed.pointLedgerCount,
                affectedMemberCount: removed.memberIds.length,
                badgeRefreshCount,
            },
        });

        return result;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('reset_attendance_data_current_season');

    if (error) {
        throw error;
    }

    return parseSeasonDataResetResult(data);
};

export const resetManualActivityDataCurrentSeason = async (): Promise<SeasonDataResetResult> => {
    if (!isSupabaseConfigured) {
        const season = getLocalCurrentSeasonSummary();
        if (!season) {
            throw new Error('현재 진행 중인 시즌이 없습니다.');
        }

        const removed = removeLocalActivityRecords((log, category) =>
            isTimestampInSeason(log.timestamp, season) && category?.groupName !== 'attendance',
        );
        const badgeRefreshCount = refreshLocalMemberBadgesForMembers(removed.memberIds);
        const result: SeasonDataResetResult = {
            seasonId: season.id,
            seasonName: season.name,
            activityRecordCount: removed.activityRecordCount,
            pointLedgerCount: removed.pointLedgerCount,
            correctionRequestCount: removed.correctionRequestCount,
            affectedMemberCount: removed.memberIds.length,
            badgeRefreshCount,
        };

        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'season',
            entityId: season.id,
            action: 'manual_activity_data_reset',
            summary: `${season.name} 시즌 일반 활동 기록 초기화`,
            diff: {
                summary: `${season.name} 시즌 일반 활동 기록 초기화`,
                seasonId: season.id,
                seasonName: season.name,
                activityRecordCount: removed.activityRecordCount,
                pointLedgerCount: removed.pointLedgerCount,
                correctionRequestCount: removed.correctionRequestCount,
                affectedMemberCount: removed.memberIds.length,
                badgeRefreshCount,
            },
        });

        return result;
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('reset_manual_activity_data_current_season');

    if (error) {
        throw error;
    }

    return parseSeasonDataResetResult(data);
};

export const deleteMember = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        const previousMember = localState.members.find((member) => member.id === id);
        localState.members = localState.members.map((member) =>
            member.id === id
                ? {
                    ...member,
                    status: 'inactive',
                    isVisible: false,
                }
                : member,
        );
        const member = localState.members.find((entry) => entry.id === id);
        if (member && previousMember) {
            logLocalAuditEntry({
                actorId: null,
                actorName: '로컬 운영자',
                entityType: 'member',
                entityId: id,
                action: 'updated',
                summary: `${member.name} · 회원 상태 변경`,
                diff: {
                    summary: `${member.name} · 회원 상태 변경`,
                    memberName: member.name,
                    changes: {
                        status: { from: previousMember.status ?? 'active', to: 'inactive' },
                        visibility: { from: previousMember.isVisible ?? true, to: false },
                    },
                },
            });
        }
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
        localState.members = localState.members.filter((member) => member.id !== id);
        localState.logs = localState.logs.filter((log) => log.memberId !== id);
        fallback('deleteMember', () => undefined, error);
    }
};

export const hardDeleteHiddenMember = async (memberId: string): Promise<HardDeleteMemberResult> => {
    if (!isSupabaseConfigured) {
        const member = localState.members.find((entry) => entry.id === memberId) ?? null;
        if (!member) {
            throw new Error('멤버 정보를 찾지 못했습니다.');
        }

        if (member.isVisible !== false) {
            throw new Error('숨김 처리된 멤버만 영구 삭제할 수 있습니다.');
        }

        if (localState.logs.some((log) => log.memberId === memberId && Boolean(log.recordId))) {
            throw new Error('활동 기록이 남아 있는 회원은 영구 삭제할 수 없습니다.');
        }

        const memberBadgeCount = localState.memberBadges.filter((badge) => badge.memberId === memberId).length;
        const memberTeamLinkCount = localState.memberTeamLinks.filter((link) => link.memberId === memberId).length;
        const attendanceSessionMemberCount = localState.attendanceSessionMembers.filter((entry) => entry.memberId === memberId).length;
        const deletedAuthUser = Boolean(member.authUserId);

        for (let index = localState.memberBadges.length - 1; index >= 0; index -= 1) {
            if (localState.memberBadges[index].memberId === memberId) {
                localState.memberBadges.splice(index, 1);
            }
        }

        localState.memberTeamLinks = localState.memberTeamLinks.filter((link) => link.memberId !== memberId);
        localState.attendanceSessionMembers = localState.attendanceSessionMembers.filter((entry) => entry.memberId !== memberId);

        for (let index = localState.correctionRequests.length - 1; index >= 0; index -= 1) {
            if (localState.correctionRequests[index].requesterMemberId === memberId) {
                localState.correctionRequests.splice(index, 1);
            }
        }

        localState.members = localState.members.filter((entry) => entry.id !== memberId);
        rebuildLocalAttendanceSessions();

        logLocalAuditEntry({
            actorId: null,
            actorName: '로컬 운영자',
            entityType: 'member',
            entityId: memberId,
            action: 'hard_deleted',
            summary: `${member.name} 멤버 영구 삭제`,
            diff: {
                summary: `${member.name} 멤버 영구 삭제`,
                memberName: member.name,
                deletedAuthUser,
                relatedDeletes: {
                    memberBadges: memberBadgeCount,
                    memberTeamLinks: memberTeamLinkCount,
                    userProfiles: 0,
                    attendanceSessionMembers: attendanceSessionMemberCount,
                    attendanceCheckins: 0,
                },
            },
        });

        return {
            memberId,
            memberName: member.name,
            deletedAuthUser,
            deletedCounts: {
                memberBadges: memberBadgeCount,
                memberTeamLinks: memberTeamLinkCount,
                userProfiles: 0,
                attendanceSessionMembers: attendanceSessionMemberCount,
                attendanceCheckins: 0,
            },
        };
    }

    const client = getSupabaseClient();
    const {
        data: { session },
    } = await client.auth.getSession();

    if (!session?.access_token) {
        throw new Error('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 멤버를 삭제해 주세요.');
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase 함수 엔드포인트 설정이 비어 있습니다.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/hard-delete-member`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ memberId }),
    });

    const payload = await response
        .json()
        .catch(async () => ({ error: await response.text().catch(() => '') }));

    if (!response.ok) {
        const functionMessage =
            payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
                ? payload.error
                : null;

        throw new Error(functionMessage || '회원을 영구 삭제하지 못했습니다.');
    }

    return parseHardDeleteMemberResult(payload);
};

export const updateMember = async (
    id: string,
    updates: Partial<Pick<Member, 'name' | 'loginEmail' | 'roleId' | 'teamId' | 'status' | 'isApproved' | 'isVisible'>>,
): Promise<void> => {
    if (!isSupabaseConfigured) {
        const previousMember = localState.members.find((member) => member.id === id);
        const previousTeamIds = getLocalMemberTeamIds(id);

        localState.members = localState.members.map((member) => {
            if (member.id !== id) {
                return member;
            }

            const nextRoleId = updates.roleId !== undefined ? updates.roleId : member.roleId ?? null;

            return {
                ...member,
                name: updates.name ?? member.name,
                loginEmail: updates.loginEmail !== undefined ? normalizeLoginEmail(updates.loginEmail) : member.loginEmail ?? null,
                roleId: nextRoleId,
                roleName: nextRoleId ? localState.roles.find((role) => role.id === nextRoleId)?.name ?? null : null,
                status: updates.status ?? member.status,
                isApproved: updates.isApproved ?? member.isApproved,
                isVisible: updates.isVisible ?? member.isVisible,
            };
        });

        if (updates.teamId !== undefined) {
            const nextTeamIds = updates.teamId
                ? [updates.teamId, ...previousTeamIds.filter((teamId) => teamId !== updates.teamId)]
                : previousTeamIds.filter((teamId) => teamId !== (previousMember?.teamId ?? null));
            syncLocalMemberTeamState(id, nextTeamIds);
        }

        const nextMember = localState.members.find((member) => member.id === id);

        if (nextMember && previousMember) {
            const changes: Record<string, unknown> = {};
            const nextRole = getLocalRoleById(nextMember.roleId);
            const previousRole = getLocalRoleById(previousMember.roleId);
            const nextTeam = getLocalTeamById(nextMember.teamId);
            const previousTeam = getLocalTeamById(previousMember.teamId);

            if (previousMember.name !== nextMember.name) {
                changes.name = { from: previousMember.name, to: nextMember.name };
            }
            if ((previousMember.loginEmail ?? null) !== (nextMember.loginEmail ?? null)) {
                changes.loginEmail = { from: previousMember.loginEmail ?? null, to: nextMember.loginEmail ?? null };
            }
            if ((previousMember.roleId ?? null) !== (nextMember.roleId ?? null)) {
                changes.role = {
                    fromId: previousMember.roleId ?? null,
                    fromName: previousRole?.name ?? null,
                    fromScope: previousRole?.permissionScope ?? null,
                    toId: nextMember.roleId ?? null,
                    toName: nextRole?.name ?? null,
                    toScope: nextRole?.permissionScope ?? null,
                };
            }
            if ((previousMember.teamId ?? null) !== (nextMember.teamId ?? null)) {
                changes.team = {
                    fromId: previousMember.teamId ?? null,
                    fromName: previousTeam?.name ?? null,
                    toId: nextMember.teamId ?? null,
                    toName: nextTeam?.name ?? null,
                };
            }
            if ((previousMember.status ?? 'active') !== (nextMember.status ?? 'active')) {
                changes.status = { from: previousMember.status ?? 'active', to: nextMember.status ?? 'active' };
            }
            if (previousMember.isApproved !== nextMember.isApproved) {
                changes.approval = { from: previousMember.isApproved, to: nextMember.isApproved };
            }
            if ((previousMember.isVisible ?? true) !== (nextMember.isVisible ?? true)) {
                changes.visibility = { from: previousMember.isVisible ?? true, to: nextMember.isVisible ?? true };
            }

            if (Object.keys(changes).length > 0) {
                const summary = buildLocalMemberAuditSummary(nextMember.name, changes, 'updated');
                logLocalAuditEntry({
                    actorId: null,
                    actorName: '로컬 운영자',
                    entityType: 'member',
                    entityId: id,
                    action: 'updated',
                    summary,
                    diff: {
                        summary,
                        memberName: nextMember.name,
                        changes,
                    },
                });
            }
        }
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

        if (updates.teamId !== undefined && updates.teamId) {
            const { error: upsertError } = await client.from('member_team_links').upsert(
                {
                    member_id: id,
                    team_id: updates.teamId,
                },
                {
                    onConflict: 'member_id,team_id',
                    ignoreDuplicates: true,
                },
            );

            if (upsertError) {
                throw upsertError;
            }
        }
    } catch (error) {
        fallback('updateMember', () => undefined, error);
    }
};

export const addCategory = async ({
    categoryName,
    pointValue,
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
            penaltyPoint: 0,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson,
            version: 1,
            isActive: true,
        };
        localState.categories.push(newCategory);
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
                penalty_point: 0,
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
            penaltyPoint: 0,
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
            penaltyPoint: 0,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson,
            version: 1,
            isActive: true,
        };
        localState.categories.push(newCategory);
        return fallback('addCategory', () => newCategory, error);
    }
};

export const createCategoryVersion = async (
    sourceRuleId: string,
    {
        pointValue,
        conditionSummary = '',
    }: Pick<CategoryInput, 'pointValue' | 'conditionSummary'>,
): Promise<Category | null> => {
    const normalizedConditionSummary = conditionSummary.trim();
    const conditionJson = normalizedConditionSummary ? { summary: normalizedConditionSummary } : {};

    if (!isSupabaseConfigured) {
        const sourceCategory = localState.categories.find((category) => category.id === sourceRuleId);
        if (!sourceCategory || !sourceCategory.activityTypeId) {
            return null;
        }

        localState.categories = localState.categories.map((category) =>
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
            penaltyPoint: 0,
            conditionSummary: normalizedConditionSummary || null,
            conditionJson,
            version: (sourceCategory.version ?? 1) + 1,
            isActive: true,
        };
        localState.categories.push(nextCategory);
        return nextCategory;
    }

    try {
        const client = getSupabaseClient();
        const { data: newRuleId, error: createError } = await client.rpc('create_point_rule_version', {
            p_source_rule_id: sourceRuleId,
            p_base_point: pointValue,
            p_penalty_point: 0,
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
            id: insertedRule.id!,
            activityTypeId: insertedRule.activity_type_id!,
            categoryName: insertedRule.category_name!,
            groupName: insertedRule.group_name!,
            pointValue: insertedRule.point_value!,
            penaltyPoint: 0,
            conditionSummary: getConditionSummary(insertedRule.condition_json),
            conditionJson: parseJsonObject(insertedRule.condition_json),
            version: insertedRule.version!,
            isActive: insertedRule.is_active ?? undefined,
        };
    } catch (error) {
        return fallback('createCategoryVersion', () => null, error);
    }
};

export const deleteCategory = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localState.categories = localState.categories.map((category) =>
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
        localState.categories = localState.categories.map((category) =>
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
    try {
        await createActivityEntryRecord(memberId, categoryId, note, options);
    } catch (error) {
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
    try {
        await createBatchActivityEntryRecords(memberIds, categoryId, note, options);
    } catch (error) {
        fallback('createBatchActivityEntries', () => undefined, error);
    }
};

export const reverseActivityEntry = async (recordId: string, note?: string): Promise<void> => {
    try {
        await reverseActivityEntryRecord(recordId, note);
    } catch (error) {
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
            ? localState.members.find((member) => member.id === relatedLog.memberId) ?? null
            : getLocalSelfMember();

        if (!relatedLog || !requester) {
            throw new Error('정정 요청 대상을 찾지 못했습니다.');
        }

        const hasOpenRequest = localState.correctionRequests.some(
            (request) =>
                request.requesterMemberId === requester.id &&
                request.activityRecordId === recordId &&
                (request.status === 'pending' || request.status === 'reviewing'),
        );

        if (hasOpenRequest) {
            throw new Error('이미 처리 중인 정정 요청이 있습니다.');
        }

        const createdAt = new Date().toISOString();
        localState.correctionRequests.push({
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
        const request = localState.correctionRequests.find((item) => item.id === requestId);

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
            p_review_note: trimmedReviewNote ?? undefined,
        });

        if (error) {
            throw error;
        }
    } catch (error) {
        applyLocalUpdate();
        fallback('updateCorrectionRequestStatus', () => undefined, error);
    }
};
