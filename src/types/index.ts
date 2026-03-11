export type MemberStatus = 'active' | 'dormant' | 'inactive';
export type TeamType = 'core' | 'study' | 'project';
export type SeasonStatus = 'planned' | 'active' | 'closed';
export type AppRole = 'super_admin' | 'operator' | 'team_lead' | 'member';
export type CorrectionRequestStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';
export type BadgeTone = 'gold' | 'sky' | 'emerald' | 'rose';

export interface SeasonSummary {
    id: string;
    name: string;
    status: SeasonStatus;
    startDate: string;
    endDate?: string | null;
}

export interface RoleSummary {
    id: string;
    name: string;
    permissionScope: string;
    rankOrder: number;
}

export interface TeamSummary {
    id: string;
    name: string;
    type: TeamType;
    isActive: boolean;
}

export interface AnnouncementItem {
    id: string;
    title: string;
    body: string;
    startAt?: string | null;
    endAt?: string | null;
    isPinned: boolean;
    isActive: boolean;
    createdAt: string;
}

export interface ScheduleEventItem {
    id: string;
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: string;
    endAt?: string | null;
    seasonId?: string | null;
    isActive: boolean;
    createdAt: string;
}

export interface UserProfile {
    id: string;
    email: string;
    memberId?: string | null;
    appRole: AppRole;
    displayName?: string | null;
    isActive: boolean;
}

export interface Member {
    id: string;
    name: string;
    score: number;
    loginEmail?: string | null;
    isApproved: boolean;
    roleId?: string | null;
    roleName?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    status?: MemberStatus;
    joinedAt?: string | null;
    isVisible?: boolean;
}

export interface Category {
    id: string;
    activityTypeId?: string | null;
    categoryName: string;
    pointValue: number;
    penaltyPoint?: number;
    conditionSummary?: string | null;
    conditionJson?: Record<string, unknown> | null;
    groupName?: string | null;
    version?: number;
    isActive?: boolean;
}

export interface Badge {
    id: string;
    code: string;
    name: string;
    description: string;
    iconKey: string;
    tone?: BadgeTone;
    sortOrder?: number;
    isActive?: boolean;
}

export interface MemberBadge {
    id: string;
    memberId: string;
    badgeId: string;
    badgeCode: string;
    badgeName: string;
    badgeDescription: string;
    iconKey: string;
    tone?: BadgeTone;
    awardedAt: string;
    seasonId?: string | null;
}

export interface ActivityLog {
    id: string;
    recordId?: string | null;
    timestamp: string;
    memberId: string;
    categoryId: string;
    pointDelta: number;
    reason?: string | null;
    note?: string | null;
    evidenceUrl?: string | null;
    memberName?: string | null;
    categoryName?: string | null;
    reversalOf?: string | null;
    isReversal?: boolean;
    recordStatus?: string | null;
}

export interface AuditLogEntry {
    id: string;
    actorId?: string | null;
    actorName?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    summary: string;
    createdAt: string;
    diff?: Record<string, unknown> | null;
}

export interface CorrectionRequest {
    id: string;
    requesterMemberId: string;
    requesterName?: string | null;
    activityRecordId?: string | null;
    status: CorrectionRequestStatus;
    reason: string;
    reviewNote?: string | null;
    reviewedBy?: string | null;
    reviewedByName?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
    updatedAt: string;
    activitySummary?: string | null;
    activityOccurredAt?: string | null;
    activityPointDelta?: number | null;
}
