import { useCallback, useEffect, useState } from 'react';
import type {
    ActivityLog,
    Member,
    MemberBadge,
    RecapSnapshot,
    SeasonSummary,
} from '../../../types';
import {
    getCurrentSeason,
    getLogs,
    getMemberBadges,
    getMembers,
    getRecapSnapshots,
    getSeasons,
} from '../../../lib/api/stats/overview';

type StatsResourcesState = {
    members: Member[];
    logs: ActivityLog[];
    memberBadges: MemberBadge[];
    seasons: SeasonSummary[];
    currentSeason: SeasonSummary | null;
    recapSnapshots: RecapSnapshot[];
};

const initialState: StatsResourcesState = {
    members: [],
    logs: [],
    memberBadges: [],
    seasons: [],
    currentSeason: null,
    recapSnapshots: [],
};

const loadStatsResources = async (): Promise<StatsResourcesState> => {
    const [
        members,
        logs,
        currentSeason,
        memberBadges,
        seasons,
        recapSnapshots,
    ] = await Promise.all([
        getMembers(),
        getLogs(),
        getCurrentSeason(),
        getMemberBadges(),
        getSeasons(),
        getRecapSnapshots({ scope: 'overall', limit: 6 }),
    ]);

    return {
        members,
        logs,
        memberBadges,
        seasons,
        currentSeason,
        recapSnapshots,
    };
};

export const useStatsResources = () => {
    const [resources, setResources] = useState<StatsResourcesState>(initialState);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        const nextResources = await loadStatsResources();
        setResources(nextResources);
        setIsLoading(false);
    }, []);

    const refreshSnapshots = useCallback(async () => {
        const nextSnapshots = await getRecapSnapshots({ scope: 'overall', limit: 6 });
        setResources((current) => ({
            ...current,
            recapSnapshots: nextSnapshots,
        }));
        return nextSnapshots;
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const nextResources = await loadStatsResources();
            if (!isMounted) {
                return;
            }

            setResources(nextResources);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    return {
        ...resources,
        isLoading,
        refreshData,
        refreshSnapshots,
    };
};
