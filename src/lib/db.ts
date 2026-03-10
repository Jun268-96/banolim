import type { ActivityLog, Category, Member, RoleSummary, SeasonSummary, TeamSummary, TeamType, SeasonStatus } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

const createLocalId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

let localMembers: Member[] = [
    {
        id: 'm1',
        name: 'Lee Dongsub',
        score: 180,
        isApproved: true,
        roleName: 'President',
        teamName: 'Executive',
        status: 'active',
        joinedAt: '2026-03-01',
    },
    {
        id: 'm2',
        name: 'Kim Juyoung',
        score: 135,
        isApproved: true,
        roleName: 'Vice President',
        teamName: 'Executive',
        status: 'active',
        joinedAt: '2026-03-01',
    },
    {
        id: 'm3',
        name: 'Kim Sehyun',
        score: 95,
        isApproved: true,
        roleName: 'Planning Lead',
        teamName: 'Planning',
        status: 'active',
        joinedAt: '2026-03-02',
    },
    {
        id: 'm4',
        name: 'Lee Minhee',
        score: 40,
        isApproved: false,
        roleName: 'PR Lead',
        teamName: 'PR',
        status: 'dormant',
        joinedAt: '2026-03-03',
    },
];

let localCategories: Category[] = [
    { id: 'p1', categoryName: 'Regular meeting attendance', pointValue: 10 },
    { id: 'p2', categoryName: 'Study participation', pointValue: 15 },
    { id: 'p3', categoryName: 'Presentation', pointValue: 30 },
    { id: 'p4', categoryName: 'Late arrival', pointValue: -5 },
];

let localLogs: ActivityLog[] = [
    {
        id: 'l1',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
        memberId: 'm1',
        categoryId: 'p1',
        pointDelta: 10,
        reason: 'Regular meeting attendance',
        note: 'Weekly meeting',
    },
    {
        id: 'l2',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        memberId: 'm2',
        categoryId: 'p3',
        pointDelta: 30,
        reason: 'Presentation',
        note: 'AI study session',
    },
];

let localRoles: RoleSummary[] = [
    { id: 'r1', name: 'President', permissionScope: 'super_admin', rankOrder: 10 },
    { id: 'r2', name: 'Vice President', permissionScope: 'operator', rankOrder: 20 },
    { id: 'r3', name: 'Planning Lead', permissionScope: 'operator', rankOrder: 30 },
    { id: 'r4', name: 'Member', permissionScope: 'member', rankOrder: 100 },
];

let localTeams: TeamSummary[] = [
    { id: 't1', name: 'Executive', type: 'core', isActive: true },
    { id: 't2', name: 'Planning', type: 'core', isActive: true },
    { id: 't3', name: 'PR', type: 'core', isActive: true },
    { id: 't4', name: 'Operations', type: 'core', isActive: true },
    { id: 't5', name: 'Study', type: 'study', isActive: true },
];

const localCurrentSeason: SeasonSummary = {
    id: 'season_2026_spring',
    name: '2026 Spring Season',
    status: 'active',
    startDate: '2026-03-01',
    endDate: '2026-08-31',
};

let localSeasons: SeasonSummary[] = [
    localCurrentSeason,
    {
        id: 'season_2025_fall',
        name: '2025 Fall Season',
        status: 'closed',
        startDate: '2025-09-01',
        endDate: '2026-02-28',
    },
];

const sortMembers = (members: Member[]) => [...members].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

