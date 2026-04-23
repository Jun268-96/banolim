import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface Snapshot {
  announcements?: AnnouncementItem[];
  scheduleEvents?: ScheduleEventItem[];
  siteBanners?: SiteBanner[];
  badges?: Badge[];
  memberBadges?: MemberBadge[];
}

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

  // ★ snapshot은 setter 바깥 ref에 보관 → React StrictMode의 setter 2회 호출에도 안전
  const rollbackRef = useRef<Map<string, Snapshot>>(new Map());

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
    const token = `announcement:${id}:${Date.now()}:${Math.random()}`;
    setResources((prev) => {
      // 첫 저장만 유지 (StrictMode 2회 호출 시 덮어쓰기 방지)
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, { announcements: prev.announcements });
      }
      return { ...prev, announcements: prev.announcements.filter((a) => a.id !== id) };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.announcements) return;
      setResources((prev) => ({ ...prev, announcements: snap.announcements! }));
    };
  }, []);

  const removeScheduleEvent = useCallback((id: string) => {
    const token = `scheduleEvent:${id}:${Date.now()}:${Math.random()}`;
    setResources((prev) => {
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, { scheduleEvents: prev.scheduleEvents });
      }
      return { ...prev, scheduleEvents: prev.scheduleEvents.filter((e) => e.id !== id) };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.scheduleEvents) return;
      setResources((prev) => ({ ...prev, scheduleEvents: snap.scheduleEvents! }));
    };
  }, []);

  const removeSiteBanner = useCallback((id: string) => {
    const token = `siteBanner:${id}:${Date.now()}:${Math.random()}`;
    setResources((prev) => {
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, { siteBanners: prev.siteBanners });
      }
      return { ...prev, siteBanners: prev.siteBanners.filter((b) => b.id !== id) };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.siteBanners) return;
      setResources((prev) => ({ ...prev, siteBanners: snap.siteBanners! }));
    };
  }, []);

  const removeBadge = useCallback((id: string) => {
    const token = `badge:${id}:${Date.now()}:${Math.random()}`;
    setResources((prev) => {
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, { badges: prev.badges, memberBadges: prev.memberBadges });
      }
      return {
        ...prev,
        badges: prev.badges.filter((b) => b.id !== id),
        memberBadges: prev.memberBadges.filter((mb) => mb.badgeId !== id),
      };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.badges || !snap?.memberBadges) return;
      setResources((prev) => ({ ...prev, badges: snap.badges!, memberBadges: snap.memberBadges! }));
    };
  }, []);

  // 배너 이동 낙관적 업데이트 (displayOrder swap, rollback 반환)
  const moveSiteBannerLocally = useCallback((id: string, direction: 'up' | 'down') => {
    const token = `moveBanner:${id}:${Date.now()}:${Math.random()}`;
    setResources((prev) => {
      if (!rollbackRef.current.has(token)) {
        rollbackRef.current.set(token, { siteBanners: prev.siteBanners });
      }
      const sorted = sortBanners(prev.siteBanners);
      const ci = sorted.findIndex((b) => b.id === id);
      const ti = direction === 'up' ? ci - 1 : ci + 1;
      if (ci === -1 || ti < 0 || ti >= sorted.length) return prev;
      const next = sorted.map((b) => ({ ...b }));
      [next[ci].displayOrder, next[ti].displayOrder] = [next[ti].displayOrder, next[ci].displayOrder];
      return { ...prev, siteBanners: sortBanners(next) };
    });
    return () => {
      const snap = rollbackRef.current.get(token);
      rollbackRef.current.delete(token);
      if (!snap?.siteBanners) return;
      setResources((prev) => ({ ...prev, siteBanners: snap.siteBanners! }));
    };
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
