import { useCallback, useEffect, useState } from 'react';
import type {
    ActivityLog,
    Member,
    MemberBadge,
    SeasonSummary,
} from '../../../types';
import {
    getCurrentSeason,
    getLogs,
    getMemberBadges,
    getMembers,
    getSeasons,
} from '../../../lib/api/stats/overview';

type StatsResourcesState = {
    members: Member[];
    logs: ActivityLog[];
    memberBadges: MemberBadge[];
    seasons: SeasonSummary[];
    currentSeason: SeasonSummary | null;
};

const initialState: StatsResourcesState = {
    members: [],
    logs: [],
    memberBadges: [],
    seasons: [],
    currentSeason: null,
};

const loadStatsResources = async (): Promise<StatsResourcesState> => {
    const members = await getMembers();
    const [logs, currentSeason, memberBadges, seasons] = await Promise.all([
        getLogs(members),
        getCurrentSeason(),
        getMemberBadges(),
        getSeasons(),
    ]);

    return {
        members,
        logs,
        memberBadges,
        seasons,
        currentSeason,
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
    };
};
