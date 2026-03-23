import type {
    ActivityLog,
    Badge,
    BadgeCriteria,
    BadgeEvaluationScope,
    BadgeTone,
    MemberBadge,
} from '../types';
import { filterEffectiveActivityLogs, toLocalDayKey } from './domain/activityLogs';

const bandiMascotUrl = new URL('../../반디.png', import.meta.url).href;
const didiMascotUrl = new URL('../../디디.png', import.meta.url).href;
const schoolMascotUrl = new URL('../../반디스쿨 로고1.png', import.meta.url).href;

type BadgeArtworkTarget = Pick<Badge, 'iconKey' | 'imageUrl'> | Pick<MemberBadge, 'iconKey' | 'imageUrl'>;

export type BadgeMetrics = {
    activityCount: number;
    attendanceCount: number;
    spotlightCount: number;
    uniqueActivityTypeCount: number;
    evidenceCount: number;
    activeDayCount: number;
    totalPoints: number;
};

type BadgeRequirementKey = keyof BadgeCriteria;

const badgeRequirementDefinitions: Array<{
    key: BadgeRequirementKey;
    label: string;
    unit: string;
}> = [
    { key: 'activityCount', label: '활동 기록', unit: '건' },
    { key: 'attendanceCount', label: '출석 계열', unit: '건' },
    { key: 'spotlightCount', label: '발표·고점수', unit: '회' },
    { key: 'uniqueActivityTypeCount', label: '활동 유형', unit: '종류' },
    { key: 'evidenceCount', label: '증빙 기록', unit: '건' },
    { key: 'activeDayCount', label: '활동 일수', unit: '일' },
    { key: 'totalPoints', label: '누적 점수', unit: '점' },
];

export const badgeArtworkOptions: Array<{ key: string; label: string; previewUrl: string }> = [
    { key: 'bandi-core', label: '반디 코어', previewUrl: bandiMascotUrl },
    { key: 'bandi-orbit', label: '반디 오빗', previewUrl: bandiMascotUrl },
    { key: 'school-signal', label: '스쿨 시그널', previewUrl: schoolMascotUrl },
    { key: 'bandi-flash', label: '반디 플래시', previewUrl: bandiMascotUrl },
    { key: 'didi-toolkit', label: '디디 툴킷', previewUrl: didiMascotUrl },
    { key: 'didi-archive', label: '디디 아카이브', previewUrl: didiMascotUrl },
];

export const badgeToneLabels: Record<BadgeTone, string> = {
    gold: '골드',
    sky: '스카이',
    emerald: '에메랄드',
    rose: '로즈',
};

export const badgeScopeLabels: Record<BadgeEvaluationScope, string> = {
    season: '시즌 누적',
    lifetime: '전체 누적',
};

export const emptyBadgeCriteria = (): BadgeCriteria => ({});

export const normalizeBadgeCode = (value: string) =>
    value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

export const normalizeBadgeCriteria = (value?: BadgeCriteria | null): BadgeCriteria => {
    const criteria = value ?? {};
    const normalizedEntries = Object.entries(criteria).flatMap(([key, rawValue]) => {
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
            return [];
        }

        const normalizedValue = Math.max(0, Math.floor(rawValue));
        if (normalizedValue <= 0) {
            return [];
        }

        return [[key, normalizedValue] as const];
    });

    return Object.fromEntries(normalizedEntries) as BadgeCriteria;
};

export const hasBadgeCriteria = (criteria?: BadgeCriteria | null) =>
    Object.keys(normalizeBadgeCriteria(criteria)).length > 0;

export const getBadgeArtworkUrl = (badge: BadgeArtworkTarget) => {
    if (badge.imageUrl?.trim()) {
        return badge.imageUrl.trim();
    }

    const preset = badgeArtworkOptions.find((option) => option.key === badge.iconKey);
    return preset?.previewUrl ?? bandiMascotUrl;
};

export const computeBadgeMetrics = (logs: ActivityLog[]): BadgeMetrics => {
    const effectiveLogs = filterEffectiveActivityLogs(logs);

    return {
        activityCount: effectiveLogs.length,
        attendanceCount: effectiveLogs.filter((log) => /(출석|참석|지각|불참|attendance|present|late|absent)/i.test(log.categoryName ?? log.reason ?? '')).length,
        spotlightCount: effectiveLogs.filter((log) => log.pointDelta >= 20 || /(발표|세션|리딩|presentation|session|reading)/i.test(log.categoryName ?? log.reason ?? '')).length,
        uniqueActivityTypeCount: new Set(effectiveLogs.map((log) => log.categoryName ?? log.categoryId)).size,
        evidenceCount: effectiveLogs.filter((log) => Boolean(log.evidenceUrl)).length,
        activeDayCount: new Set(effectiveLogs.map((log) => toLocalDayKey(log.timestamp))).size,
        totalPoints: effectiveLogs.reduce((sum, log) => sum + log.pointDelta, 0),
    };
};

export const isBadgeEarnedByMetrics = (criteria: BadgeCriteria | undefined, metrics: BadgeMetrics) => {
    const normalizedCriteria = normalizeBadgeCriteria(criteria);
    const requirementKeys = Object.keys(normalizedCriteria) as BadgeRequirementKey[];

    if (requirementKeys.length === 0) {
        return false;
    }

    return requirementKeys.every((key) => {
        const target = normalizedCriteria[key] ?? 0;
        return metrics[key] >= target;
    });
};

export const getBadgeRequirementEntries = (criteria: BadgeCriteria | undefined, metrics: BadgeMetrics) => {
    const normalizedCriteria = normalizeBadgeCriteria(criteria);

    return badgeRequirementDefinitions.flatMap((definition) => {
        const target = normalizedCriteria[definition.key];
        if (!target) {
            return [];
        }

        const current = metrics[definition.key];
        return [{
            key: definition.key,
            label: definition.label,
            current,
            target,
            unit: definition.unit,
            satisfied: current >= target,
        }];
    });
};

export const getBadgeCriteriaSummary = (criteria: BadgeCriteria | undefined, scope: BadgeEvaluationScope = 'season') => {
    const entries = getBadgeRequirementEntries(criteria, {
        activityCount: 0,
        attendanceCount: 0,
        spotlightCount: 0,
        uniqueActivityTypeCount: 0,
        evidenceCount: 0,
        activeDayCount: 0,
        totalPoints: 0,
    });

    if (entries.length === 0) {
        return `${badgeScopeLabels[scope]} 기준 없음`;
    }

    return `${badgeScopeLabels[scope]} · ${entries.map((entry) => `${entry.label} ${entry.target}${entry.unit}`).join(' · ')}`;
};
