import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Member } from '../../../types';

vi.mock('../../../lib/api/admin/members', () => ({
    getMembers: vi.fn(),
    getAuditLogs: vi.fn(),
}));

vi.mock('../../../lib/api/admin/roles', () => ({
    getRoles: vi.fn(),
}));

vi.mock('../../../lib/api/admin/teams', () => ({
    getTeams: vi.fn(),
}));

import { getAuditLogs, getMembers } from '../../../lib/api/admin/members';
import { getRoles } from '../../../lib/api/admin/roles';
import { getTeams } from '../../../lib/api/admin/teams';
import { useDashboardResources } from './useDashboardResources';

const mockGetMembers = getMembers as ReturnType<typeof vi.fn>;
const mockGetRoles = getRoles as ReturnType<typeof vi.fn>;
const mockGetTeams = getTeams as ReturnType<typeof vi.fn>;
const mockGetAuditLogs = getAuditLogs as ReturnType<typeof vi.fn>;

const makeMember = (id: string, overrides: Partial<Member> = {}): Member =>
    ({
        id,
        name: `회원${id}`,
        score: 0,
        roleId: null,
        roleName: null,
        teamId: null,
        teamName: null,
        status: 'active',
        joinedAt: '2026-03-01',
        loginEmail: null,
        isApproved: true,
        isVisible: true,
        authUserId: null,
        authProvisionedAt: null,
        passwordResetRequired: false,
        ...overrides,
    }) as Member;

describe('useDashboardResources', () => {
    beforeEach(() => {
        mockGetMembers.mockReset();
        mockGetRoles.mockReset();
        mockGetTeams.mockReset();
        mockGetAuditLogs.mockReset();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    it('모든 쿼리가 성공하면 errors 는 비어있고 데이터가 채워진다', async () => {
        mockGetMembers.mockResolvedValue([makeMember('1'), makeMember('2', { isVisible: false })]);
        mockGetRoles.mockResolvedValue([{ id: 'r1', name: '회장', permissionScope: 'super_admin', rankOrder: 10 }]);
        mockGetTeams.mockResolvedValue([{ id: 't1', name: '임원진', type: 'core', isActive: true }]);
        mockGetAuditLogs.mockResolvedValue([]);

        const { result } = renderHook(() => useDashboardResources(true));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.errors).toEqual({});
        expect(result.current.members).toHaveLength(1);
        expect(result.current.hiddenMembers).toHaveLength(1);
        expect(result.current.roles).toHaveLength(1);
        expect(result.current.teams).toHaveLength(1);
    });

    it('일부 쿼리가 실패해도 나머지 데이터는 렌더링되고 errors 에 실패 항목이 담긴다', async () => {
        mockGetMembers.mockResolvedValue([makeMember('1')]);
        mockGetRoles.mockRejectedValue(new Error('Failed to fetch'));
        mockGetTeams.mockResolvedValue([{ id: 't1', name: '임원진', type: 'core', isActive: true }]);
        mockGetAuditLogs.mockResolvedValue([]);

        const { result } = renderHook(() => useDashboardResources(true));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.errors.roles).toBe('Failed to fetch');
        expect(result.current.errors.members).toBeUndefined();
        expect(result.current.members).toHaveLength(1);
        expect(result.current.teams).toHaveLength(1);
        expect(result.current.roles).toEqual([]);
    });

    it('모든 쿼리가 실패해도 훅은 isLoading=false 로 전환되고 모든 리소스 에러가 수집된다', async () => {
        mockGetMembers.mockRejectedValue(new Error('members down'));
        mockGetRoles.mockRejectedValue(new Error('roles down'));
        mockGetTeams.mockRejectedValue(new Error('teams down'));
        mockGetAuditLogs.mockRejectedValue(new Error('audit down'));

        const { result } = renderHook(() => useDashboardResources(true));

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.errors).toEqual({
            members: 'members down',
            roles: 'roles down',
            teams: 'teams down',
            auditLogs: 'audit down',
        });
        expect(result.current.members).toEqual([]);
        expect(result.current.roles).toEqual([]);
    });

    it('refreshData 가 이전 에러를 해소하면 errors 가 비어진다', async () => {
        mockGetMembers.mockRejectedValueOnce(new Error('first fail'));
        mockGetRoles.mockResolvedValue([]);
        mockGetTeams.mockResolvedValue([]);
        mockGetAuditLogs.mockResolvedValue([]);

        const { result } = renderHook(() => useDashboardResources(true));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.errors.members).toBe('first fail');

        mockGetMembers.mockResolvedValueOnce([makeMember('1')]);
        await result.current.refreshData();

        await waitFor(() => expect(result.current.errors).toEqual({}));
        expect(result.current.members).toHaveLength(1);
    });
});
