import { describe, expect, it } from 'vitest';
import type { Category, Member } from '../../types';
import {
    filterMembersForAttendanceGroup,
    getAttendanceRule,
    getAttendanceTargetGroupLabel,
} from './attendance';

const categories: Category[] = [
    { id: 'present', categoryName: '정기모임 출석', activityTypeId: null, groupName: 'attendance', pointValue: 10, penaltyPoint: 0, conditionSummary: null, conditionJson: null, version: 1, isActive: true },
    { id: 'late', categoryName: '지각', activityTypeId: null, groupName: 'attendance', pointValue: -5, penaltyPoint: 5, conditionSummary: null, conditionJson: null, version: 1, isActive: true },
    { id: 'absent', categoryName: '불참', activityTypeId: null, groupName: 'attendance', pointValue: 0, penaltyPoint: 0, conditionSummary: null, conditionJson: null, version: 1, isActive: true },
];

const members: Member[] = [
    { id: 'm1', name: '활성팀원', score: 0, isApproved: true, roleId: null, roleName: null, teamId: 't1', teamName: '팀1', teamIds: ['t1'], teamNames: ['팀1'], status: 'active', joinedAt: '2026-03-01', isVisible: true },
    { id: 'm2', name: '미지정', score: 0, isApproved: true, roleId: null, roleName: null, teamId: null, teamName: null, teamIds: [], teamNames: [], status: 'active', joinedAt: '2026-03-01', isVisible: true },
    { id: 'm3', name: '비활성', score: 0, isApproved: true, roleId: null, roleName: null, teamId: 't1', teamName: '팀1', teamIds: ['t1'], teamNames: ['팀1'], status: 'inactive', joinedAt: '2026-03-01', isVisible: true },
];

describe('attendance domain helpers', () => {
    it('finds attendance rules by semantic status', () => {
        expect(getAttendanceRule(categories, 'present')?.id).toBe('present');
        expect(getAttendanceRule(categories, 'late')?.id).toBe('late');
        expect(getAttendanceRule(categories, 'absent')?.id).toBe('absent');
    });

    it('filters members by target group while excluding inactive members', () => {
        expect(filterMembersForAttendanceGroup(members, 'all').map((member) => member.id)).toEqual(['m1', 'm2']);
        expect(filterMembersForAttendanceGroup(members, 'ungrouped').map((member) => member.id)).toEqual(['m2']);
        expect(filterMembersForAttendanceGroup(members, 'team', 't1').map((member) => member.id)).toEqual(['m1']);
    });

    it('builds target group labels safely for missing teams', () => {
        const teamMap = new Map([['t1', '팀1']]);

        expect(getAttendanceTargetGroupLabel('all', null, teamMap)).toBe('전체 멤버');
        expect(getAttendanceTargetGroupLabel('ungrouped', null, teamMap)).toBe('팀 미지정');
        expect(getAttendanceTargetGroupLabel('team', 't1', teamMap)).toBe('팀1');
        expect(getAttendanceTargetGroupLabel('team', 'missing', teamMap)).toBe('삭제된 팀');
    });
});
