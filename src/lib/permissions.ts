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
    super_admin: 'Super admin',
    operator: 'Operator',
    team_lead: 'Team lead',
    member: 'Member',
};

export const buildPermissions = (role: AppRole): AppPermissions => ({
    canViewHome: true,
    canViewMembers: true,
    canViewActivities: role === 'super_admin' || role === 'operator' || role === 'team_lead',
    canManageMembers: role === 'super_admin' || role === 'operator',
    canManagePoints: role === 'super_admin' || role === 'operator',
    canManageSettings: role === 'super_admin' || role === 'operator',
    canViewStats: true,
});
