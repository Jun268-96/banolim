import { describe, expect, it } from 'vitest';
import { buildPermissions } from './permissions';

describe('buildPermissions', () => {
  it('grants all admin capabilities to super admins', () => {
    expect(buildPermissions('super_admin')).toEqual({
      canViewHome: true,
      canViewMembers: true,
      canViewActivities: true,
      canManageMembers: true,
      canManageSettings: true,
      canViewStats: true,
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
    });
  });
});
