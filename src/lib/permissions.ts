import type { AppRole } from '../types';

export interface AppPermissions {
    canViewHome: boolean;
    canViewMembers: boolean;
    canViewActivities: boolean;
    canManageMembers: boolean;
    canManageSettings: boolean;
    canViewStats: boolean;
}

export const roleLabels: Record<AppRole, string> = {
    super_admin: '최고 관리자',
    operator: '운영진',
    team_lead: '팀장',
    member: '회원',
};

export const roleScopeDescriptions: Record<AppRole, string> = {
    super_admin: '시스템 전체 설정과 멤버/점수/활동/통계를 모두 관리합니다. 회장과 개발 관리자처럼 여러 직책이 같은 최고 권한을 공유할 수 있습니다.',
    operator: '운영 실무 중심 권한입니다. 멤버 관리, 활동 기록, 점수 관리, 운영 설정을 처리합니다.',
    team_lead: '자기 팀 중심 조회/활동 권한입니다. 전체 멤버 설정과 운영 설정 변경은 포함되지 않습니다.',
    member: '본인 상태와 개인 활동 중심의 조회 권한입니다.',
};

export const buildPermissions = (role: AppRole): AppPermissions => ({
    canViewHome: true,
    canViewMembers: role !== 'member',
    canViewActivities: role === 'super_admin' || role === 'operator' || role === 'team_lead',
    canManageMembers: role === 'super_admin' || role === 'operator',
    canManageSettings: role === 'super_admin' || role === 'operator',
    canViewStats: role !== 'member',
});
