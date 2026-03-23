import { describe, expect, it } from 'vitest';
import type { ActivityLog } from '../../types';
import {
    filterEffectiveActivityLogs,
    filterLogsWithinRange,
    isEffectiveActivityLog,
    toLocalDayKey,
} from './activityLogs';

const baseLog: ActivityLog = {
    id: 'log_1',
    memberId: 'member_1',
    categoryId: 'category_1',
    pointDelta: 10,
    timestamp: '2026-03-14T09:00:00.000Z',
    recordStatus: 'confirmed',
};

describe('activity log domain helpers', () => {
    it('detects only non-reversed effective logs', () => {
        expect(isEffectiveActivityLog(baseLog)).toBe(true);
        expect(isEffectiveActivityLog({ ...baseLog, isReversal: true })).toBe(false);
        expect(isEffectiveActivityLog({ ...baseLog, recordStatus: 'reversed' })).toBe(false);
    });

    it('filters effective logs from mixed log arrays', () => {
        const logs = [
            baseLog,
            { ...baseLog, id: 'log_2', isReversal: true },
            { ...baseLog, id: 'log_3', recordStatus: 'reversed' as const },
        ];

        expect(filterEffectiveActivityLogs(logs)).toEqual([baseLog]);
    });

    it('builds local day keys in local calendar format', () => {
        expect(toLocalDayKey('2026-03-14T23:59:00.000Z')).toMatch(/2026-03-\d{2}/);
    });

    it('filters logs within an inclusive range', () => {
        const logs = [
            { ...baseLog, id: 'a', timestamp: '2026-03-01T00:00:00.000Z' },
            { ...baseLog, id: 'b', timestamp: '2026-03-15T12:00:00.000Z' },
            { ...baseLog, id: 'c', timestamp: '2026-04-01T00:00:00.000Z' },
        ];

        expect(
            filterLogsWithinRange(
                logs,
                new Date('2026-03-01T00:00:00.000Z'),
                new Date('2026-03-31T23:59:59.000Z'),
            ).map((log) => log.id),
        ).toEqual(['a', 'b']);
    });
});
