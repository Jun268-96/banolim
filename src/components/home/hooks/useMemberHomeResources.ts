import { useCallback, useEffect, useState } from 'react';
import type {
  ActivityLog,
  AnnouncementItem,
  Badge,
  CorrectionRequest,
  Member,
  MemberBadge,
  RecapSnapshot,
  ScheduleEventItem,
  SeasonSummary,
} from '../../../types';
import {
  getAnnouncements,
  getBadges,
  getCorrectionRequests,
  getCurrentSeason,
  getMyActivityLogs,
  getMyMemberBadges,
  getMyMemberOverview,
  getRecapSnapshots,
  getScheduleEvents,
} from '../../../lib/api/member/self';

interface MemberHomeResourcesState {
  season: SeasonSummary | null;
  member: Member | null;
  logs: ActivityLog[];
  badgeCatalog: Badge[];
  memberBadges: MemberBadge[];
  recapSnapshots: RecapSnapshot[];
  announcements: AnnouncementItem[];
  scheduleEvents: ScheduleEventItem[];
  correctionRequests: CorrectionRequest[];
}

const initialState: MemberHomeResourcesState = {
  season: null,
  member: null,
  logs: [],
  badgeCatalog: [],
  memberBadges: [],
  recapSnapshots: [],
  announcements: [],
  scheduleEvents: [],
  correctionRequests: [],
};

export const useMemberHomeResources = (memberId?: string | null) => {
  const [resources, setResources] = useState<MemberHomeResourcesState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setIsLoading(true);

    const [
      seasonData,
      memberData,
      logData,
      badgeCatalogData,
      memberBadgeData,
      correctionRequestData,
      announcementData,
      scheduleData,
    ] = await Promise.all([
      getCurrentSeason(),
      getMyMemberOverview(memberId ?? null),
      getMyActivityLogs(memberId ?? null),
      getBadges(),
      getMyMemberBadges(memberId ?? null),
      getCorrectionRequests({ requesterMemberId: memberId ?? null }),
      getAnnouncements(),
      getScheduleEvents(),
    ]);

    const recapSnapshotData = memberData
      ? await getRecapSnapshots({ scope: 'member', memberId: memberData.id, limit: 4 })
      : [];

    setResources({
      season: seasonData,
      member: memberData,
      logs: logData,
      badgeCatalog: badgeCatalogData,
      memberBadges: memberBadgeData,
      recapSnapshots: recapSnapshotData,
      announcements: announcementData,
      scheduleEvents: scheduleData,
      correctionRequests: correctionRequestData,
    });
    setIsLoading(false);
  }, [memberId]);

  const refreshCorrectionRequests = useCallback(async () => {
    const nextRequests = await getCorrectionRequests({ requesterMemberId: memberId ?? null });
    setResources((current) => ({
      ...current,
      correctionRequests: nextRequests,
    }));
    return nextRequests;
  }, [memberId]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const [
        seasonData,
        memberData,
        logData,
        badgeCatalogData,
        memberBadgeData,
        correctionRequestData,
        announcementData,
        scheduleData,
      ] = await Promise.all([
        getCurrentSeason(),
        getMyMemberOverview(memberId ?? null),
        getMyActivityLogs(memberId ?? null),
        getBadges(),
        getMyMemberBadges(memberId ?? null),
        getCorrectionRequests({ requesterMemberId: memberId ?? null }),
        getAnnouncements(),
        getScheduleEvents(),
      ]);

      const recapSnapshotData = memberData
        ? await getRecapSnapshots({ scope: 'member', memberId: memberData.id, limit: 4 })
        : [];

      if (!isMounted) {
        return;
      }

      setResources({
        season: seasonData,
        member: memberData,
        logs: logData,
        badgeCatalog: badgeCatalogData,
        memberBadges: memberBadgeData,
        recapSnapshots: recapSnapshotData,
        announcements: announcementData,
        scheduleEvents: scheduleData,
        correctionRequests: correctionRequestData,
      });
      setIsLoading(false);
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [memberId]);

  return {
    ...resources,
    isLoading,
    refreshData,
    refreshCorrectionRequests,
  };
};
