import type { AppRole } from '../types';

export interface AppPermissions {
    canViewHome: boolean;
    canViewMembers: boolean;
    canViewActivities: boolean;
    canManageMembers: boolean;
    canManagePoints: boolean;
    canManageSettings: boolean;
    canViewStats: boolean;
}

export const roleLabels: Record<AppRole, string> = {
    super_admin: '최고 관리자',
    operator: '운영진',
    team_lead: '팀장',
    member: '회원',
};

export const buildPermissions = (role: AppRole): AppPermissions => ({
    canViewHome: true,
    canViewMembers: role !== 'member',
    canViewActivities: role === 'super_admin' || role === 'operator' || role === 'team_lead',
    canManageMembers: role === 'super_admin' || role === 'operator',
    canManagePoints: role === 'super_admin' || role === 'operator',
    canManageSettings: role === 'super_admin' || role === 'operator',
    canViewStats: role !== 'member',
});
