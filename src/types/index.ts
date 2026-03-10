export type MemberStatus = 'active' | 'dormant' | 'inactive';
export type TeamType = 'core' | 'study' | 'project';
export type SeasonStatus = 'planned' | 'active' | 'closed';
export type AppRole = 'super_admin' | 'operator' | 'team_lead' | 'member';

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
    categoryName: string;
    pointValue: number;
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
