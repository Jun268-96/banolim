import type {
  AttendanceStatus,
  AttendanceTargetGroup,
  Category,
  Member,
} from '../../types';

const attendanceRuleMatchers: Record<AttendanceStatus, RegExp> = {
  present: /(정기모임\s*출석|출석|참석|attendance|present)/i,
  late: /(지각|late)/i,
  absent: /(불참|결석|absence|absent)/i,
};

export const getAttendanceRule = (categories: Category[], status: AttendanceStatus) =>
  categories.find((category) => {
    if (!attendanceRuleMatchers[status].test(category.categoryName)) {
      return false;
    }

    if (status === 'present') {
      return !attendanceRuleMatchers.late.test(category.categoryName)
        && !attendanceRuleMatchers.absent.test(category.categoryName);
    }

    return true;
  }) ?? null;

export const filterMembersForAttendanceGroup = (
  members: Member[],
  targetGroupType: AttendanceTargetGroup,
  targetTeamId?: string | null,
) =>
  members.filter((member) => {
    if (member.status === 'inactive') {
      return false;
    }

    if (targetGroupType === 'all') {
      return true;
    }

    if (targetGroupType === 'ungrouped') {
      return (member.teamIds ?? []).length === 0 && !member.teamId;
    }

    return (member.teamIds ?? []).includes(targetTeamId ?? '') || member.teamId === targetTeamId;
  });

export const getAttendanceTargetGroupLabel = (
  targetGroupType: AttendanceTargetGroup,
  targetTeamId: string | null | undefined,
  teamMap: Map<string, string>,
) => {
  if (targetGroupType === 'all') {
    return '전체 멤버';
  }

  if (targetGroupType === 'ungrouped') {
    return '팀 미지정';
  }

  return targetTeamId ? teamMap.get(targetTeamId) ?? '삭제된 팀' : '삭제된 팀';
};
