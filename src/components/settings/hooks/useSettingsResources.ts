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

const sortBanners = (items: SiteBanner[]) =>
  [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt));

const sortBadges = (items: Badge[]) =>
  [...items].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));

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

  // --- 낙관적 제거 (rollback 함수 반환) ---

  const removeAnnouncement = useCallback((id: string) => {
    let snapshot: AnnouncementItem[] = [];
    setResources((prev) => {
      snapshot = prev.announcements;
      return { ...prev, announcements: prev.announcements.filter((a) => a.id !== id) };
    });
    return () => setResources((prev) => ({ ...prev, announcements: snapshot }));
  }, []);

  const removeScheduleEvent = useCallback((id: string) => {
    let snapshot: ScheduleEventItem[] = [];
    setResources((prev) => {
      snapshot = prev.scheduleEvents;
      return { ...prev, scheduleEvents: prev.scheduleEvents.filter((e) => e.id !== id) };
    });
    return () => setResources((prev) => ({ ...prev, scheduleEvents: snapshot }));
  }, []);

  const removeSiteBanner = useCallback((id: string) => {
    let snapshot: SiteBanner[] = [];
    setResources((prev) => {
      snapshot = prev.siteBanners;
      return { ...prev, siteBanners: prev.siteBanners.filter((b) => b.id !== id) };
    });
    return () => setResources((prev) => ({ ...prev, siteBanners: snapshot }));
  }, []);

  const removeBadge = useCallback((id: string) => {
    let snapshotBadges: Badge[] = [];
    let snapshotMemberBadges: MemberBadge[] = [];
    setResources((prev) => {
      snapshotBadges = prev.badges;
      snapshotMemberBadges = prev.memberBadges;
      return {
        ...prev,
        badges: prev.badges.filter((b) => b.id !== id),
        memberBadges: prev.memberBadges.filter((mb) => mb.badgeId !== id),
      };
    });
    return () =>
      setResources((prev) => ({ ...prev, badges: snapshotBadges, memberBadges: snapshotMemberBadges }));
  }, []);

  // 배너 이동 낙관적 업데이트 (displayOrder swap, rollback 반환)
  const moveSiteBannerLocally = useCallback((id: string, direction: 'up' | 'down') => {
    let snapshot: SiteBanner[] = [];
    setResources((prev) => {
      snapshot = prev.siteBanners;
      const sorted = sortBanners(prev.siteBanners);
      const ci = sorted.findIndex((b) => b.id === id);
      const ti = direction === 'up' ? ci - 1 : ci + 1;
      if (ci === -1 || ti < 0 || ti >= sorted.length) return prev;
      const next = sorted.map((b) => ({ ...b }));
      [next[ci].displayOrder, next[ti].displayOrder] = [next[ti].displayOrder, next[ci].displayOrder];
      return { ...prev, siteBanners: sortBanners(next) };
    });
    return () => setResources((prev) => ({ ...prev, siteBanners: snapshot }));
  }, []);

  // --- Post-Confirm append (서버 반환값으로 즉시 state 추가) ---

  const appendAnnouncement = useCallback((item: AnnouncementItem) => {
    setResources((prev) => ({ ...prev, announcements: [item, ...prev.announcements] }));
  }, []);

  const appendScheduleEvent = useCallback((item: ScheduleEventItem) => {
    setResources((prev) => ({ ...prev, scheduleEvents: [...prev.scheduleEvents, item] }));
  }, []);

  const appendSiteBanner = useCallback((item: SiteBanner) => {
    setResources((prev) => ({ ...prev, siteBanners: sortBanners([...prev.siteBanners, item]) }));
  }, []);

  const appendSeason = useCallback((season: SeasonSummary) => {
    setResources((prev) => ({ ...prev, seasons: [...prev.seasons, season] }));
  }, []);

  const appendBadge = useCallback((badge: Badge) => {
    setResources((prev) => ({ ...prev, badges: sortBadges([...prev.badges, badge]) }));
  }, []);

  // --- Post-Confirm update ---

  const updateBadgeInState = useCallback((badge: Badge) => {
    setResources((prev) => ({
      ...prev,
      badges: sortBadges(prev.badges.map((b) => (b.id === badge.id ? badge : b))),
    }));
  }, []);

  const refreshMemberBadges = useCallback(async () => {
    const memberBadges = await getMemberBadges();
    setResources((prev) => ({ ...prev, memberBadges }));
  }, []);

  return {
    ...resources,
    isLoading,
    refreshData,
    activeSeason,
    badgeAwardCounts,
    // 낙관적 제거 (rollback 반환)
    removeAnnouncement,
    removeScheduleEvent,
    removeSiteBanner,
    removeBadge,
    moveSiteBannerLocally,
    // Post-Confirm append
    appendAnnouncement,
    appendScheduleEvent,
    appendSiteBanner,
    appendSeason,
    appendBadge,
    // Post-Confirm update
    updateBadgeInState,
    refreshMemberBadges,
  };
};
