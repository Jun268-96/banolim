import { useCallback, useEffect, useState } from 'react';
import type {
    ActivityLog,
    AttendanceSession,
    AuditLogEntry,
    Category,
    CorrectionRequest,
    Member,
    SeasonSummary,
} from '../../../types';
import {
    getAttendanceSessions,
    getAuditLogs,
    getCategories,
    getCorrectionRequests,
    getCurrentSeason,
    getLogs,
    getMembers,
} from '../../../lib/api/activities/manage';

type ActivitiesResourcesState = {
    season: SeasonSummary | null;
    members: Member[];
    categories: Category[];
    logs: ActivityLog[];
    attendanceSessions: AttendanceSession[];
    auditLogs: AuditLogEntry[];
    correctionRequests: CorrectionRequest[];
};

const initialState: ActivitiesResourcesState = {
    season: null,
    members: [],
    categories: [],
    logs: [],
    attendanceSessions: [],
    auditLogs: [],
    correctionRequests: [],
};

const loadActivitiesResources = async (): Promise<ActivitiesResourcesState> => {
    const members = await getMembers();
    const [
        season,
        categories,
        logs,
        attendanceSessions,
        auditLogs,
        correctionRequests,
    ] = await Promise.all([
        getCurrentSeason(),
        getCategories(),
        getLogs(members),
        getAttendanceSessions(),
        getAuditLogs(),
        getCorrectionRequests(),
    ]);

    return {
        season,
        members,
        categories,
        logs,
        attendanceSessions,
        auditLogs,
        correctionRequests,
    };
};

export const useActivitiesResources = () => {
    const [resources, setResources] = useState<ActivitiesResourcesState>(initialState);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        const nextResources = await loadActivitiesResources();
        setResources(nextResources);
        setIsLoading(false);
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const nextResources = await loadActivitiesResources();
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
