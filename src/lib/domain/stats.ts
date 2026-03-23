import type { ActivityLog, Member, SeasonSummary } from '../../types';

export type TeamStatRow = {
  team: string;
  totalPoints: number;
  activityCount: number;
  participantCount: number;
};

export type CategoryStatRow = {
  name: string;
  count: number;
  delta: number;
};

export type MemberStatRow = {
  memberId: string;
  name: string;
  totalPoints: number;
  activityCount: number;
};

export const toSeasonRange = (season: SeasonSummary | null) => {
  if (!season) {
    return {
      start: new Date(0),
      end: new Date(),
    };
  }

  return {
    start: new Date(`${season.startDate}T00:00:00`),
    end: season.endDate ? new Date(`${season.endDate}T23:59:59`) : new Date(),
  };
};

export const isWithinRange = (value: string, start: Date, end: Date) => {
  const target = new Date(value);
  return target >= start && target <= end;
};

export const buildTeamStats = (logs: ActivityLog[], members: Member[]): TeamStatRow[] => {
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const rows = new Map<string, { totalPoints: number; activityCount: number; participantIds: Set<string> }>();

  logs.forEach((log) => {
    const teamName = memberMap.get(log.memberId)?.teamName ?? '미지정';
    const current = rows.get(teamName) ?? {
      totalPoints: 0,
      activityCount: 0,
      participantIds: new Set<string>(),
    };

    current.totalPoints += log.pointDelta;
    current.activityCount += 1;
    current.participantIds.add(log.memberId);
    rows.set(teamName, current);
  });

  return [...rows.entries()]
    .map(([team, value]) => ({
      team,
      totalPoints: value.totalPoints,
      activityCount: value.activityCount,
      participantCount: value.participantIds.size,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.activityCount - a.activityCount);
};

export const buildCategoryStats = (logs: ActivityLog[]): CategoryStatRow[] => {
  const rows = new Map<string, { count: number; delta: number }>();

  logs.forEach((log) => {
    const name = log.categoryName ?? log.reason ?? '알 수 없는 규칙';
    const current = rows.get(name) ?? { count: 0, delta: 0 };
    current.count += 1;
    current.delta += log.pointDelta;
    rows.set(name, current);
  });

  return [...rows.entries()]
    .map(([name, value]) => ({
      name,
      count: value.count,
      delta: value.delta,
    }))
    .sort((a, b) => b.count - a.count || b.delta - a.delta);
};

export const buildMemberStats = (logs: ActivityLog[], members: Member[]): MemberStatRow[] => {
  const memberNameMap = new Map(members.map((member) => [member.id, member.name]));
  const rows = new Map<string, { totalPoints: number; activityCount: number }>();

  logs.forEach((log) => {
    const current = rows.get(log.memberId) ?? { totalPoints: 0, activityCount: 0 };
    current.totalPoints += log.pointDelta;
    current.activityCount += 1;
    rows.set(log.memberId, current);
  });

  return [...rows.entries()]
    .map(([memberId, value]) => ({
      memberId,
      name: memberNameMap.get(memberId) ?? '알 수 없는 회원',
      totalPoints: value.totalPoints,
      activityCount: value.activityCount,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.activityCount - a.activityCount);
};

export const formatDelta = (current: number, previous: number, suffix = '') => {
  const diff = current - previous;
  if (diff === 0) {
    return `변화 없음${suffix}`;
  }

  const prefix = diff > 0 ? '+' : '';
  return `${prefix}${diff}${suffix}`;
};