const enrichLocalLogs = () => {
    const memberMap = new Map(localMembers.map((member) => [member.id, member]));
    const categoryMap = new Map(localCategories.map((category) => [category.id, category]));

    return [...localLogs]
        .map((log) => ({
            ...log,
            memberName: memberMap.get(log.memberId)?.name ?? 'Unknown member',
            categoryName: categoryMap.get(log.categoryId)?.categoryName ?? 'Unknown rule',
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

const fallback = <T>(task: string, getLocalValue: () => T, error?: unknown): T => {
    if (error) {
        console.warn(`[data] ${task} failed, using local fallback instead.`, error);
    }

    return getLocalValue();
};

const getSupabaseClient = () => {
    if (!supabase) {
        throw new Error('Supabase client is not configured.');
    }

    return supabase;
};

const createActivityCode = () => `manual-${Date.now()}`;

export const getMembers = async (): Promise<Member[]> => {
    if (!isSupabaseConfigured) {
        return sortMembers(localMembers);
    }

    try {
        const client = getSupabaseClient();
        const [summaryResult, memberResult, roleResult, teamResult] = await Promise.all([
            client.from('member_score_summary').select('id, name, is_approved, score'),
            client
                .from('members')
                .select('id, name, role_id, team_id, status, joined_at, is_approved, is_visible')
                .eq('is_visible', true),
            client.from('roles').select('id, name'),
            client.from('teams').select('id, name'),
        ]);

        if (summaryResult.error) throw summaryResult.error;
        if (memberResult.error) throw memberResult.error;
        if (roleResult.error) throw roleResult.error;
        if (teamResult.error) throw teamResult.error;

        const summaryMap = new Map((summaryResult.data ?? []).map((summary) => [summary.id, summary]));
        const roleMap = new Map((roleResult.data ?? []).map((role) => [role.id, role.name]));
        const teamMap = new Map((teamResult.data ?? []).map((team) => [team.id, team.name]));

        return sortMembers(
            (memberResult.data ?? []).map((member) => {
                const summary = summaryMap.get(member.id);

                return {
                    id: member.id,
                    name: member.name,
                    score: summary?.score ?? 0,
                    isApproved: member.is_approved,
                    roleName: member.role_id ? roleMap.get(member.role_id) ?? null : null,
                    teamName: member.team_id ? teamMap.get(member.team_id) ?? null : null,
                    status: member.status,
                    joinedAt: member.joined_at,
                };
            }),
        );
    } catch (error) {
        return fallback('getMembers', () => sortMembers(localMembers), error);
    }
};

export const getCategories = async (): Promise<Category[]> => {
    if (!isSupabaseConfigured) {
        return [...localCategories];
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('point_rule_catalog')
            .select('id, category_name, point_value, is_active')
            .eq('is_active', true)
            .order('category_name', { ascending: true });

        if (error) {
            throw error;
        }

        return (data ?? []).map((category) => ({
            id: category.id,
            categoryName: category.category_name,
            pointValue: category.point_value,
        }));
    } catch (error) {
        return fallback('getCategories', () => [...localCategories], error);
    }
};

export const getLogs = async (): Promise<ActivityLog[]> => {
    if (!isSupabaseConfigured) {
        return enrichLocalLogs();
    }

    try {
        const client = getSupabaseClient();
        const [ledgerResult, recordResult, members, categories] = await Promise.all([
            client
                .from('point_ledgers')
                .select('id, record_id, member_id, point_rule_id, delta, reason, created_at')
                .order('created_at', { ascending: false }),
            client.from('activity_records').select('id, note, occurred_at'),
            getMembers(),
            getCategories(),
        ]);

        if (ledgerResult.error) throw ledgerResult.error;
        if (recordResult.error) throw recordResult.error;

        const recordMap = new Map((recordResult.data ?? []).map((record) => [record.id, record]));
        const memberMap = new Map(members.map((member) => [member.id, member.name]));
        const categoryMap = new Map(categories.map((category) => [category.id, category.categoryName]));

        return (ledgerResult.data ?? []).map((ledger) => {
            const record = recordMap.get(ledger.record_id);

            return {
                id: ledger.id,
                timestamp: record?.occurred_at ?? ledger.created_at,
                memberId: ledger.member_id,
                categoryId: ledger.point_rule_id,
                pointDelta: ledger.delta,
                reason: ledger.reason,
                note: record?.note ?? null,
                memberName: memberMap.get(ledger.member_id) ?? 'Unknown member',
                categoryName: categoryMap.get(ledger.point_rule_id) ?? 'Unknown rule',
            };
        });
    } catch (error) {
        return fallback('getLogs', () => enrichLocalLogs(), error);
    }
};

export const addMember = async (name: string): Promise<Member> => {
    if (!isSupabaseConfigured) {
        const newMember: Member = {
            id: createLocalId('member'),
            name,
            score: 0,
            isApproved: false,
            roleName: null,
            teamName: null,
            status: 'active',
            joinedAt: new Date().toISOString().slice(0, 10),
        };
        localMembers.push(newMember);
        return newMember;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('members')
            .insert({
                name,
                is_approved: false,
                status: 'active',
            })
            .select('id, name, is_approved, status, joined_at')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            score: 0,
            isApproved: data.is_approved,
            roleName: null,
            teamName: null,
            status: data.status,
            joinedAt: data.joined_at,
        };
    } catch (error) {
        const newMember: Member = {
            id: createLocalId('member'),
            name,
            score: 0,
            isApproved: false,
            roleName: null,
            teamName: null,
            status: 'active',
            joinedAt: new Date().toISOString().slice(0, 10),
        };
        localMembers.push(newMember);
        return fallback('addMember', () => newMember, error);
    }
};

export const getCurrentSeason = async (): Promise<SeasonSummary | null> => {
    if (!isSupabaseConfigured) {
        return localCurrentSeason;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('seasons')
            .select('id, name, status, start_date, end_date')
            .eq('status', 'active')
            .order('start_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return null;
        }

        return {
            id: data.id,
            name: data.name,
            status: data.status,
            startDate: data.start_date,
            endDate: data.end_date,
        };
    } catch (error) {
        return fallback('getCurrentSeason', () => localCurrentSeason, error);
    }
};

export const getRoles = async (): Promise<RoleSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localRoles].sort((a, b) => a.rankOrder - b.rankOrder);
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

        return (data ?? []).map((role) => ({
            id: role.id,
            name: role.name,
            permissionScope: role.permission_scope,
            rankOrder: role.rank_order,
        }));
    } catch (error) {
        return fallback('getRoles', () => [...localRoles].sort((a, b) => a.rankOrder - b.rankOrder), error);
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
        localRoles.push(role);
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
        localRoles.push(role);
        return fallback('addRole', () => role, error);
    }
};

