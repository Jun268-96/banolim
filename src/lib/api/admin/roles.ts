import type { RoleSummary } from '../../../types';
import type { Database } from '../../../types/database';
import { isSupabaseConfigured } from '../../supabase';
import { getSupabaseClient } from '../shared/client';
import { fallback } from '../shared/fallback';
import { localState } from '../shared/localState';
import { createLocalId } from '../shared/localUtils';

type RoleRow = Database['public']['Tables']['roles']['Row'];

export const getRoles = async (): Promise<RoleSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localState.roles].sort((a, b) => a.rankOrder - b.rankOrder);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('roles')
            .select('id, name, permission_scope, rank_order')
            .order('rank_order', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Pick<RoleRow, 'id' | 'name' | 'permission_scope' | 'rank_order'>[]).map((role) => ({
            id: role.id,
            name: role.name,
            permissionScope: role.permission_scope,
            rankOrder: role.rank_order,
        }));
    } catch (error) {
        return fallback('getRoles', () => [...localState.roles].sort((a, b) => a.rankOrder - b.rankOrder), error);
    }
};

export const addRole = async (name: string, permissionScope: string, rankOrder: number): Promise<RoleSummary> => {
    if (!isSupabaseConfigured) {
        const role: RoleSummary = {
            id: createLocalId('role'),
            name,
            permissionScope,
            rankOrder,
        };
        localState.roles.push(role);
        return role;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('roles')
            .insert({
                name,
                permission_scope: permissionScope,
                rank_order: rankOrder,
            })
            .select('id, name, permission_scope, rank_order')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            permissionScope: data.permission_scope,
            rankOrder: data.rank_order,
        };
    } catch (error) {
        const role: RoleSummary = {
            id: createLocalId('role'),
            name,
            permissionScope,
            rankOrder,
        };
        localState.roles.push(role);
        return fallback('addRole', () => role, error);
    }
};

export const updateRole = async (
    id: string,
    {
        name,
        permissionScope,
        rankOrder,
    }: {
        name: string;
        permissionScope: string;
        rankOrder: number;
    },
): Promise<RoleSummary> => {
    if (!isSupabaseConfigured) {
        const roleIndex = localState.roles.findIndex((role) => role.id === id);
        const previousRole = roleIndex >= 0 ? localState.roles[roleIndex] : null;

        if (roleIndex >= 0) {
            localState.roles.splice(roleIndex, 1, {
                ...localState.roles[roleIndex],
                name,
                permissionScope,
                rankOrder,
            });
        }

        if (previousRole && previousRole.name !== name) {
            localState.members = localState.members.map((member) =>
                member.roleId === id
                    ? {
                        ...member,
                        roleName: name,
                    }
                    : member,
            );
        }

        const updated = localState.roles.find((role) => role.id === id);
        if (!updated) {
            throw new Error('수정할 역할을 찾지 못했습니다.');
        }

        return updated;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('roles')
            .update({
                name,
                permission_scope: permissionScope,
                rank_order: rankOrder,
            })
            .eq('id', id)
            .select('id, name, permission_scope, rank_order')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            permissionScope: data.permission_scope,
            rankOrder: data.rank_order,
        };
    } catch (error) {
        return fallback('updateRole', () => {
            const role = localState.roles.find((item) => item.id === id);
            if (!role) {
                throw new Error('수정할 역할을 찾지 못했습니다.');
            }
            return role;
        }, error);
    }
};

export const deleteRole = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        const roleIndex = localState.roles.findIndex((role) => role.id === id);
        if (roleIndex >= 0) {
            localState.roles.splice(roleIndex, 1);
        }
        localState.members = localState.members.map((member) =>
            member.roleId === id
                ? {
                    ...member,
                    roleId: null,
                    roleName: null,
                }
                : member,
        );
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client.from('roles').delete().eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        fallback('deleteRole', () => undefined, error);
    }
};
