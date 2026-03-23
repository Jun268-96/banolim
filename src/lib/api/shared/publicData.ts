import type {
    AnnouncementItem,
    Badge,
    ScheduleEventItem,
    SeasonSummary,
    SiteBanner,
} from '../../../types';
import type { Database } from '../../../types/database';
import { isSupabaseConfigured } from '../../supabase';
import { mapBadgeRow } from '../mappers/badges';
import { getSupabaseClient } from './client';
import { fallback } from './fallback';
import { localState } from './localState';
import { isMissingSupabaseRelationError } from './errors';

type SeasonRow = Database['public']['Tables']['seasons']['Row'];
type AnnouncementRow = Database['public']['Tables']['announcements']['Row'];
type ScheduleEventRow = Database['public']['Tables']['schedule_events']['Row'];
type SiteBannerRow = Database['public']['Tables']['site_banners']['Row'];
type BadgeRow = Database['public']['Tables']['badges']['Row'];

const sortAnnouncements = (items: AnnouncementItem[]) =>
    [...items].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || (b.startAt ?? b.createdAt).localeCompare(a.startAt ?? a.createdAt));

const sortScheduleEvents = (items: ScheduleEventItem[]) =>
    [...items].sort((a, b) => a.startAt.localeCompare(b.startAt));

const sortSiteBanners = (items: SiteBanner[]) =>
    [...items].sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt));

const mapSiteBanner = (
    row: Pick<SiteBannerRow, 'id' | 'title' | 'image_url' | 'display_order' | 'is_active' | 'created_at'>,
): SiteBanner => ({
    id: row.id,
    title: row.title,
    imageUrl: row.image_url,
    displayOrder: row.display_order,
    isActive: row.is_active,
    createdAt: row.created_at,
});

export const getCurrentSeason = async (): Promise<SeasonSummary | null> => {
    if (!isSupabaseConfigured) {
        return [...localState.seasons]
            .filter((season) => season.status === 'active')
            .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null;
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
        return fallback(
            'getCurrentSeason',
            () =>
                [...localState.seasons]
                    .filter((season) => season.status === 'active')
                    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0] ?? null,
            error,
        );
    }
};

export const getSeasons = async (): Promise<SeasonSummary[]> => {
    if (!isSupabaseConfigured) {
        return [...localState.seasons].sort((a, b) => b.startDate.localeCompare(a.startDate));
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

        return ((data ?? []) as Pick<SeasonRow, 'id' | 'name' | 'status' | 'start_date' | 'end_date'>[]).map((season) => ({
            id: season.id,
            name: season.name,
            status: season.status,
            startDate: season.start_date,
            endDate: season.end_date,
        }));
    } catch (error) {
        return fallback('getSeasons', () => [...localState.seasons].sort((a, b) => b.startDate.localeCompare(a.startDate)), error);
    }
};

export const getAnnouncements = async (): Promise<AnnouncementItem[]> => {
    if (!isSupabaseConfigured) {
        return sortAnnouncements(localState.announcements.filter((item) => item.isActive));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('announcements')
            .select('id, title, body, starts_at, ends_at, is_pinned, is_active, created_at')
            .eq('is_active', true)
            .order('is_pinned', { ascending: false })
            .order('starts_at', { ascending: false });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Array<
            Pick<AnnouncementRow, 'id' | 'title' | 'body' | 'starts_at' | 'ends_at' | 'is_pinned' | 'is_active' | 'created_at'>
        >).map((item) => ({
            id: item.id,
            title: item.title,
            body: item.body,
            startAt: item.starts_at,
            endAt: item.ends_at,
            isPinned: item.is_pinned,
            isActive: item.is_active,
            createdAt: item.created_at,
        }));
    } catch (error) {
        return fallback('getAnnouncements', () => sortAnnouncements(localState.announcements.filter((item) => item.isActive)), error);
    }
};

export const getScheduleEvents = async (): Promise<ScheduleEventItem[]> => {
    if (!isSupabaseConfigured) {
        return sortScheduleEvents(localState.scheduleEvents.filter((item) => item.isActive));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('schedule_events')
            .select('id, title, description, location, start_at, end_at, season_id, is_active, created_at')
            .eq('is_active', true)
            .order('start_at', { ascending: true });

        if (error) {
            throw error;
        }

        return ((data ?? []) as Array<
            Pick<ScheduleEventRow, 'id' | 'title' | 'description' | 'location' | 'start_at' | 'end_at' | 'season_id' | 'is_active' | 'created_at'>
        >).map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            location: item.location,
            startAt: item.start_at,
            endAt: item.end_at,
            seasonId: item.season_id,
            isActive: item.is_active,
            createdAt: item.created_at,
        }));
    } catch (error) {
        return fallback('getScheduleEvents', () => sortScheduleEvents(localState.scheduleEvents.filter((item) => item.isActive)), error);
    }
};

export const getSiteBanners = async (): Promise<SiteBanner[]> => {
    if (!isSupabaseConfigured) {
        return sortSiteBanners(localState.siteBanners.filter((item) => item.isActive));
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client
            .from('site_banners')
            .select('id, title, image_url, display_order, is_active, created_at')
            .eq('is_active', true)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) {
            throw error;
        }

        return sortSiteBanners(
            ((data ?? []) as Array<
                Pick<SiteBannerRow, 'id' | 'title' | 'image_url' | 'display_order' | 'is_active' | 'created_at'>
            >).map(mapSiteBanner),
        );
    } catch (error) {
        if (isMissingSupabaseRelationError(error, ['site_banners'])) {
            console.warn('[data] site_banners table is unavailable in Supabase; returning an empty list instead.');
            return [];
        }

        return fallback('getSiteBanners', () => sortSiteBanners(localState.siteBanners.filter((item) => item.isActive)), error);
    }
};

export const getBadges = async (options?: { includeInactive?: boolean }): Promise<Badge[]> => {
    const includeInactive = options?.includeInactive ?? false;

    if (!isSupabaseConfigured) {
        return [...localState.badges]
            .filter((badge) => includeInactive || badge.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));
    }

    try {
        const client = getSupabaseClient();
        let query = client
            .from('badges')
            .select('id, code, name, description, icon_key, image_url, tone, evaluation_scope, criteria_json, sort_order, is_active')
            .order('sort_order', { ascending: true });

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            throw error;
        }

        return ((data ?? []) as Array<
            Pick<BadgeRow, 'id' | 'code' | 'name' | 'description' | 'icon_key' | 'image_url' | 'tone' | 'evaluation_scope' | 'criteria_json' | 'sort_order' | 'is_active'>
        >).map(mapBadgeRow);
    } catch (error) {
        return fallback(
            'getBadges',
            () => [...localState.badges]
                .filter((badge) => includeInactive || badge.isActive !== false)
                .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name)),
            error,
        );
    }
};
