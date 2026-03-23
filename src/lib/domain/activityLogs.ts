import type { ActivityLog } from '../../types';

export const isEffectiveActivityLog = (log: ActivityLog) =>
    !log.isReversal && log.recordStatus !== 'reversed';

export const filterEffectiveActivityLogs = (logs: ActivityLog[]) =>
    logs.filter(isEffectiveActivityLog);

export const toLocalDayKey = (value: string) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const isTimestampWithinRange = (value: string, start: Date, end: Date) => {
    const target = new Date(value);
    return target >= start && target <= end;
};

export const filterLogsWithinRange = (
    logs: ActivityLog[],
    start: Date,
    end: Date,
) => logs.filter((log) => isTimestampWithinRange(log.timestamp, start, end));
