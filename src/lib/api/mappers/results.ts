import type {
  HardDeleteMemberResult,
  SeasonDataResetResult,
  TeamDeleteResult,
  TeamMemberUpdateResult,
  TeamType,
} from '../../../types';
import {
  getBooleanField,
  getNumberField,
  getOptionalNumberField,
  getStringField,
  toRecord,
} from '../shared/record';

export const parseTeamMemberUpdateResult = (value: unknown): TeamMemberUpdateResult => ({
  teamId: getStringField(value, 'teamId'),
  teamName: getStringField(value, 'teamName'),
  memberCount: getNumberField(value, 'memberCount'),
  addedCount: getNumberField(value, 'addedCount'),
  removedCount: getNumberField(value, 'removedCount'),
});

export const parseTeamDeleteResult = (value: unknown): TeamDeleteResult => ({
  teamId: getStringField(value, 'teamId'),
  teamName: getStringField(value, 'teamName'),
  teamType: (getStringField(value, 'teamType') as TeamType) || 'core',
  affectedMemberCount: getNumberField(value, 'affectedMemberCount'),
});

export const parseSeasonDataResetResult = (value: unknown): SeasonDataResetResult => ({
  seasonId: getStringField(value, 'seasonId'),
  seasonName: getStringField(value, 'seasonName'),
  activityRecordCount: getNumberField(value, 'activityRecordCount'),
  pointLedgerCount: getNumberField(value, 'pointLedgerCount'),
  correctionRequestCount: getOptionalNumberField(value, 'correctionRequestCount'),
  affectedMemberCount: getNumberField(value, 'affectedMemberCount'),
  badgeRefreshCount: getNumberField(value, 'badgeRefreshCount'),
  attendanceSessionCount: getOptionalNumberField(value, 'attendanceSessionCount'),
  attendanceSessionMemberCount: getOptionalNumberField(value, 'attendanceSessionMemberCount'),
});

export const parseHardDeleteMemberResult = (value: unknown): HardDeleteMemberResult => {
  const deletedCounts = toRecord(toRecord(value).deletedCounts);

  return {
    memberId: getStringField(value, 'memberId'),
    memberName: getStringField(value, 'memberName'),
    deletedAuthUser: getBooleanField(value, 'deletedAuthUser'),
    deletedCounts: {
      memberBadges: getNumberField(deletedCounts, 'memberBadges'),
      memberTeamLinks: getNumberField(deletedCounts, 'memberTeamLinks'),
      userProfiles: getNumberField(deletedCounts, 'userProfiles'),
      attendanceSessionMembers: getNumberField(deletedCounts, 'attendanceSessionMembers'),
      attendanceCheckins: getNumberField(deletedCounts, 'attendanceCheckins'),
    },
  };
};
