import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useSettingsResources } from './useSettingsResources';
import type {
  AnnouncementItem,
  ScheduleEventItem,
  SiteBanner,
  Badge,
  MemberBadge,
} from '../../../types';

// Mock the API module
vi.mock('../../../lib/api/admin/settings', () => ({
  getAnnouncements: vi.fn(),
  getScheduleEvents: vi.fn(),
  getSiteBanners: vi.fn(),
  getBadges: vi.fn(),
  getMemberBadges: vi.fn(),
  getSeasons: vi.fn(),
}));

import {
  getAnnouncements,
  getScheduleEvents,
  getSiteBanners,
  getBadges,
  getMemberBadges,
  getSeasons,
} from '../../../lib/api/admin/settings';

const mockGetAnnouncements = getAnnouncements as ReturnType<typeof vi.fn>;
const mockGetScheduleEvents = getScheduleEvents as ReturnType<typeof vi.fn>;
const mockGetSiteBanners = getSiteBanners as ReturnType<typeof vi.fn>;
const mockGetBadges = getBadges as ReturnType<typeof vi.fn>;
const mockGetMemberBadges = getMemberBadges as ReturnType<typeof vi.fn>;
const mockGetSeasons = getSeasons as ReturnType<typeof vi.fn>;

// --- Factory helpers ---

const makeAnnouncement = (id: string, overrides: Partial<AnnouncementItem> = {}): AnnouncementItem => ({
  id,
  title: `공지 ${id}`,
  body: `내용 ${id}`,
  isPinned: false,
  isActive: true,
  createdAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

const makeScheduleEvent = (id: string, overrides: Partial<ScheduleEventItem> = {}): ScheduleEventItem => ({
  id,
  title: `일정 ${id}`,
  startAt: '2026-04-01T00:00:00Z',
  isActive: true,
  createdAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

const makeSiteBanner = (id: string, displayOrder: number, overrides: Partial<SiteBanner> = {}): SiteBanner => ({
  id,
  imageUrl: `https://example.com/${id}.jpg`,
  displayOrder,
  isActive: true,
  createdAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

const makeBadge = (id: string, overrides: Partial<Badge> = {}): Badge => ({
  id,
  code: `badge_${id}`,
  name: `뱃지 ${id}`,
  description: `설명 ${id}`,
  iconKey: 'star',
  ...overrides,
});

const makeMemberBadge = (id: string, badgeId: string, overrides: Partial<MemberBadge> = {}): MemberBadge => ({
  id,
  memberId: 'member-1',
  badgeId,
  badgeCode: `badge_${badgeId}`,
  badgeName: `뱃지 ${badgeId}`,
  badgeDescription: `설명 ${badgeId}`,
  iconKey: 'star',
  awardedAt: '2026-04-01T00:00:00Z',
  ...overrides,
});

// Default mock data
const defaultAnnouncements = [makeAnnouncement('a1'), makeAnnouncement('a2')];
const defaultScheduleEvents = [makeScheduleEvent('e1'), makeScheduleEvent('e2')];
const defaultSiteBanners = [makeSiteBanner('b1', 1), makeSiteBanner('b2', 2)];
const defaultBadges = [makeBadge('badge1'), makeBadge('badge2')];
const defaultMemberBadges = [
  makeMemberBadge('mb1', 'badge1'),
  makeMemberBadge('mb2', 'badge2'),
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAnnouncements.mockResolvedValue(defaultAnnouncements);
  mockGetScheduleEvents.mockResolvedValue(defaultScheduleEvents);
  mockGetSiteBanners.mockResolvedValue(defaultSiteBanners);
  mockGetBadges.mockResolvedValue(defaultBadges);
  mockGetMemberBadges.mockResolvedValue(defaultMemberBadges);
  mockGetSeasons.mockResolvedValue([]);
});

// --- Initial load ---

describe('useSettingsResources — initial load', () => {
  it('loads all resources on mount', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.announcements).toHaveLength(2);
    expect(result.current.scheduleEvents).toHaveLength(2);
    expect(result.current.siteBanners).toHaveLength(2);
    expect(result.current.badges).toHaveLength(2);
    expect(result.current.memberBadges).toHaveLength(2);
  });
});

// --- removeAnnouncement ---

describe('useSettingsResources — removeAnnouncement rollback (StrictMode regression)', () => {
  it('optimistically removes and fully restores on rollback under StrictMode', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.announcements).toHaveLength(2));

    let rollback!: () => void;
    act(() => {
      rollback = result.current.removeAnnouncement('a1');
    });

    expect(result.current.announcements).toHaveLength(1);
    expect(result.current.announcements[0].id).toBe('a2');

    // Rollback — must fully restore even under StrictMode (setter called twice)
    act(() => {
      rollback();
    });

    expect(result.current.announcements).toHaveLength(2);
    expect(result.current.announcements.map((a) => a.id).sort()).toEqual(['a1', 'a2']);
  });

  it('independent rollbacks for consecutive removals restore correct snapshots', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.announcements).toHaveLength(2));

    let rb1!: () => void;
    let rb2!: () => void;

    act(() => {
      rb1 = result.current.removeAnnouncement('a1');
    });
    expect(result.current.announcements).toHaveLength(1);

    act(() => {
      rb2 = result.current.removeAnnouncement('a2');
    });
    expect(result.current.announcements).toHaveLength(0);

    // Rollback second removal — restores the state before a2 was removed
    act(() => {
      rb2();
    });
    expect(result.current.announcements).toHaveLength(1);
    expect(result.current.announcements[0].id).toBe('a2');

    // Rollback first removal
    act(() => {
      rb1();
    });
    expect(result.current.announcements).toHaveLength(2);
  });
});