export const getTeams = async (): Promise<TeamSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localTeams].sort((a, b) => a.name.localeCompare(b.name));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('teams')
            .select('id, name, type, is_active')
            .order('name', { ascending: true });

        if (error) {
            throw error;
        }

        return (data ?? []).map((team) => ({
            id: team.id,
            name: team.name,
            type: team.type,
            isActive: team.is_active,
        }));
    } catch (error) {
        return fallback('getTeams', () => [...localTeams].sort((a, b) => a.name.localeCompare(b.name)), error);
    }
};

export const addTeam = async (name: string, type: TeamType): Promise<TeamSummary> => {
    if (!isSupabaseConfigured) {
        const team: TeamSummary = {
            id: createLocalId('team'),
            name,
            type,
            isActive: true,
        };
        localTeams.push(team);
        return team;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('teams')
            .insert({
                name,
                type,
                is_active: true,
            })
            .select('id, name, type, is_active')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            type: data.type,
            isActive: data.is_active,
        };
    } catch (error) {
        const team: TeamSummary = {
            id: createLocalId('team'),
            name,
            type,
            isActive: true,
        };
        localTeams.push(team);
        return fallback('addTeam', () => team, error);
    }
};

export const getSeasons = async (): Promise<SeasonSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localSeasons].sort((a, b) => b.startDate.localeCompare(a.startDate));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('seasons')
            .select('id, name, status, start_date, end_date')
            .order('start_date', { ascending: false });

        if (error) {
            throw error;
        }

        return (data ?? []).map((season) => ({
            id: season.id,
            name: season.name,
            status: season.status,
            startDate: season.start_date,
            endDate: season.end_date,
        }));
    } catch (error) {
        return fallback('getSeasons', () => [...localSeasons].sort((a, b) => b.startDate.localeCompare(a.startDate)), error);
    }
};

export const addSeason = async (
    name: string,
    startDate: string,
    endDate: string,
    status: SeasonStatus,
): Promise<SeasonSummary> => {
    if (!isSupabaseConfigured) {
        const season: SeasonSummary = {
            id: createLocalId('season'),
            name,
            status,
            startDate,
            endDate,
        };
        localSeasons.push(season);
        return season;
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('seasons')
            .insert({
                name,
                start_date: startDate,
                end_date: endDate,
                status,
            })
            .select('id, name, status, start_date, end_date')
            .single();

        if (error) {
            throw error;
        }

        return {
            id: data.id,
            name: data.name,
            status: data.status,
            startDate: data.start_date,
            endDate: data.end_date,
        };
    } catch (error) {
        const season: SeasonSummary = {
            id: createLocalId('season'),
            name,
            status,
            startDate,
            endDate,
        };
        localSeasons.push(season);
        return fallback('addSeason', () => season, error);
    }
};

export const deleteMember = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localMembers = localMembers.filter((member) => member.id !== id);
        localLogs = localLogs.filter((log) => log.memberId !== id);
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('members')
            .update({
                status: 'inactive',
                is_visible: false,
            })
            .eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        localMembers = localMembers.filter((member) => member.id !== id);
        localLogs = localLogs.filter((log) => log.memberId !== id);
        fallback('deleteMember', () => undefined, error);
    }
};

