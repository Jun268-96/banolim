import type { Badge, BadgeCriteria, BadgeEvaluationScope, BadgeTone, MemberBadge } from '../../../types';
import { normalizeBadgeCriteria } from '../../badges';
import { toRecord } from '../shared/record';

type BadgeRowShape = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon_key: string;
  image_url: string | null;
  tone: string | null;
  evaluation_scope: string | null;
  criteria_json: unknown;
  sort_order: number;
  is_active: boolean;
};

type MemberBadgeRowShape = {
  id: string;
  member_id: string;
  badge_id: string;
  badge_code: string;
  badge_name: string;
  badge_description: string;
  icon_key: string;
  image_url: string | null;
  tone: string | null;
  evaluation_scope: string | null;
  criteria_json: unknown;
  awarded_at: string;
  season_id: string | null;
};

export const parseBadgeEvaluationScope = (value: unknown): BadgeEvaluationScope =>
  value === 'lifetime' ? 'lifetime' : 'season';

export const parseBadgeCriteriaValue = (value: unknown): BadgeCriteria => {
  const record = toRecord(value);
  return normalizeBadgeCriteria({
    activityCount: typeof record.activityCount === 'number' ? record.activityCount : undefined,
    attendanceCount: typeof record.attendanceCount === 'number' ? record.attendanceCount : undefined,
    spotlightCount: typeof record.spotlightCount === 'number' ? record.spotlightCount : undefined,
    uniqueActivityTypeCount: typeof record.uniqueActivityTypeCount === 'number' ? record.uniqueActivityTypeCount : undefined,
    evidenceCount: typeof record.evidenceCount === 'number' ? record.evidenceCount : undefined,
    activeDayCount: typeof record.activeDayCount === 'number' ? record.activeDayCount : undefined,
    totalPoints: typeof record.totalPoints === 'number' ? record.totalPoints : undefined,
  });
};

export const mapBadgeRow = (row: BadgeRowShape): Badge => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  iconKey: row.icon_key,
  imageUrl: row.image_url,
  tone: (row.tone as BadgeTone | null) ?? 'sky',
  evaluationScope: parseBadgeEvaluationScope(row.evaluation_scope),
  criteria: parseBadgeCriteriaValue(row.criteria_json),
  sortOrder: row.sort_order,
  isActive: row.is_active,
});

export const mapMemberBadgeRow = (row: MemberBadgeRowShape): MemberBadge => ({
  id: row.id,
  memberId: row.member_id,
  badgeId: row.badge_id,
  badgeCode: row.badge_code,
  badgeName: row.badge_name,
  badgeDescription: row.badge_description,
  iconKey: row.icon_key,
  imageUrl: row.image_url,
  tone: (row.tone as BadgeTone | null) ?? 'sky',
  evaluationScope: parseBadgeEvaluationScope(row.evaluation_scope),
  criteria: parseBadgeCriteriaValue(row.criteria_json),
  awardedAt: row.awarded_at,
  seasonId: row.season_id,
});