// --- removeScheduleEvent ---

describe('useSettingsResources — removeScheduleEvent rollback (StrictMode regression)', () => {
  it('optimistically removes event and fully restores on rollback', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.scheduleEvents).toHaveLength(2));

    let rollback!: () => void;
    act(() => {
      rollback = result.current.removeScheduleEvent('e1');
    });

    expect(result.current.scheduleEvents).toHaveLength(1);
    expect(result.current.scheduleEvents[0].id).toBe('e2');

    act(() => {
      rollback();
    });

    expect(result.current.scheduleEvents).toHaveLength(2);
    expect(result.current.scheduleEvents.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });
});

// --- removeSiteBanner ---

describe('useSettingsResources — removeSiteBanner rollback (StrictMode regression)', () => {
  it('optimistically removes banner and fully restores on rollback', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.siteBanners).toHaveLength(2));

    let rollback!: () => void;
    act(() => {
      rollback = result.current.removeSiteBanner('b1');
    });

    expect(result.current.siteBanners).toHaveLength(1);
    expect(result.current.siteBanners[0].id).toBe('b2');

    act(() => {
      rollback();
    });

    expect(result.current.siteBanners).toHaveLength(2);
    expect(result.current.siteBanners.map((b) => b.id).sort()).toEqual(['b1', 'b2']);
  });
});

// --- removeBadge ---

describe('useSettingsResources — removeBadge rollback (StrictMode regression)', () => {
  it('removes badge + memberBadges and restores both on rollback under StrictMode', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.badges).toHaveLength(2));

    expect(result.current.memberBadges).toHaveLength(2);

    let rollback!: () => void;
    act(() => {
      rollback = result.current.removeBadge('badge1');
    });

    // Both badges and memberBadges should be filtered
    expect(result.current.badges).toHaveLength(1);
    expect(result.current.badges[0].id).toBe('badge2');
    expect(result.current.memberBadges).toHaveLength(1);
    expect(result.current.memberBadges[0].badgeId).toBe('badge2');

    // Rollback — must restore BOTH badges and memberBadges
    act(() => {
      rollback();
    });

    expect(result.current.badges).toHaveLength(2);
    expect(result.current.badges.map((b) => b.id).sort()).toEqual(['badge1', 'badge2']);
    expect(result.current.memberBadges).toHaveLength(2);
    expect(result.current.memberBadges.map((mb) => mb.badgeId).sort()).toEqual(['badge1', 'badge2']);
  });

  it('rollback after removing different badges restores correct snapshots independently', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.badges).toHaveLength(2));

    let rb1!: () => void;
    let rb2!: () => void;

    act(() => {
      rb1 = result.current.removeBadge('badge1');
    });
    expect(result.current.badges).toHaveLength(1);
    expect(result.current.memberBadges).toHaveLength(1);

    act(() => {
      rb2 = result.current.removeBadge('badge2');
    });
    expect(result.current.badges).toHaveLength(0);
    expect(result.current.memberBadges).toHaveLength(0);

    // Rollback badge2 removal → restores the state just before badge2 was removed
    act(() => {
      rb2();
    });
    expect(result.current.badges).toHaveLength(1);
    expect(result.current.badges[0].id).toBe('badge2');
    expect(result.current.memberBadges).toHaveLength(1);

    // Rollback badge1 removal
    act(() => {
      rb1();
    });
    expect(result.current.badges).toHaveLength(2);
    expect(result.current.memberBadges).toHaveLength(2);
  });
});

// --- moveSiteBannerLocally ---

describe('useSettingsResources — moveSiteBannerLocally rollback (StrictMode regression)', () => {
  it('moves banner up and restores original order on rollback', async () => {
    const { result } = renderHook(() => useSettingsResources(), { wrapper: StrictMode });

    await waitFor(() => expect(result.current.siteBanners).toHaveLength(2));

    // b1 has displayOrder=1, b2 has displayOrder=2 → sorted: [b1, b2]
    expect(result.current.siteBanners[0].id).toBe('b1');
    expect(result.current.siteBanners[1].id).toBe('b2');

    let rollback!: () => void;
    act(() => {
      // Move b2 up (b2 becomes order 1, b1 becomes order 2)
      rollback = result.current.moveSiteBannerLocally('b2', 'up');
    });

    expect(result.current.siteBanners[0].id).toBe('b2');
    expect(result.current.siteBanners[1].id).toBe('b1');

    // Rollback — must restore original order
    act(() => {
      rollback();
    });

    expect(result.current.siteBanners[0].id).toBe('b1');
    expect(result.current.siteBanners[1].id).toBe('b2');
  });
});
