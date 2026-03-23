import type {
    ActivityLog,
    Member,
    MemberBadge,
    RecapSnapshotDraft,
    RecapSnapshotHighlight,
    RecapSnapshotPeriod,
    SeasonSummary,
} from '../types';
import { isTimestampWithinRange, toLocalDayKey } from './domain/activityLogs';

const formatMonthLabel = (value: Date) =>
    new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(value);

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

export const buildRecapScope = (periodType: RecapSnapshotPeriod, season: SeasonSummary | null) => {
    const now = new Date();

    if (periodType === 'month') {
        return {
            title: '월간 리캡',
            subtitle: formatMonthLabel(now),
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        };
    }

    if (season) {
        return {
            title: '시즌 리캡',
            subtitle: season.name,
            start: new Date(`${season.startDate}T00:00:00`),
            end: season.endDate ? new Date(`${season.endDate}T23:59:59`) : now,
        };
    }

    return {
        title: '시즌 리캡',
        subtitle: '전체 기록 기준',
        start: new Date(0),
        end: now,
    };
};

const buildHighlight = (label: string, value: string, description: string): RecapSnapshotHighlight => ({
    label,
    value,
    description,
});

export const buildMemberRecapSnapshotDraft = ({
    member,
    season,
    logs,
    memberBadges,
    periodType,
}: {
    member: Member;
    season: SeasonSummary | null;
    logs: ActivityLog[];
    memberBadges: MemberBadge[];
    periodType: RecapSnapshotPeriod;
}): RecapSnapshotDraft => {
    const scope = buildRecapScope(periodType, season);
    const scopeLogs = logs.filter((log) => isTimestampWithinRange(log.timestamp, scope.start, scope.end));
    const scopeBadges = memberBadges.filter((badge) => isTimestampWithinRange(badge.awardedAt, scope.start, scope.end));

    const totalPoints = scopeLogs.reduce((sum, log) => sum + log.pointDelta, 0);
    const activeDays = new Set(scopeLogs.map((log) => toLocalDayKey(log.timestamp))).size;
    const evidenceCount = scopeLogs.filter((log) => Boolean(log.evidenceUrl)).length;
    const positiveLogs = scopeLogs.filter((log) => log.pointDelta > 0).length;
    const contributionRate = scopeLogs.length > 0 ? Math.round((positiveLogs / scopeLogs.length) * 100) : 0;

    const topCategory = Object.values(
        scopeLogs.reduce<Record<string, { name: string; count: number; delta: number }>>((acc, log) => {
            const key = log.categoryId;
            const current = acc[key] ?? {
                name: log.categoryName ?? '알 수 없는 규칙',
                count: 0,
                delta: 0,
            };

            acc[key] = {
                name: current.name,
                count: current.count + 1,
                delta: current.delta + log.pointDelta,
            };

            return acc;
        }, {}),
    ).sort((a, b) => b.count - a.count || b.delta - a.delta)[0] ?? null;

    const highlightLog = [...scopeLogs]
        .sort((a, b) => b.pointDelta - a.pointDelta || a.timestamp.localeCompare(b.timestamp))[0] ?? null;

    const bestDayEntry = Object.entries(
        scopeLogs.reduce<Record<string, number>>((acc, log) => {
            const key = toLocalDayKey(log.timestamp);
            acc[key] = (acc[key] ?? 0) + log.pointDelta;
            return acc;
        }, {}),
    ).sort((a, b) => b[1] - a[1])[0] ?? null;

    const bestDayValue = bestDayEntry ? `${formatDate(bestDayEntry[0])} · ${bestDayEntry[1] > 0 ? '+' : ''}${bestDayEntry[1]}점` : '아직 하이라이트 없음';
    const bestDayNote = bestDayEntry
        ? `${formatDate(bestDayEntry[0])}에 하루 최고 흐름이 기록됐습니다.`
        : '다음 활동이 쌓이면 하루 최고 장면이 자동으로 정리됩니다.';

    return {
        scope: 'member',
        periodType,
        title: `${member.name}님의 ${scope.title}`,
        subtitle: scope.subtitle,
        summary: topCategory
            ? `${topCategory.name} 활동이 가장 자주 등장했고, 총 ${scopeLogs.length}건의 기록이 쌓였습니다.`
            : `${member.name}님의 활동 리캡을 저장했습니다.`,
        badgeLabel: periodType === 'month' ? '월간 성장 카드' : '시즌 성장 카드',
        note: highlightLog
            ? `${formatDate(highlightLog.timestamp)} 기록이 대표 장면으로 저장됐습니다.`
            : '다음 활동이 쌓이면 대표 장면이 더 선명해집니다.',
        startsAt: scope.start.toISOString(),
        endsAt: scope.end.toISOString(),
        memberId: member.id,
        memberName: member.name,
        seasonId: season?.id ?? null,
        payload: {
            theme: 'member',
            mascotKey: scopeBadges.length > 0 ? 'bandi' : 'didi',
            stats: [
                { label: '총점', value: `${totalPoints > 0 ? '+' : ''}${totalPoints}점` },
                { label: '활동 수', value: `${scopeLogs.length}건` },
                { label: '활동 일수', value: `${activeDays}일` },
                { label: '신규 배지', value: `${scopeBadges.length}개` },
            ],
            highlights: [
                buildHighlight(
                    '대표 활동',
                    topCategory ? topCategory.name : '아직 집계 전',
                    topCategory
                        ? `${topCategory.count}회 · 총 ${topCategory.delta > 0 ? '+' : ''}${topCategory.delta}점`
                        : '활동이 누적되면 대표 규칙이 자동으로 선정됩니다.',
                ),
                buildHighlight(
                    '대표 장면',
                    highlightLog?.categoryName ?? '기록 준비 중',
                    highlightLog
                        ? `${formatDate(highlightLog.timestamp)} · ${highlightLog.pointDelta > 0 ? '+' : ''}${highlightLog.pointDelta}점`
                        : '아직 최고 기여 장면이 없습니다.',
                ),
                buildHighlight(
                    '증빙 기록',
                    `${evidenceCount}건`,
                    `전체 기록의 ${contributionRate}%가 플러스 점수 활동이었습니다.`,
                ),
                buildHighlight('최고 활동일', bestDayValue, bestDayNote),
            ],
        },
    };
};