export const addCategory = async (categoryName: string, pointValue: number): Promise<Category> => {
    if (!isSupabaseConfigured) {
        const newCategory: Category = {
            id: createLocalId('rule'),
            categoryName,
            pointValue,
        };
        localCategories.push(newCategory);
        return newCategory;
    }

    try {
        const client = getSupabaseClient();
        const { data: activityType, error: activityTypeError } = await client
            .from('activity_types')
            .insert({
                code: createActivityCode(),
                name: categoryName,
                group_name: 'manual',
            })
            .select('id')
            .single();

        if (activityTypeError) {
            throw activityTypeError;
        }

        const { data: pointRule, error: pointRuleError } = await client
            .from('point_rules')
            .insert({
                activity_type_id: activityType.id,
                base_point: pointValue,
                penalty_point: pointValue < 0 ? Math.abs(pointValue) : 0,
                condition_json: {},
                is_active: true,
                version: 1,
            })
            .select('id, base_point')
            .single();

        if (pointRuleError) {
            throw pointRuleError;
        }

        return {
            id: pointRule.id,
            categoryName,
            pointValue: pointRule.base_point,
        };
    } catch (error) {
        const newCategory: Category = {
            id: createLocalId('rule'),
            categoryName,
            pointValue,
        };
        localCategories.push(newCategory);
        return fallback('addCategory', () => newCategory, error);
    }
};

export const deleteCategory = async (id: string): Promise<void> => {
    if (!isSupabaseConfigured) {
        localCategories = localCategories.filter((category) => category.id !== id);
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('point_rules')
            .update({ is_active: false })
            .eq('id', id);

        if (error) {
            throw error;
        }
    } catch (error) {
        localCategories = localCategories.filter((category) => category.id !== id);
        fallback('deleteCategory', () => undefined, error);
    }
};

export const createActivityEntry = async (memberId: string, categoryId: string, note?: string): Promise<void> => {
    const trimmedNote = note?.trim() || null;

    if (!isSupabaseConfigured) {
        const category = localCategories.find((item) => item.id === categoryId);
        const member = localMembers.find((item) => item.id === memberId);

        if (!category || !member) {
            return;
        }

        member.score += category.pointValue;
        localLogs.push({
            id: createLocalId('log'),
            timestamp: new Date().toISOString(),
            memberId,
            categoryId,
            pointDelta: category.pointValue,
            reason: trimmedNote ?? category.categoryName,
            note: trimmedNote,
            memberName: member.name,
            categoryName: category.categoryName,
        });
        return;
    }

    try {
        const client = getSupabaseClient();
        const [{ data: pointRule, error: pointRuleError }, { data: season, error: seasonError }] = await Promise.all([
            client
                .from('point_rules')
                .select('id, activity_type_id, base_point')
                .eq('id', categoryId)
                .single(),
            client
                .from('seasons')
                .select('id')
                .eq('status', 'active')
                .limit(1)
                .maybeSingle(),
        ]);

        if (pointRuleError) throw pointRuleError;
        if (seasonError) throw seasonError;

        const { data: record, error: recordError } = await client
            .from('activity_records')
            .insert({
                member_id: memberId,
                season_id: season?.id ?? null,
                activity_type_id: pointRule.activity_type_id,
                occurred_at: new Date().toISOString(),
                status: 'confirmed',
                note: trimmedNote,
            })
            .select('id')
            .single();

        if (recordError) throw recordError;

        const { error: ledgerError } = await client.from('point_ledgers').insert({
            record_id: record.id,
            member_id: memberId,
            point_rule_id: pointRule.id,
            delta: pointRule.base_point,
            reason: trimmedNote ?? 'Manual activity entry',
        });

        if (ledgerError) throw ledgerError;
    } catch (error) {
        const category = localCategories.find((item) => item.id === categoryId);
        const member = localMembers.find((item) => item.id === memberId);

        if (category && member) {
            member.score += category.pointValue;
            localLogs.push({
                id: createLocalId('log'),
                timestamp: new Date().toISOString(),
                memberId,
                categoryId,
                pointDelta: category.pointValue,
                reason: trimmedNote ?? category.categoryName,
                note: trimmedNote,
                memberName: member.name,
                categoryName: category.categoryName,
            });
        }

        fallback('createActivityEntry', () => undefined, error);
    }
};

export const awardPoints = async (memberId: string, categoryId: string): Promise<void> => {
    await createActivityEntry(memberId, categoryId, 'Quick score action from members dashboard');
};

export const createBatchActivityEntries = async (
    memberIds: string[],
    categoryId: string,
    note?: string,
): Promise<void> => {
    for (const memberId of memberIds) {
        await createActivityEntry(memberId, categoryId, note);
    }
};
