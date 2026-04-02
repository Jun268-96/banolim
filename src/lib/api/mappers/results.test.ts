import { describe, expect, it } from 'vitest';
import {
    parseHardDeleteMemberResult,
    parseSeasonDataResetResult,
    parseTeamDeleteResult,
    parseTeamMemberUpdateResult,
} from './results';

describe('destructive result parsers', () => {
    it('parses team member replacement results', () => {
        expect(parseTeamMemberUpdateResult({
            teamId: 'team_1',
            teamName: '기획팀',
            memberCount: 4,
            addedCount: 2,
            removedCount: 1,
        })).toEqual({
            teamId: 'team_1',
            teamName: '기획팀',
            memberCount: 4,
            addedCount: 2,
            removedCount: 1,
        });
    });

    it('parses team deletion results', () => {
        expect(parseTeamDeleteResult({
            teamId: 'team_1',
            teamName: '기획팀',
            teamType: 'core',
            affectedMemberCount: 3,
        })).toEqual({
            teamId: 'team_1',
            teamName: '기획팀',
            teamType: 'core',
            affectedMemberCount: 3,
        });
    });

    it('parses season reset results with optional fields', () => {
        expect(parseSeasonDataResetResult({
            seasonId: 'season_1',
            seasonName: '2026 상반기',
            activityRecordCount: 10,
            pointLedgerCount: 12,
            correctionRequestCount: 3,
            affectedMemberCount: 7,
            badgeRefreshCount: 5,
            attendanceSessionCount: 2,
            attendanceSessionMemberCount: 15,
        })).toEqual({
            seasonId: 'season_1',
            seasonName: '2026 상반기',
            activityRecordCount: 10,
            pointLedgerCount: 12,
            correctionRequestCount: 3,
            affectedMemberCount: 7,
            badgeRefreshCount: 5,
            attendanceSessionCount: 2,
            attendanceSessionMemberCount: 15,
        });
    });

    it('parses hidden member hard delete results', () => {
        expect(parseHardDeleteMemberResult({
            memberId: 'member_1',
            memberName: '홍길동',
            deletedAuthUser: true,
            deletedCounts: {
                memberBadges: 1,
                memberTeamLinks: 2,
                userProfiles: 1,
                attendanceSessionMembers: 0,
                attendanceCheckins: 0,
            },
        })).toEqual({
            memberId: 'member_1',
            memberName: '홍길동',
            deletedAuthUser: true,
            deletedCounts: {
                memberBadges: 1,
                memberTeamLinks: 2,
                userProfiles: 1,
                attendanceSessionMembers: 0,
                attendanceCheckins: 0,
            },
        });
    });

    it('normalizes malformed team delete results with safe defaults', () => {
        expect(parseTeamDeleteResult({
            teamId: 'team_1',
            teamName: '기획팀',
        })).toEqual({
            teamId: 'team_1',
            teamName: '기획팀',
            teamType: 'core',
            affectedMemberCount: 0,
        });
    });

    it('normalizes missing nested hard delete counters with zero defaults', () => {
        expect(parseHardDeleteMemberResult({
            memberId: 'member_1',
            memberName: '홍길동',
            deletedAuthUser: true,
            deletedCounts: {
                memberBadges: 1,
            },
        })).toEqual({
            memberId: 'member_1',
            memberName: '홍길동',
            deletedAuthUser: true,
            deletedCounts: {
                memberBadges: 1,
                memberTeamLinks: 0,
                userProfiles: 0,
                attendanceSessionMembers: 0,
                attendanceCheckins: 0,
            },
        });
    });
});
