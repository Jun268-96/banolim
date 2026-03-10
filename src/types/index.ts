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
    roleName?: string | null;
    teamName?: string | null;
    status?: MemberStatus;
    joinedAt?: string | null;
}

export interface Category {
    id: string;
    categoryName: string;
    pointValue: number;
}

export interface ActivityLog {
    id: string;
    timestamp: string;
    memberId: string;
    categoryId: string;
    pointDelta: number;
    reason?: string | null;
    note?: string | null;
    memberName?: string | null;
    categoryName?: string | null;
}
