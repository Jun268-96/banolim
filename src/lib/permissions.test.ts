import { describe, expect, it } from 'vitest';
import { buildPermissions } from './permissions';
import type { AppRole } from '../types';

describe('buildPermissions', () => {
  it('grants all admin capabilities to super admins', () => {
    expect(buildPermissions('super_admin')).toEqual({
      canViewHome: true,
      canViewMembers: true,
      canViewActivities: true,
      canManageMembers: true,
      canManageSettings: true,
      canViewStats: true,
      canViewCommunity: true,
      canPostToCommunity: true,
      canModerateCommunity: true,
    });
  });

  it('limits members to self-service surfaces only', () => {
    expect(buildPermissions('member')).toEqual({
      canViewHome: true,
      canViewMembers: false,
      canViewActivities: false,
      canManageMembers: false,
      canManageSettings: false,
      canViewStats: false,
      canViewCommunity: true,
      canPostToCommunity: true,
      canModerateCommunity: false,
    });
  });

  it('keeps team leads out of settings while preserving activity access', () => {
    expect(buildPermissions('team_lead')).toEqual({
      canViewHome: true,
      canViewMembers: true,
      canViewActivities: true,
      canManageMembers: false,
      canManageSettings: false,
      canViewStats: true,
      canViewCommunity: true,
      canPostToCommunity: true,
      canModerateCommunity: false,
    });
  });
});

describe('community permissions', () => {
  it('grants canViewCommunity to all roles', () => {
    const allRoles: AppRole[] = ['super_admin', 'operator', 'team_lead', 'member'];
    for (const role of allRoles) {
      expect(buildPermissions(role).canViewCommunity, `${role} should view community`).toBe(true);
    }
  });

  it('grants canPostToCommunity to member', () => {
    expect(buildPermissions('member').canPostToCommunity).toBe(true);
  });

  it('denies canModerateCommunity to team_lead', () => {
    expect(buildPermissions('team_lead').canModerateCommunity).toBe(false);
  });

  it('grants canModerateCommunity to operator', () => {
    expect(buildPermissions('operator').canModerateCommunity).toBe(true);
  });

  it('grants canModerateCommunity to super_admin', () => {
    expect(buildPermissions('super_admin').canModerateCommunity).toBe(true);
  });
});
