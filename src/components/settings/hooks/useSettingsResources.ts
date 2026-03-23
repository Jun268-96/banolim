import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AnnouncementItem,
  Badge,
  MemberBadge,
  ScheduleEventItem,
  SeasonSummary,
  SiteBanner,
} from '../../../types';
import {
  getAnnouncements,
  getBadges,
  getMemberBadges,
  getScheduleEvents,
  getSeasons,
  getSiteBanners,
} from '../../../lib/api/admin/settings';

interface SettingsResourcesState {
  seasons: SeasonSummary[];
  announcements: AnnouncementItem[];
  scheduleEvents: ScheduleEventItem[];
  siteBanners: SiteBanner[];
  badges: Badge[];
  memberBadges: MemberBadge[];
}

const initialState: SettingsResourcesState = {
  seasons: [],
  announcements: [],
  scheduleEvents: [],
  siteBanners: [],
  badges: [],
  memberBadges: [],
};

export const useSettingsResources = () => {
  const [resources, setResources] = useState<SettingsResourcesState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setIsLoading(true);

    const [seasons, announcements, scheduleEvents, siteBanners, badges, memberBadges] = await Promise.all([
      getSeasons(),
      getAnnouncements(),
      getScheduleEvents(),
      getSiteBanners(),
      getBadges({ includeInactive: true }),
      getMemberBadges(),
    ]);

    setResources({
      seasons,
      announcements,
      scheduleEvents,
      siteBanners,
      badges,
      memberBadges,
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      const [seasons, announcements, scheduleEvents, siteBanners, badges, memberBadges] = await Promise.all([
        getSeasons(),
        getAnnouncements(),
        getScheduleEvents(),
        getSiteBanners(),
        getBadges({ includeInactive: true }),
        getMemberBadges(),
      ]);

      if (!isMounted) {
        return;
      }

      setResources({
        seasons,
        announcements,
        scheduleEvents,
        siteBanners,
        badges,
        memberBadges,
      });
      setIsLoading(false);
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeSeason = useMemo(
    () =>
      [...resources.seasons]
        .filter((season) => season.status === 'active')
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null,
    [resources.seasons],
  );

  const badgeAwardCounts = useMemo(
    () =>
      resources.memberBadges.reduce<Record<string, number>>((acc, badge) => {
        acc[badge.badgeId] = (acc[badge.badgeId] ?? 0) + 1;
        return acc;
      }, {}),
    [resources.memberBadges],
  );

  return {
    ...resources,
    isLoading,
    refreshData,
    activeSeason,
    badgeAwardCounts,
  };
};
