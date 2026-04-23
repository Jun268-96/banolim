import { useCallback, useEffect, useState } from 'react';
import type { AuditLogEntry, Member, RoleSummary, TeamSummary } from '../../../types';
import { getAuditLogs, getMembers } from '../../../lib/api/admin/members';
import { getRoles } from '../../../lib/api/admin/roles';
import { getTeams } from '../../../lib/api/admin/teams';

// 개별 리소스가 실패하더라도 나머지는 계속 표시되도록 Promise.allSettled 로 전환.
// 프로덕션에서 간헐적인 Supabase gateway 502 가 한 쿼리를 실패시키면 Promise.all 은
// 전체를 reject 하여 대시보드가 무한 로딩에 빠졌다. 이제는 실패한 리소스만 에러로 표시한다.

export type DashboardResourceKey = 'members' | 'roles' | 'teams' | 'auditLogs';

export interface DashboardResourceErrors {
  members?: string;
  roles?: string;
  teams?: string;
  auditLogs?: string;
}

interface DashboardResources {
  members: Member[];
  hiddenMembers: Member[];
  roles: RoleSummary[];
  teams: TeamSummary[];
  auditLogs: AuditLogEntry[];
}

const initialResources: DashboardResources = {
  members: [],
  hiddenMembers: [],
  roles: [],
  teams: [],
  auditLogs: [],
};

const extractErrorMessage = (reason: unknown): string => {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  return '알 수 없는 오류';
};

const logResourceFailure = (key: DashboardResourceKey, reason: unknown) => {
  // 기존엔 Promise.all 이 silent reject 되어 로그가 아예 남지 않았다.
  // 최소 console.error 로 원인을 남겨 디버깅이 가능하게 한다.
  console.error(`[useDashboardResources] ${key} 로드 실패:`, reason);
};

export const useDashboardResources = (canManageMembers: boolean) => {
  const [resources, setResources] = useState<DashboardResources>(initialResources);
  const [errors, setErrors] = useState<DashboardResourceErrors>({});
  const [isLoading, setIsLoading] = useState(true);

  const applyResults = useCallback(
    (
      membersResult: PromiseSettledResult<Member[]>,
      rolesResult: PromiseSettledResult<RoleSummary[]>,
      teamsResult: PromiseSettledResult<TeamSummary[]>,
      auditLogsResult: PromiseSettledResult<AuditLogEntry[]>,
    ) => {
      const nextErrors: DashboardResourceErrors = {};

      const membersData = membersResult.status === 'fulfilled' ? membersResult.value : null;
      if (membersResult.status === 'rejected') {
        logResourceFailure('members', membersResult.reason);
        nextErrors.members = extractErrorMessage(membersResult.reason);
      }

      const rolesData = rolesResult.status === 'fulfilled' ? rolesResult.value : null;
      if (rolesResult.status === 'rejected') {
        logResourceFailure('roles', rolesResult.reason);
        nextErrors.roles = extractErrorMessage(rolesResult.reason);
      }

      const teamsData = teamsResult.status === 'fulfilled' ? teamsResult.value : null;
      if (teamsResult.status === 'rejected') {
        logResourceFailure('teams', teamsResult.reason);
        nextErrors.teams = extractErrorMessage(teamsResult.reason);
      }

      const auditLogData = auditLogsResult.status === 'fulfilled' ? auditLogsResult.value : null;
      if (auditLogsResult.status === 'rejected') {
        logResourceFailure('auditLogs', auditLogsResult.reason);
        nextErrors.auditLogs = extractErrorMessage(auditLogsResult.reason);
      }

      setResources((prev) => ({
        members: membersData
          ? membersData.filter((member) => member.isVisible !== false)
          : prev.members,
        hiddenMembers: membersData
          ? membersData.filter((member) => member.isVisible === false)
          : prev.hiddenMembers,
        roles: rolesData ?? prev.roles,
        teams: teamsData ?? prev.teams,
        auditLogs: auditLogData ?? prev.auditLogs,
      }));
      setErrors(nextErrors);
    },
    [],
  );

  const fetchAll = useCallback(async () => {
    const [membersResult, rolesResult, teamsResult, auditLogsResult] = await Promise.allSettled([
      getMembers({ includeLoginEmail: canManageMembers, includeHidden: canManageMembers }),
      getRoles(),
      getTeams(),
      canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
    ]);
    applyResults(membersResult, rolesResult, teamsResult, auditLogsResult);
  }, [applyResults, canManageMembers]);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      await fetchAll();
    } finally {
      setIsLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        await fetchAll();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [fetchAll]);

  return {
    ...resources,
    errors,
    isLoading,
    refreshData,
  };
};