export const buildOverallRecapSnapshotDraft = ({
    members,
    season,
    logs,
    memberBadges,
    periodType,
}: {
    members: Member[];
    season: SeasonSummary | null;
    logs: ActivityLog[];
    memberBadges: MemberBadge[];
    periodType: RecapSnapshotPeriod;
}): RecapSnapshotDraft => {
    const scope = buildRecapScope(periodType, season);
    const scopeLogs = logs.filter((log) => isTimestampWithinRange(log.timestamp, scope.start, scope.end));
    const scopeBadges = memberBadges.filter((badge) => isTimestampWithinRange(badge.awardedAt, scope.start, scope.end));

    const totalPoints = scopeLogs.reduce((sum, log) => sum + log.pointDelta, 0);
    const uniqueMemberCount = new Set(scopeLogs.map((log) => log.memberId)).size;

    const memberDeltaRows = Object.entries(
        scopeLogs.reduce<Record<string, { name: string; delta: number; count: number }>>((acc, log) => {
            const current = acc[log.memberId] ?? {
                name: members.find((member) => member.id === log.memberId)?.name ?? log.memberName ?? '알 수 없는 회원',
                delta: 0,
                count: 0,
            };

            acc[log.memberId] = {
                name: current.name,
                delta: current.delta + log.pointDelta,
                count: current.count + 1,
            };

            return acc;
        }, {}),
    )
        .map(([memberId, value]) => ({
            memberId,
            ...value,
        }))
        .sort((a, b) => b.delta - a.delta || b.count - a.count);

    const teamRows = Object.entries(
        scopeLogs.reduce<Record<string, { name: string; delta: number; count: number }>>((acc, log) => {
            const member = members.find((entry) => entry.id === log.memberId);
            const key = member?.teamName ?? '미지정';
            const current = acc[key] ?? {
                name: key,
                delta: 0,
                count: 0,
            };

            acc[key] = {
                name: current.name,
                delta: current.delta + log.pointDelta,
                count: current.count + 1,
            };

            return acc;
        }, {}),
    )
        .map(([teamName, value]) => ({
            teamName,
            ...value,
        }))
        .sort((a, b) => b.delta - a.delta || b.count - a.count);

    const topCategory = Object.values(
        scopeLogs.reduce<Record<string, { name: string; count: number; delta: number }>>((acc, log) => {
            const key = log.categoryId;
            const current = acc[key] ?? {
                name: log.categoryName ?? '알 수 없는 규칙',
                count: 0,
                delta: 0,
            };

            acc[key] = {
                name: current.name,
                count: current.count + 1,
                delta: current.delta + log.pointDelta,
            };

            return acc;
        }, {}),
    ).sort((a, b) => b.count - a.count || b.delta - a.delta)[0] ?? null;

    const bestDayEntry = Object.entries(
        scopeLogs.reduce<Record<string, { delta: number; count: number }>>((acc, log) => {
            const key = toLocalDayKey(log.timestamp);
            const current = acc[key] ?? { delta: 0, count: 0 };
            acc[key] = {
                delta: current.delta + log.pointDelta,
                count: current.count + 1,
            };
            return acc;
        }, {}),
    ).sort((a, b) => b[1].delta - a[1].delta || b[1].count - a[1].count)[0] ?? null;

    const badgeLeader = Object.entries(
        scopeBadges.reduce<Record<string, { name: string; count: number }>>((acc, badge) => {
            const current = acc[badge.memberId] ?? {
                name: members.find((member) => member.id === badge.memberId)?.name ?? '알 수 없는 회원',
                count: 0,
            };

            acc[badge.memberId] = {
                name: current.name,
                count: current.count + 1,
            };

            return acc;
        }, {}),
    )
        .map(([memberId, value]) => ({
            memberId,
            ...value,
        }))
        .sort((a, b) => b.count - a.count)[0] ?? null;

    return {
        scope: 'overall',
        periodType,
        title: `${scope.title} 아카이브`,
        subtitle: scope.subtitle,
        summary: teamRows[0] && memberDeltaRows[0]
            ? `${teamRows[0].teamName}이 팀 흐름을 이끌었고, ${memberDeltaRows[0].name}님이 MVP를 기록했습니다.`
            : '이 기간의 전체 활동 흐름을 저장했습니다.',
        badgeLabel: periodType === 'month' ? '월간 운영 리캡' : '시즌 운영 리캡',
        note: bestDayEntry
            ? `${formatDate(bestDayEntry[0])}에 하루 최고 ${bestDayEntry[1].delta > 0 ? '+' : ''}${bestDayEntry[1].delta}점이 기록됐습니다.`
            : '다음 활동이 쌓이면 전체 하이라이트가 더 풍부해집니다.',
        startsAt: scope.start.toISOString(),
        endsAt: scope.end.toISOString(),
        seasonId: season?.id ?? null,
        payload: {
            theme: 'overall',
            mascotKey: badgeLeader ? 'bandi' : 'didi',
            stats: [
                { label: '총 활동', value: `${scopeLogs.length}건` },
                { label: '참여 회원', value: `${uniqueMemberCount}명` },
                { label: '누적 총점', value: `${totalPoints > 0 ? '+' : ''}${totalPoints}점` },
                { label: '신규 배지', value: `${scopeBadges.length}개` },
            ],
            highlights: [
                buildHighlight(
                    'MVP',
                    memberDeltaRows[0]?.name ?? '아직 집계 전',
                    memberDeltaRows[0]
                        ? `${memberDeltaRows[0].delta > 0 ? '+' : ''}${memberDeltaRows[0].delta}점 · ${memberDeltaRows[0].count}건`
                        : '활동이 쌓이면 MVP가 자동으로 집계됩니다.',
                ),
                buildHighlight(
                    '상위 팀',
                    teamRows[0]?.teamName ?? '팀 집계 준비 중',
                    teamRows[0]
                        ? `${teamRows[0].delta > 0 ? '+' : ''}${teamRows[0].delta}점 · ${teamRows[0].count}건`
                        : '팀 흐름이 누적되면 비교가 활성화됩니다.',
                ),
                buildHighlight(
                    '대표 규칙',
                    topCategory?.name ?? '규칙 집계 준비 중',
                    topCategory
                        ? `${topCategory.count}건 · ${topCategory.delta > 0 ? '+' : ''}${topCategory.delta}점`
                        : '활동 규칙이 충분히 누적되면 대표 규칙이 선정됩니다.',
                ),
                buildHighlight(
                    '가장 뜨거운 날',
                    bestDayEntry ? formatDate(bestDayEntry[0]) : '아직 없음',
                    bestDayEntry
                        ? `${bestDayEntry[1].delta > 0 ? '+' : ''}${bestDayEntry[1].delta}점 · ${bestDayEntry[1].count}건`
                        : '다음 활동 구간에서 최고 활동일이 기록됩니다.',
                ),
            ],
        },
    };
};
