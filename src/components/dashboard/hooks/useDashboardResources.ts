import { useCallback, useEffect, useState } from 'react';
import type { AuditLogEntry, Member, RoleSummary, TeamSummary } from '../../../types';
import { getAuditLogs, getMembers } from '../../../lib/api/admin/members';
import { getRoles } from '../../../lib/api/admin/roles';
import { getTeams } from '../../../lib/api/admin/teams';

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

export const useDashboardResources = (canManageMembers: boolean) => {
  const [resources, setResources] = useState<DashboardResources>(initialResources);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    const [membersData, rolesData, teamsData, auditLogData] = await Promise.all([
      getMembers({ includeLoginEmail: canManageMembers, includeHidden: canManageMembers }),
      getRoles(),
      getTeams(),
      canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
    ]);

    setResources({
      members: membersData.filter((member) => member.isVisible !== false),
      hiddenMembers: membersData.filter((member) => member.isVisible === false),
      roles: rolesData,
      teams: teamsData,
      auditLogs: auditLogData,
    });
    setIsLoading(false);
  }, [canManageMembers]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const [membersData, rolesData, teamsData, auditLogData] = await Promise.all([
        getMembers({ includeLoginEmail: canManageMembers, includeHidden: canManageMembers }),
        getRoles(),
        getTeams(),
        canManageMembers ? getAuditLogs({ entityType: 'member', limit: 80 }) : Promise.resolve([]),
      ]);

      if (!isMounted) {
        return;
      }

      setResources({
        members: membersData.filter((member) => member.isVisible !== false),
        hiddenMembers: membersData.filter((member) => member.isVisible === false),
        roles: rolesData,
        teams: teamsData,
        auditLogs: auditLogData,
      });
      setIsLoading(false);
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [canManageMembers]);

  return {
    ...resources,
    isLoading,
    refreshData,
  };
};
