import { describe, expect, it } from 'vitest';
import {
  computeBadgeMetrics,
  getBadgeCriteriaSummary,
  getBadgeRequirementEntries,
  hasBadgeCriteria,
  isBadgeEarnedByMetrics,
  normalizeBadgeCode,
  normalizeBadgeCriteria,
} from './badges';
import type { ActivityLog } from '../types';

const sampleLogs: ActivityLog[] = [
  {
    id: 'log-1',
    recordId: 'record-1',
    timestamp: '2026-03-01T09:00:00.000Z',
    memberId: 'member-1',
    categoryId: 'attendance',
    categoryName: '정기모임 출석',
    pointDelta: 10,
    reason: '정기모임 출석',
    recordStatus: 'confirmed',
  },
  {
    id: 'log-2',
    recordId: 'record-2',
    timestamp: '2026-03-02T09:00:00.000Z',
    memberId: 'member-1',
    categoryId: 'presentation',
    categoryName: '발표',
    pointDelta: 30,
    reason: '발표',
    evidenceUrl: 'https://example.com/slides',
    recordStatus: 'confirmed',
  },
  {
    id: 'log-3',
    recordId: 'record-3',
    timestamp: '2026-03-02T10:00:00.000Z',
    memberId: 'member-1',
    categoryId: 'study',
    categoryName: '스터디 참여',
    pointDelta: 15,
    reason: '스터디 참여',
    evidenceUrl: 'https://example.com/note',
    recordStatus: 'confirmed',
  },
  {
    id: 'log-4',
    recordId: 'record-4',
    timestamp: '2026-03-03T09:00:00.000Z',
    memberId: 'member-1',
    categoryId: 'attendance-late',
    categoryName: '지각',
    pointDelta: -5,
    reason: '지각',
    recordStatus: 'confirmed',
  },
  {
    id: 'log-5',
    recordId: 'record-5',
    timestamp: '2026-03-04T09:00:00.000Z',
    memberId: 'member-1',
    categoryId: 'ops',
    categoryName: '운영 기여',
    pointDelta: 5,
    reason: '운영 기여',
    recordStatus: 'reversed',
  },
  {
    id: 'log-6',
    recordId: 'record-2',
    timestamp: '2026-03-05T09:00:00.000Z',
    memberId: 'member-1',
    categoryId: 'presentation',
    categoryName: '발표',
    pointDelta: -30,
    reason: '기록 취소',
    isReversal: true,
    reversalOf: 'log-2',
    recordStatus: 'reversed',
  },
];

describe('badge helpers', () => {
  it('normalizes badge codes into snake case ids', () => {
    expect(normalizeBadgeCode('  발표 마에스트로 2026 ')).toBe('2026');
    expect(normalizeBadgeCode('steady rhythm')).toBe('steady_rhythm');
    expect(normalizeBadgeCode('Badge__Code!!')).toBe('badge_code');
  });

  it('removes invalid or zero-valued criteria', () => {
    expect(normalizeBadgeCriteria({
      activityCount: 3.9,
      attendanceCount: 0,
      totalPoints: -10,
      spotlightCount: Number.NaN,
    })).toEqual({
      activityCount: 3,
    });
  });

  it('detects whether a badge has effective criteria', () => {
    expect(hasBadgeCriteria({})).toBe(false);
    expect(hasBadgeCriteria({ attendanceCount: 0 })).toBe(false);
    expect(hasBadgeCriteria({ attendanceCount: 2 })).toBe(true);
  });

  it('computes metrics using only effective logs', () => {
    expect(computeBadgeMetrics(sampleLogs)).toEqual({
      activityCount: 4,
      attendanceCount: 2,
      spotlightCount: 1,
      uniqueActivityTypeCount: 4,
      evidenceCount: 2,
      activeDayCount: 3,
      totalPoints: 50,
    });
  });

  it('evaluates earned state against all configured criteria', () => {
    const metrics = computeBadgeMetrics(sampleLogs);

    expect(isBadgeEarnedByMetrics({ activityCount: 4, attendanceCount: 2 }, metrics)).toBe(true);
    expect(isBadgeEarnedByMetrics({ activityCount: 5 }, metrics)).toBe(false);
    expect(isBadgeEarnedByMetrics({}, metrics)).toBe(false);
  });

  it('builds requirement progress entries for visible criteria only', () => {
    const entries = getBadgeRequirementEntries(
      { activityCount: 4, evidenceCount: 3 },
      computeBadgeMetrics(sampleLogs),
    );

    expect(entries).toEqual([
      expect.objectContaining({
        key: 'activityCount',
        current: 4,
        target: 4,
        satisfied: true,
      }),
      expect.objectContaining({
        key: 'evidenceCount',
        current: 2,
        target: 3,
        satisfied: false,
      }),
    ]);
  });

  it('summarizes criteria with the configured evaluation scope', () => {
    expect(getBadgeCriteriaSummary({ activeDayCount: 3, totalPoints: 40 }, 'season')).toBe('시즌 누적 · 활동 일수 3일 · 누적 점수 40점');
    expect(getBadgeCriteriaSummary({}, 'lifetime')).toBe('전체 누적 기준 없음');
  });
});
