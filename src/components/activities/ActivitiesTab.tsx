import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowUpRight,
    BadgeCheck,
    CalendarClock,
    CheckCircle2,
    CircleSlash,
    ClipboardList,
    Clock3,
    History,
    Link2,
    MessageSquareWarning,
    PlusCircle,
    RotateCcw,
    Sparkles,
    TriangleAlert,
    Users2,
} from 'lucide-react';
import type { ActivityLog, AttendanceSession, AuditLogEntry, Category, CorrectionRequest, CorrectionRequestStatus, Member, SeasonSummary } from '../../types';
import {
    closeAttendanceSession,
    createActivityEntry,
    createBatchActivityEntries,
    createAttendanceSession,
    getCorrectionRequests,
    getAttendanceSessions,
    getCategories,
    getAuditLogs,
    getCurrentSeason,
    getLogs,
    getMembers,
    reverseActivityEntry,
    updateCorrectionRequestStatus,
} from '../../lib/db';

type EntryMode = 'attendance' | 'session' | 'single' | 'mixed';
type AttendanceStatus = 'present' | 'late' | 'absent';
type MixedDraftRow = {
    selected: boolean;
    categoryId: string;
    note: string;
};

const attendanceStatuses: AttendanceStatus[] = ['present', 'late', 'absent'];
const attendanceStatusLabels: Record<AttendanceStatus, string> = {
    present: '참석',
    late: '지각',
    absent: '불참',
};
const attendanceStatusDescriptions: Record<AttendanceStatus, string> = {
    present: '정상 출석으로 처리합니다.',
    late: '지각으로 처리하고 감점을 적용합니다.',
    absent: '불참으로 기록합니다.',
};
const attendanceStatusStyles: Record<AttendanceStatus, string> = {
    present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    late: 'border-amber-200 bg-amber-50 text-amber-700',
    absent: 'border-slate-200 bg-slate-100 text-slate-700',
};
const attendanceStatusButtonStyles: Record<AttendanceStatus, string> = {
    present: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50',
    late: 'border-amber-200 text-amber-700 hover:bg-amber-50',
    absent: 'border-slate-300 text-slate-700 hover:bg-slate-100',
};

const correctionRequestStatusLabels: Record<CorrectionRequestStatus, string> = {
    pending: '접수됨',
    reviewing: '검토 중',
    resolved: '해결 완료',
    rejected: '반려',
};

const correctionRequestStatusClasses: Record<CorrectionRequestStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    reviewing: 'border-sky-200 bg-sky-50 text-sky-700',
    resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
};
const attendanceStatusIcons = {
    present: CheckCircle2,
    late: Clock3,
    absent: CircleSlash,
} satisfies Record<AttendanceStatus, React.ComponentType<{ size?: number; className?: string }>>;

const attendanceRuleMatchers: Record<AttendanceStatus, RegExp> = {
    present: /(정기모임\s*출석|출석|참석|attendance|present)/i,
    late: /(지각|late)/i,
    absent: /(불참|결석|absence|absent)/i,
};

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

const toOccurredAt = (dateValue: string) =>
    dateValue ? new Date(`${dateValue}T12:00:00`).toISOString() : new Date().toISOString();

const toDateTimeInputValue = (value?: string | null) => {
    const source = value ? new Date(value) : new Date();
    const year = source.getFullYear();
    const month = `${source.getMonth() + 1}`.padStart(2, '0');
    const day = `${source.getDate()}`.padStart(2, '0');
    const hours = `${source.getHours()}`.padStart(2, '0');
    const minutes = `${source.getMinutes()}`.padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toIsoFromLocalDateTime = (value: string) =>
    value ? new Date(value).toISOString() : new Date().toISOString();

const getAttendanceRule = (categories: Category[], status: AttendanceStatus) =>
    categories.find((category) => {
        if (!attendanceRuleMatchers[status].test(category.categoryName)) {
            return false;
        }

        if (status === 'present') {
            return !attendanceRuleMatchers.late.test(category.categoryName)
                && !attendanceRuleMatchers.absent.test(category.categoryName);
        }

        return true;
    }) ?? null;

const getActivityStateInfo = (log: ActivityLog) => {
    if (log.isReversal) {
        return {
            label: '취소 로그',
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        };
    }

    if (log.recordStatus === 'reversed') {
        return {
            label: '취소됨',
            className: 'border-slate-200 bg-slate-100 text-slate-700',
        };
    }

    return {
        label: '정상',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    };
};

const getAuditDelta = (auditLog: AuditLogEntry) =>
    typeof auditLog.diff?.delta === 'number' ? auditLog.diff.delta : null;

export const ActivitiesTab: React.FC = () => {
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [entryMode, setEntryMode] = useState<EntryMode>('attendance');

    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [note, setNote] = useState('');
    const [singleEvidenceUrl, setSingleEvidenceUrl] = useState('');

    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    const [attendanceTitle, setAttendanceTitle] = useState('정기모임');
    const [attendanceNote, setAttendanceNote] = useState('');
    const [attendanceEvidenceUrl, setAttendanceEvidenceUrl] = useState('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
    const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceStatus>>({});

    const [mixedDate, setMixedDate] = useState(new Date().toISOString().slice(0, 10));
    const [mixedTitle, setMixedTitle] = useState('운영 활동');
    const [mixedNote, setMixedNote] = useState('');
    const [mixedEvidenceUrl, setMixedEvidenceUrl] = useState('');
    const [selectedMixedTeamFilter, setSelectedMixedTeamFilter] = useState('all');
    const [mixedBulkCategoryId, setMixedBulkCategoryId] = useState('');
    const [mixedDraft, setMixedDraft] = useState<Record<string, MixedDraftRow>>({});

    const [sessionTitle, setSessionTitle] = useState('정기모임 링크 출석');
    const [sessionCategoryId, setSessionCategoryId] = useState('');
    const [sessionStartsAt, setSessionStartsAt] = useState(() => toDateTimeInputValue());
    const [sessionEndsAt, setSessionEndsAt] = useState('');
    const [sessionNote, setSessionNote] = useState('');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [reversingRecordId, setReversingRecordId] = useState<string | null>(null);
    const [updatingCorrectionRequestId, setUpdatingCorrectionRequestId] = useState<string | null>(null);
    const [closingSessionId, setClosingSessionId] = useState<string | null>(null);
    const [copiedSessionValue, setCopiedSessionValue] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

    const refreshData = async () => {
        setIsLoading(true);
        const [seasonData, membersData, categoriesData, logsData, attendanceSessionsData, auditLogsData, correctionRequestData] = await Promise.all([
            getCurrentSeason(),
            getMembers(),
            getCategories(),
            getLogs(),
            getAttendanceSessions(),
            getAuditLogs(),
            getCorrectionRequests(),
        ]);
        const firstActiveMemberId = membersData.find((member) => member.status !== 'inactive')?.id ?? '';
        const defaultAttendanceRuleId = getAttendanceRule(categoriesData, 'present')?.id ?? categoriesData[0]?.id ?? '';
        setSeason(seasonData);
        setMembers(membersData);
        setCategories(categoriesData);
        setLogs(logsData);
        setAttendanceSessions(attendanceSessionsData);
        setAuditLogs(auditLogsData);
        setCorrectionRequests(correctionRequestData);
        setSelectedMemberId((current) => current || firstActiveMemberId);
        setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
        setMixedBulkCategoryId((current) => current || categoriesData[0]?.id || '');
        setSessionCategoryId((current) => current || defaultAttendanceRuleId);
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [seasonData, membersData, categoriesData, logsData, attendanceSessionsData, auditLogsData, correctionRequestData] = await Promise.all([
                getCurrentSeason(),
                getMembers(),
                getCategories(),
                getLogs(),
                getAttendanceSessions(),
                getAuditLogs(),
                getCorrectionRequests(),
            ]);
            const firstActiveMemberId = membersData.find((member) => member.status !== 'inactive')?.id ?? '';
            const defaultAttendanceRuleId = getAttendanceRule(categoriesData, 'present')?.id ?? categoriesData[0]?.id ?? '';

            if (!isMounted) {
                return;
            }

            setSeason(seasonData);
            setMembers(membersData);
            setCategories(categoriesData);
            setLogs(logsData);
            setAttendanceSessions(attendanceSessionsData);
            setAuditLogs(auditLogsData);
            setCorrectionRequests(correctionRequestData);
            setSelectedMemberId((current) => current || firstActiveMemberId);
            setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
            setMixedBulkCategoryId((current) => current || categoriesData[0]?.id || '');
            setSessionCategoryId((current) => current || defaultAttendanceRuleId);
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!copiedSessionValue) {
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setCopiedSessionValue(null);
        }, 1800);

        return () => window.clearTimeout(timeoutId);
    }, [copiedSessionValue]);

    const activeMembers = useMemo(
        () => members.filter((member) => member.status !== 'inactive'),
        [members],
    );

    const effectiveLogs = useMemo(
        () => logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed'),
        [logs],
    );

    const teamOptions = useMemo(
        () =>
            activeMembers
                .reduce<Array<{ id: string; name: string }>>((acc, member) => {
                    const teamIds = member.teamIds ?? (member.teamId ? [member.teamId] : []);
                    const teamNames = member.teamNames ?? (member.teamName ? [member.teamName] : []);

                    teamIds.forEach((teamId, index) => {
                        const teamName = teamNames[index] ?? member.teamName ?? null;
                        if (!teamName || acc.some((team) => team.id === teamId)) {
                            return;
                        }
                        acc.push({ id: teamId, name: teamName });
                    });

                    return acc;
                }, [])
                .sort((a, b) => a.name.localeCompare(b.name)),
        [activeMembers],
    );

    const filteredAttendanceMembers = useMemo(
        () =>
            activeMembers.filter((member) => {
                if (selectedTeamFilter === 'all') {
                    return true;
                }

                if (selectedTeamFilter === 'ungrouped') {
                    return (member.teamIds ?? []).length === 0 && !member.teamId;
                }

                return (member.teamIds ?? []).includes(selectedTeamFilter) || member.teamId === selectedTeamFilter;
            }),
        [activeMembers, selectedTeamFilter],
    );

    const filteredMixedMembers = useMemo(
        () =>
            activeMembers.filter((member) => {
                if (selectedMixedTeamFilter === 'all') {
                    return true;
                }

                if (selectedMixedTeamFilter === 'ungrouped') {
                    return (member.teamIds ?? []).length === 0 && !member.teamId;
                }

                return (member.teamIds ?? []).includes(selectedMixedTeamFilter) || member.teamId === selectedMixedTeamFilter;
            }),
        [activeMembers, selectedMixedTeamFilter],
    );

    const attendanceRules = useMemo(
        () => ({
            present: getAttendanceRule(categories, 'present'),
            late: getAttendanceRule(categories, 'late'),
            absent: getAttendanceRule(categories, 'absent'),
        }),
        [categories],
    );

    const selectedCategory = useMemo(
        () => categories.find((category) => category.id === selectedCategoryId) ?? null,
        [categories, selectedCategoryId],
    );

    const selectedSessionCategory = useMemo(
        () => categories.find((category) => category.id === sessionCategoryId) ?? null,
        [categories, sessionCategoryId],
    );

    const activeAttendanceSessions = useMemo(
        () => attendanceSessions.filter((session) => session.isActive),
        [attendanceSessions],
    );

    const totalAttendanceCheckIns = useMemo(
        () => attendanceSessions.reduce((sum, session) => sum + (session.checkInCount ?? 0), 0),
        [attendanceSessions],
    );

    const recommendedSessionRules = useMemo(() => {
        const preferredIds = new Set(
            [attendanceRules.present?.id, attendanceRules.late?.id, attendanceRules.absent?.id].filter((value): value is string => Boolean(value)),
        );

        if (preferredIds.size === 0) {
            return categories;
        }

        const preferred = categories.filter((category) => preferredIds.has(category.id));
        const others = categories.filter((category) => !preferredIds.has(category.id));
        return [...preferred, ...others];
    }, [attendanceRules.absent?.id, attendanceRules.late?.id, attendanceRules.present?.id, categories]);

    const mixedPreviewRows = useMemo(
        () =>
            filteredMixedMembers.flatMap((member) => {
                const row = mixedDraft[member.id];
                if (!row?.selected || !row.categoryId) {
                    return [];
                }

                const category = categories.find((item) => item.id === row.categoryId);
                if (!category) {
                    return [];
                }

                return [{
                    member,
                    row,
                    category,
                }];
            }),
        [categories, filteredMixedMembers, mixedDraft],
    );

    const incompleteMixedMembers = useMemo(
        () =>
            filteredMixedMembers.filter((member) => {
                const row = mixedDraft[member.id];
                return Boolean(row?.selected && !row.categoryId);
            }),
        [filteredMixedMembers, mixedDraft],
    );

    const mixedExpectedDelta = useMemo(
        () => mixedPreviewRows.reduce((sum, row) => sum + row.category.pointValue, 0),
        [mixedPreviewRows],
    );

    const mixedCategorySummary = useMemo(
        () =>
            mixedPreviewRows.reduce<Array<{
                categoryId: string;
                categoryName: string;
                count: number;
                delta: number;
                version: number;
            }>>((acc, row) => {
                const existing = acc.find((item) => item.categoryId === row.category.id);
                if (existing) {
                    existing.count += 1;
                    existing.delta += row.category.pointValue;
                    return acc;
                }

                return [
                    ...acc,
                    {
                        categoryId: row.category.id,
                        categoryName: row.category.categoryName,
                        count: 1,
                        delta: row.category.pointValue,
                        version: row.category.version ?? 1,
                    },
                ];
            }, []).sort((a, b) => b.count - a.count || a.categoryName.localeCompare(b.categoryName)),
        [mixedPreviewRows],
    );

    const attendancePreviewRows = useMemo(
        () =>
            filteredAttendanceMembers.flatMap((member) => {
                const status = attendanceDraft[member.id];
                if (!status) {
                    return [];
                }

                return [{
                    member,
                    status,
                    category: attendanceRules[status],
                }];
            }),
        [attendanceDraft, attendanceRules, filteredAttendanceMembers],
    );

    const attendanceStatusCounts = useMemo(
        () =>
            attendancePreviewRows.reduce<Record<AttendanceStatus, number>>((acc, row) => {
                acc[row.status] += 1;
                return acc;
            }, {
                present: 0,
                late: 0,
                absent: 0,
            }),
        [attendancePreviewRows],
    );

    const missingAttendanceRules = attendanceStatuses.filter(
        (status) => attendanceStatusCounts[status] > 0 && !attendanceRules[status],
    );

    const expectedAttendanceDelta = attendancePreviewRows.reduce(
        (sum, row) => sum + (row.category?.pointValue ?? 0),
        0,
    );

    const correctionRequestCounts = useMemo(
        () =>
            correctionRequests.reduce<Record<CorrectionRequestStatus, number>>((acc, request) => {
                acc[request.status] += 1;
                return acc;
            }, {
                pending: 0,
                reviewing: 0,
                resolved: 0,
                rejected: 0,
            }),
        [correctionRequests],
    );

    const handleAttendanceStatusChange = (memberId: string, status: AttendanceStatus) => {
        setAttendanceDraft((current) => {
            if (current[memberId] === status) {
                const next = { ...current };
                delete next[memberId];
                return next;
            }

            return {
                ...current,
                [memberId]: status,
            };
        });
    };

    const applyStatusToFilteredMembers = (status: AttendanceStatus) => {
        setAttendanceDraft((current) => {
            const next = { ...current };
            filteredAttendanceMembers.forEach((member) => {
                next[member.id] = status;
            });
            return next;
        });
    };

    const clearFilteredAttendance = () => {
        setAttendanceDraft((current) => {
            const next = { ...current };
            filteredAttendanceMembers.forEach((member) => {
                delete next[member.id];
            });
            return next;
        });
    };

    const handleMixedTeamFilterChange = (value: string) => {
        setSelectedMixedTeamFilter(value);
        setMixedDraft({});
    };

    const updateMixedRow = (memberId: string, updater: (current: MixedDraftRow) => MixedDraftRow) => {
        setMixedDraft((current) => {
            const baseRow = current[memberId] ?? {
                selected: false,
                categoryId: '',
                note: '',
            };

            return {
                ...current,
                [memberId]: updater(baseRow),
            };
        });
    };

    const handleMixedMemberToggle = (memberId: string) => {
        updateMixedRow(memberId, (current) => ({
            ...current,
            selected: !current.selected,
            categoryId: current.categoryId || mixedBulkCategoryId || '',
        }));
    };

    const handleMixedCategoryChange = (memberId: string, categoryId: string) => {
        updateMixedRow(memberId, (current) => ({
            ...current,
            selected: true,
            categoryId,
        }));
    };

    const handleMixedNoteChange = (memberId: string, value: string) => {
        updateMixedRow(memberId, (current) => ({
            ...current,
            note: value,
        }));
    };

    const applyBulkCategoryToFilteredMembers = () => {
        if (!mixedBulkCategoryId) {
            return;
        }

        setMixedDraft((current) => {
            const next = { ...current };
            filteredMixedMembers.forEach((member) => {
                next[member.id] = {
                    selected: true,
                    categoryId: mixedBulkCategoryId,
                    note: current[member.id]?.note ?? '',
                };
            });
            return next;
        });
    };

    const clearMixedFilteredMembers = () => {
        setMixedDraft((current) => {
            const next = { ...current };
            filteredMixedMembers.forEach((member) => {
                delete next[member.id];
            });
            return next;
        });
    };

    const handleAttendanceSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (attendancePreviewRows.length === 0 || missingAttendanceRules.length > 0) {
            return;
        }

        setIsSaving(true);

        const baseTitle = attendanceTitle.trim() || '정기모임';
        const sharedNote = attendanceNote.trim()
            ? `${baseTitle} · ${attendanceNote.trim()}`
            : `${baseTitle} 출석 입력`;
        const occurredAt = toOccurredAt(attendanceDate);

        for (const status of attendanceStatuses) {
            const category = attendanceRules[status];
            const memberIds = attendancePreviewRows
                .filter((row) => row.status === status)
                .map((row) => row.member.id);

            if (!category || memberIds.length === 0) {
                continue;
            }

            await createBatchActivityEntries(memberIds, category.id, sharedNote, {
                occurredAt,
                reason: `${baseTitle} · ${attendanceStatusLabels[status]}`,
                evidenceUrl: attendanceEvidenceUrl,
            });
        }

        setAttendanceDraft({});
        setAttendanceNote('');
        setAttendanceEvidenceUrl('');
        await refreshData();
        setIsSaving(false);
    };

    const handleSingleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedMemberId || !selectedCategoryId) {
            return;
        }

        setIsSaving(true);
        await createActivityEntry(selectedMemberId, selectedCategoryId, note, {
            evidenceUrl: singleEvidenceUrl,
        });
        setNote('');
        setSingleEvidenceUrl('');
        await refreshData();
        setIsSaving(false);
    };

    const handleMixedSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (mixedPreviewRows.length === 0 || incompleteMixedMembers.length > 0) {
            return;
        }

        setIsSaving(true);

        try {
            const occurredAt = toOccurredAt(mixedDate);
            const baseTitle = mixedTitle.trim() || '운영 활동';
            const sharedNote = mixedNote.trim();

            for (const preview of mixedPreviewRows) {
                const memberNote = preview.row.note.trim();
                const mergedNote = [sharedNote, memberNote].filter(Boolean).join(' · ');
                await createActivityEntry(preview.member.id, preview.category.id, mergedNote || undefined, {
                    occurredAt,
                    reason: `${baseTitle} · ${preview.category.categoryName}`,
                    evidenceUrl: mixedEvidenceUrl,
                });
            }

            setMixedDraft({});
            setMixedNote('');
            setMixedEvidenceUrl('');
            await refreshData();
        } finally {
            setIsSaving(false);
        }
    };

    const handleReverseLog = async (log: ActivityLog) => {
        if (!log.recordId || log.isReversal || log.recordStatus === 'reversed') {
            return;
        }

        const baseLabel = log.reason ?? log.categoryName ?? '활동';
        const input = window.prompt(
            `${baseLabel} 기록을 취소합니다. 사유를 남겨 주세요.`,
            `${baseLabel} 기록 취소`,
        );

        if (input === null) {
            return;
        }

        setReversingRecordId(log.recordId);
        await reverseActivityEntry(log.recordId, input.trim() || `${baseLabel} 기록 취소`);
        await refreshData();
        setReversingRecordId(null);
    };

    const handleTeamFilterChange = (value: string) => {
        setSelectedTeamFilter(value);
        setAttendanceDraft({});
    };

    const handleCorrectionRequestStatusUpdate = async (
        request: CorrectionRequest,
        status: CorrectionRequestStatus,
    ) => {
        setUpdatingCorrectionRequestId(request.id);
        await updateCorrectionRequestStatus(request.id, status, reviewNotes[request.id]);
        await refreshData();
        setUpdatingCorrectionRequestId(null);
    };

    const handleCreateAttendanceSession = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!sessionCategoryId || !sessionTitle.trim()) {
            return;
        }

        setIsSaving(true);

        try {
            await createAttendanceSession({
                title: sessionTitle,
                pointRuleId: sessionCategoryId,
                startsAt: toIsoFromLocalDateTime(sessionStartsAt),
                endsAt: sessionEndsAt ? toIsoFromLocalDateTime(sessionEndsAt) : null,
                note: sessionNote,
            });

            setSessionTitle('정기모임 링크 출석');
            setSessionStartsAt(toDateTimeInputValue());
            setSessionEndsAt('');
            setSessionNote('');
            await refreshData();
        } finally {
            setIsSaving(false);
        }
    };

    const handleCloseAttendanceSession = async (sessionId: string) => {
        setClosingSessionId(sessionId);
        try {
            await closeAttendanceSession(sessionId);
            await refreshData();
        } finally {
            setClosingSessionId(null);
        }
    };

    const handleCopySessionValue = async (value: string) => {
        await navigator.clipboard.writeText(value);
        setCopiedSessionValue(value);
    };

    const getAttendanceLink = (sessionCode: string) =>
        `${window.location.origin}/?attendance=${encodeURIComponent(sessionCode)}#`;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">활동 데이터를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList className="text-indigo-600" />
                        활동 기록
                    </h2>
                    <p className="text-slate-500 mt-1">출석 일괄 입력, 회원별 혼합 배치, 개별 활동 기록까지 운영 흐름에 맞춰 한 화면에서 처리합니다.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm lg:grid-cols-4">
                    <button
                        type="button"
                        onClick={() => setEntryMode('attendance')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'attendance'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        정기모임 출석
                    </button>
                    <button
                        type="button"
                        onClick={() => setEntryMode('session')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'session'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        링크 출석
                    </button>
                    <button
                        type="button"
                        onClick={() => setEntryMode('mixed')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'mixed'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        혼합 배치
                    </button>
                    <button
                        type="button"
                        onClick={() => setEntryMode('single')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'single'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        개별 활동
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
                <section>
                    {entryMode === 'attendance' ? (
                        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6">
                                <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700">
                                    <Sparkles size={14} />
                                    운영진 워크플로
                                </div>
                                <h3 className="mt-4 text-xl font-bold text-slate-950">정기모임 출석 입력</h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    대상 그룹을 고르고, 회원별로 참석/지각/불참 상태를 지정한 뒤 저장 전 미리보기까지 확인합니다.
                                </p>

                                <div className="mt-5 rounded-2xl border border-sky-200 bg-white/90 p-4">
                                    <div className="text-xs font-semibold tracking-wide text-sky-700">적용 시즌</div>
                                    <div className="mt-2 text-lg font-bold text-slate-900">{season?.name ?? '활성 시즌 없음'}</div>
                                    <div className="mt-1 text-sm text-slate-500">
                                        {season
                                            ? `${formatDate(season.startDate)} - ${formatDate(season.endDate)} 기준으로 자동 저장됩니다.`
                                            : '활성 시즌이 없으면 기록은 저장되지만 시즌 연결은 비어 있을 수 있습니다.'}
                                    </div>
                                </div>
                            </div>

                            <form className="space-y-5 p-6" onSubmit={handleAttendanceSubmit}>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">모임 날짜</span>
                                        <input
                                            type="date"
                                            value={attendanceDate}
                                            onChange={(event) => setAttendanceDate(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">대상 그룹</span>
                                        <select
                                            value={selectedTeamFilter}
                                            onChange={(event) => handleTeamFilterChange(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="all">전체 멤버</option>
                                            <option value="ungrouped">팀 미지정</option>
                                            {teamOptions.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">기록 제목</span>
                                    <input
                                        type="text"
                                        value={attendanceTitle}
                                        onChange={(event) => setAttendanceTitle(event.target.value)}
                                        placeholder="예: 3월 둘째 주 정기모임"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">공통 메모</span>
                                    <textarea
                                        value={attendanceNote}
                                        onChange={(event) => setAttendanceNote(event.target.value)}
                                        rows={3}
                                        placeholder="예: 전체 OT 공지 후 출석 점검"
                                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">증빙 링크</span>
                                    <input
                                        type="url"
                                        value={attendanceEvidenceUrl}
                                        onChange={(event) => setAttendanceEvidenceUrl(event.target.value)}
                                        placeholder="예: 구글 시트 출석부, 공지 문서 링크"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <div className="flex flex-wrap gap-2">
                                    {attendanceStatuses.map((status) => {
                                        const Icon = attendanceStatusIcons[status];

                                        return (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => applyStatusToFilteredMembers(status)}
                                                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${attendanceStatusButtonStyles[status]}`}
                                            >
                                                <Icon size={16} />
                                                전원 {attendanceStatusLabels[status]}
                                            </button>
                                        );
                                    })}
                                    <button
                                        type="button"
                                        onClick={clearFilteredAttendance}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                                    >
                                        현재 선택 초기화
                                    </button>
                                </div>

                                {missingAttendanceRules.length > 0 && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                        <div className="flex items-start gap-2">
                                            <TriangleAlert size={18} className="mt-0.5" />
                                            <div>
                                                <div className="font-semibold">저장 전 확인이 필요합니다.</div>
                                                <div className="mt-1">
                                                    {missingAttendanceRules.map((status) => attendanceStatusLabels[status]).join(', ')}
                                                    {' '}규칙이 설정되지 않아 현재 선택은 저장할 수 없습니다. 설정에서 해당 규칙을 먼저 추가해 주세요.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-slate-900">대상 멤버</div>
                                            <div className="mt-1 text-sm text-slate-500">현재 범위에서 상태를 지정할 회원들입니다.</div>
                                        </div>
                                        <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                                            {filteredAttendanceMembers.length}명
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3 max-h-[440px] overflow-auto pr-1">
                                        {filteredAttendanceMembers.map((member) => (
                                            <div
                                                key={member.id}
                                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium text-slate-900">{member.name}</div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {(member.teamNames?.join(', ') || member.teamName) || '팀 미지정'}
                                                            <span className="text-slate-300"> · </span>
                                                            {member.roleName || '역할 없음'}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-indigo-600">{member.score}점</div>
                                                </div>

                                            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                                    {attendanceStatuses.map((status) => {
                                                        const Icon = attendanceStatusIcons[status];
                                                        const isSelected = attendanceDraft[member.id] === status;

                                                        return (
                                                            <button
                                                                key={status}
                                                                type="button"
                                                                onClick={() => handleAttendanceStatusChange(member.id, status)}
                                                        className={`rounded-xl border px-3 py-2 text-left transition-all ${
                                                                    isSelected
                                                                        ? `${attendanceStatusStyles[status]} shadow-sm`
                                                                        : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2 text-sm font-semibold">
                                                                    <Icon size={16} />
                                                                    {attendanceStatusLabels[status]}
                                                                </div>
                                                                <div className="mt-1 text-xs opacity-80">
                                                                    {attendanceStatusDescriptions[status]}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {filteredAttendanceMembers.length === 0 && (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                                                현재 범위에 표시할 멤버가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={attendancePreviewRows.length === 0 || missingAttendanceRules.length > 0 || isSaving}
                                    className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isSaving ? '출석 저장 중...' : '출석 일괄 저장'}
                                </button>
                            </form>
                        </div>
                    ) : entryMode === 'session' ? (
                        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6">
                                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/90 px-3 py-1 text-xs font-semibold text-indigo-700">
                                    <Link2 size={14} />
                                    링크/코드 출석
                                </div>
                                <h3 className="mt-4 text-xl font-bold text-slate-950">셀프 체크인 세션 생성</h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    운영진이 출석 세션을 열면 회원은 링크를 누르거나 코드를 입력해서 직접 체크인할 수 있습니다. 중복 체크인은 자동으로 막습니다.
                                </p>

                                <div className="mt-5 rounded-2xl border border-indigo-200 bg-white/90 p-4">
                                    <div className="text-xs font-semibold tracking-wide text-indigo-700">운영 팁</div>
                                    <div className="mt-2 text-sm leading-6 text-slate-600">
                                        정기모임 시작 전에 세션을 만들고 공지에 링크를 공유하면, 별도 수기 입력 없이 회원이 직접 출석을 완료할 수 있습니다.
                                    </div>
                                </div>
                            </div>

                            <form className="space-y-5 p-6" onSubmit={handleCreateAttendanceSession}>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">세션 제목</span>
                                    <input
                                        type="text"
                                        value={sessionTitle}
                                        onChange={(event) => setSessionTitle(event.target.value)}
                                        placeholder="예: 3월 둘째 주 정기모임 셀프 체크인"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">출석 처리 규칙</span>
                                        <select
                                            value={sessionCategoryId}
                                            onChange={(event) => setSessionCategoryId(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="">규칙 선택</option>
                                            {recommendedSessionRules.map((category) => (
                                                <option key={category.id} value={category.id}>
                                                    {category.categoryName} ({category.pointValue > 0 ? '+' : ''}
                                                    {category.pointValue})
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">시작 시각</span>
                                        <input
                                            type="datetime-local"
                                            value={sessionStartsAt}
                                            onChange={(event) => setSessionStartsAt(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">종료 시각</span>
                                        <input
                                            type="datetime-local"
                                            value={sessionEndsAt}
                                            onChange={(event) => setSessionEndsAt(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </label>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="text-xs font-medium text-slate-500">현재 적용 규칙</div>
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                {selectedSessionCategory ? `v${selectedSessionCategory.version ?? 1}` : '규칙 미선택'}
                                            </span>
                                            {selectedSessionCategory && (
                                                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                    selectedSessionCategory.pointValue >= 0
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                        : 'border-rose-200 bg-rose-50 text-rose-700'
                                                }`}>
                                                    {selectedSessionCategory.pointValue > 0 ? '+' : ''}
                                                    {selectedSessionCategory.pointValue}점
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 text-sm text-slate-600">
                                            {selectedSessionCategory?.conditionSummary ?? '선택한 규칙의 설명이 여기에 표시됩니다.'}
                                        </div>
                                    </div>
                                </div>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">세션 메모</span>
                                    <textarea
                                        value={sessionNote}
                                        onChange={(event) => setSessionNote(event.target.value)}
                                        rows={3}
                                        placeholder="예: OT 공지 후 10분간 셀프 체크인 허용"
                                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={!sessionTitle.trim() || !sessionCategoryId || isSaving}
                                    className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isSaving ? '세션 생성 중...' : '출석 세션 생성'}
                                </button>
                            </form>
                        </div>
                    ) : entryMode === 'mixed' ? (
                        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6">
                                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700">
                                    <Sparkles size={14} />
                                    운영 입력 확장
                                </div>
                                <h3 className="mt-4 text-xl font-bold text-slate-950">혼합 배치 입력</h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    하나의 활동 안에서 회원별로 서로 다른 규칙과 메모를 적용합니다. 공통 정보는 공유하고, 결과는 각 행에서 세밀하게 조정합니다.
                                </p>

                                <div className="mt-5 rounded-2xl border border-violet-200 bg-white/90 p-4">
                                    <div className="text-xs font-semibold tracking-wide text-violet-700">활용 예시</div>
                                    <div className="mt-2 text-sm leading-6 text-slate-600">
                                        같은 세션에서 발표자, 참여자, 운영 지원, 불참자를 동시에 기록할 수 있습니다.
                                    </div>
                                </div>
                            </div>

                            <form className="space-y-5 p-6" onSubmit={handleMixedSubmit}>
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">활동 날짜</span>
                                        <input
                                            type="date"
                                            value={mixedDate}
                                            onChange={(event) => setMixedDate(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </label>
                                    <label className="space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">대상 그룹</span>
                                        <select
                                            value={selectedMixedTeamFilter}
                                            onChange={(event) => handleMixedTeamFilterChange(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        >
                                            <option value="all">전체 멤버</option>
                                            <option value="ungrouped">팀 미지정</option>
                                            {teamOptions.map((team) => (
                                                <option key={team.id} value={team.id}>
                                                    {team.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">공통 활동 제목</span>
                                    <input
                                        type="text"
                                        value={mixedTitle}
                                        onChange={(event) => setMixedTitle(event.target.value)}
                                        placeholder="예: 3월 기획 회의 / 스터디 데모데이"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">공통 메모</span>
                                    <textarea
                                        value={mixedNote}
                                        onChange={(event) => setMixedNote(event.target.value)}
                                        rows={3}
                                        placeholder="예: 월간 데모데이, 발표 4건과 운영 지원 2건 반영"
                                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">공통 증빙 링크</span>
                                    <input
                                        type="url"
                                        value={mixedEvidenceUrl}
                                        onChange={(event) => setMixedEvidenceUrl(event.target.value)}
                                        placeholder="예: 회의록, 발표 자료 모음, 출석 시트"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                        <label className="flex-1 space-y-1.5">
                                            <span className="text-xs font-medium text-slate-600">현재 범위 기본 규칙</span>
                                            <select
                                                value={mixedBulkCategoryId}
                                                onChange={(event) => setMixedBulkCategoryId(event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            >
                                                {categories.map((category) => (
                                                    <option key={category.id} value={category.id}>
                                                        {category.categoryName} ({category.pointValue > 0 ? '+' : ''}
                                                        {category.pointValue})
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={applyBulkCategoryToFilteredMembers}
                                                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                                            >
                                                현재 범위 기본 적용
                                            </button>
                                            <button
                                                type="button"
                                                onClick={clearMixedFilteredMembers}
                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
                                            >
                                                현재 범위 초기화
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {incompleteMixedMembers.length > 0 && (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                        <div className="flex items-start gap-2">
                                            <TriangleAlert size={18} className="mt-0.5" />
                                            <div>
                                                <div className="font-semibold">아직 규칙이 비어 있는 선택 항목이 있습니다.</div>
                                                <div className="mt-1">
                                                    {incompleteMixedMembers.map((member) => member.name).join(', ')}
                                                    {' '}행에 활동 규칙을 지정한 뒤 저장해 주세요.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-semibold text-slate-900">회원별 결과 입력</div>
                                            <div className="mt-1 text-sm text-slate-500">선택한 회원에게만 기록이 저장됩니다. 각 행에서 규칙과 세부 메모를 따로 지정할 수 있습니다.</div>
                                        </div>
                                        <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                                            {filteredMixedMembers.length}명
                                        </div>
                                    </div>

                                    <div className="mt-4 space-y-3 max-h-[520px] overflow-auto pr-1">
                                        {filteredMixedMembers.map((member) => {
                                            const row = mixedDraft[member.id] ?? {
                                                selected: false,
                                                categoryId: '',
                                                note: '',
                                            };
                                            const category = categories.find((item) => item.id === row.categoryId) ?? null;

                                            return (
                                                <div key={member.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                                        <div className="min-w-0">
                                                            <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-900">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={row.selected}
                                                                    onChange={() => handleMixedMemberToggle(member.id)}
                                                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                                />
                                                                <span>{member.name}</span>
                                                            </label>
                                                            <div className="mt-1 text-sm text-slate-500">
                                                                {(member.teamNames?.join(', ') || member.teamName) || '팀 미지정'}
                                                                <span className="text-slate-300"> · </span>
                                                                {member.roleName || '역할 없음'}
                                                                <span className="text-slate-300"> · </span>
                                                                현재 {member.score}점
                                                            </div>
                                                        </div>

                                                        {category && row.selected && (
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                                    v{category.version ?? 1}
                                                                </span>
                                                                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                    category.pointValue >= 0
                                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                        : 'border-rose-200 bg-rose-50 text-rose-700'
                                                                }`}>
                                                                    {category.pointValue > 0 ? '+' : ''}
                                                                    {category.pointValue}점
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                                                        <label className="space-y-1.5">
                                                            <span className="text-xs font-medium text-slate-600">활동 규칙</span>
                                                            <select
                                                                value={row.categoryId}
                                                                onChange={(event) => handleMixedCategoryChange(member.id, event.target.value)}
                                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                            >
                                                                <option value="">규칙 선택</option>
                                                                {categories.map((categoryOption) => (
                                                                    <option key={categoryOption.id} value={categoryOption.id}>
                                                                        {categoryOption.categoryName} ({categoryOption.pointValue > 0 ? '+' : ''}
                                                                        {categoryOption.pointValue})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>

                                                        <label className="space-y-1.5">
                                                            <span className="text-xs font-medium text-slate-600">개별 메모</span>
                                                            <input
                                                                type="text"
                                                                value={row.note}
                                                                onChange={(event) => handleMixedNoteChange(member.id, event.target.value)}
                                                                placeholder="예: 발표 담당, 운영 지원, 현장 정리"
                                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                            />
                                                        </label>
                                                    </div>

                                                    {category && (
                                                        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                                            <div className="font-medium text-slate-900">{category.categoryName}</div>
                                                            <div className="mt-1">
                                                                {category.conditionSummary ?? '추가 조건 요약이 아직 등록되지 않았습니다.'}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {filteredMixedMembers.length === 0 && (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                                                현재 범위에 표시할 멤버가 없습니다.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={mixedPreviewRows.length === 0 || incompleteMixedMembers.length > 0 || isSaving}
                                    className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isSaving ? '혼합 기록 저장 중...' : '혼합 활동 저장'}
                                </button>
                            </form>
                        </div>
                    ) : (
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <div className="flex items-center gap-2 text-slate-900 font-semibold mb-5">
                                <PlusCircle size={18} className="text-indigo-600" />
                                새 활동 기록
                            </div>

                            <form className="space-y-4" onSubmit={handleSingleSubmit}>
                                <label className="block space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">멤버</span>
                                    <select
                                        value={selectedMemberId}
                                        onChange={(event) => setSelectedMemberId(event.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm bg-white"
                                    >
                                        {activeMembers.map((member) => (
                                            <option key={member.id} value={member.id}>
                                                {member.name} {member.roleName ? `- ${member.roleName}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">활동 규칙</span>
                                    <select
                                        value={selectedCategoryId}
                                        onChange={(event) => setSelectedCategoryId(event.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm bg-white"
                                    >
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.categoryName} ({category.pointValue > 0 ? '+' : ''}
                                                {category.pointValue})
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="block space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">메모</span>
                                    <textarea
                                        value={note}
                                        onChange={(event) => setNote(event.target.value)}
                                        rows={4}
                                        placeholder="어떤 일이 있었는지, 나중에 봐도 이해할 수 있게 남겨 주세요."
                                        className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm resize-none"
                                    />
                                </label>

                                <label className="block space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">증빙 링크</span>
                                    <input
                                        type="url"
                                        value={singleEvidenceUrl}
                                        onChange={(event) => setSingleEvidenceUrl(event.target.value)}
                                        placeholder="예: 발표 자료, 회의록, 과제 제출 링크"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                    />
                                </label>

                                {selectedCategory && (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                v{selectedCategory.version ?? 1}
                                            </span>
                                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                기본 {selectedCategory.pointValue > 0 ? '+' : ''}
                                                {selectedCategory.pointValue}점
                                            </span>
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                                감점 {selectedCategory.penaltyPoint ?? 0}점
                                            </span>
                                        </div>
                                        <div className="mt-3 text-sm text-slate-600">
                                            {selectedCategory.conditionSummary ?? '추가 조건 요약이 아직 등록되지 않았습니다.'}
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={!selectedMemberId || !selectedCategoryId || isSaving}
                                    className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSaving ? '저장 중...' : '활동 기록 저장'}
                                </button>
                            </form>
                        </section>
                    )}
                </section>

                <section className="space-y-4">
                    {entryMode === 'attendance' ? (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">현재 범위 멤버</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{filteredAttendanceMembers.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">입력 예정</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{attendancePreviewRows.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">예상 총점</div>
                                    <div className={`mt-2 text-3xl font-bold ${expectedAttendanceDelta >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {expectedAttendanceDelta > 0 ? '+' : ''}
                                        {expectedAttendanceDelta}점
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                    <div>
                                        <div className="font-semibold text-slate-900">저장 미리보기</div>
                                        <div className="mt-1 text-sm text-slate-500">저장 직전에 상태별 인원과 점수 반영을 확인합니다.</div>
                                    </div>
                                    <div className="rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                                        {attendancePreviewRows.length}건
                                    </div>
                                </div>

                                <div className="space-y-4 p-6">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                        {attendanceStatuses.map((status) => {
                                            const Icon = attendanceStatusIcons[status];
                                            const category = attendanceRules[status];

                                            return (
                                                <div
                                                    key={status}
                                                    className={`rounded-2xl border p-4 ${attendanceStatusStyles[status]}`}
                                                >
                                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                                        <Icon size={16} />
                                                        {attendanceStatusLabels[status]}
                                                    </div>
                                                    <div className="mt-3 text-2xl font-bold">{attendanceStatusCounts[status]}명</div>
                                                    <div className="mt-1 text-sm opacity-80">
                                                        {category
                                                            ? `규칙 ${category.categoryName} · ${category.pointValue > 0 ? '+' : ''}${category.pointValue}점`
                                                            : '규칙 미설정'}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center gap-2 text-slate-900 font-semibold">
                                            <Users2 size={16} className="text-indigo-600" />
                                            저장 예정 멤버
                                        </div>
                                        <div className="mt-4 space-y-3 max-h-[320px] overflow-auto pr-1">
                                            {attendancePreviewRows.map((row) => (
                                                <div
                                                    key={`${row.member.id}-${row.status}`}
                                                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                                >
                                                    <div>
                                                        <div className="font-medium text-slate-900">{row.member.name}</div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {attendanceStatusLabels[row.status]}
                                                            <span className="text-slate-300"> · </span>
                                                            {row.category?.categoryName ?? '규칙 없음'}
                                                        </div>
                                                    </div>
                                                    <div className={`rounded-full px-3 py-1 text-sm font-semibold ${attendanceStatusStyles[row.status]}`}>
                                                        {row.category
                                                            ? `${row.category.pointValue > 0 ? '+' : ''}${row.category.pointValue}점`
                                                            : '미설정'}
                                                    </div>
                                                </div>
                                            ))}

                                            {attendancePreviewRows.length === 0 && (
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                                                    아직 저장할 출석 선택이 없습니다. 왼쪽에서 멤버별 상태를 지정해 주세요.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : entryMode === 'session' ? (
                        <>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">운영 중 세션</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{activeAttendanceSessions.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">누적 체크인</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{totalAttendanceCheckIns}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">전체 세션</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{attendanceSessions.length}</div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                                <div className="border-b border-slate-100 px-6 py-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                                <Link2 size={18} className="text-indigo-600" />
                                                출석 세션 관리
                                            </div>
                                            <div className="mt-1 text-sm text-slate-500">생성된 코드와 링크를 복사하고, 종료 시에는 세션을 닫아 중복 체크인을 막습니다.</div>
                                        </div>
                                        {copiedSessionValue && (
                                            <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                                복사 완료
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4 p-6">
                                    {attendanceSessions.map((session) => {
                                        const isClosing = closingSessionId === session.id;
                                        const sessionLink = getAttendanceLink(session.sessionCode);

                                        return (
                                            <div key={session.id} className="rounded-[24px] border border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 p-5">
                                                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                                                    <div className="space-y-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                session.isActive
                                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                    : 'border-slate-200 bg-slate-100 text-slate-700'
                                                            }`}>
                                                                {session.isActive ? '운영 중' : '종료됨'}
                                                            </span>
                                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                                {session.pointRuleName ?? '규칙 미확인'}
                                                            </span>
                                                        </div>

                                                        <div>
                                                            <div className="text-lg font-bold text-slate-950">{session.title}</div>
                                                            <div className="mt-1 text-sm text-slate-500">
                                                                시작 {formatDateTime(session.startsAt)}
                                                                {session.endsAt ? ` · 종료 ${formatDateTime(session.endsAt)}` : ' · 종료 시각 미설정'}
                                                            </div>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-white">
                                                            <div className="text-xs uppercase tracking-[0.16em] text-slate-400">출석 코드</div>
                                                            <div className="mt-2 text-2xl font-bold tracking-[0.28em]">{session.sessionCode}</div>
                                                            <div className="mt-2 text-xs text-slate-400">
                                                                링크를 열면 회원 홈에서 코드가 자동 입력됩니다.
                                                            </div>
                                                        </div>

                                                        {session.note && (
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                                                                {session.note}
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-3 2xl:w-[280px]">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">체크인</div>
                                                                <div className="mt-2 text-xl font-bold text-slate-950">{session.checkInCount ?? 0}명</div>
                                                            </div>
                                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                                <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">생성일</div>
                                                                <div className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(session.createdAt)}</div>
                                                            </div>
                                                        </div>

                                                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 break-all">
                                                            {sessionLink}
                                                        </div>

                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleCopySessionValue(session.sessionCode)}
                                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                                            >
                                                                코드 복사
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => void handleCopySessionValue(sessionLink)}
                                                                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                                                            >
                                                                링크 복사
                                                            </button>
                                                            <a
                                                                href={sessionLink}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100"
                                                            >
                                                                <ArrowUpRight size={15} />
                                                                링크 열기
                                                            </a>
                                                            {session.isActive && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleCloseAttendanceSession(session.id)}
                                                                    disabled={isClosing}
                                                                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                                                                >
                                                                    <CircleSlash size={15} />
                                                                    {isClosing ? '종료 중...' : '세션 종료'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {attendanceSessions.length === 0 && (
                                        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center text-sm text-slate-500">
                                            아직 생성된 출석 세션이 없습니다. 왼쪽에서 첫 링크 출석 세션을 열어 주세요.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : entryMode === 'mixed' ? (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">현재 범위 멤버</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{filteredMixedMembers.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">저장 예정 행</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{mixedPreviewRows.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">예상 총점</div>
                                    <div className={`mt-2 text-3xl font-bold ${mixedExpectedDelta >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {mixedExpectedDelta > 0 ? '+' : ''}
                                        {mixedExpectedDelta}점
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                    <div>
                                        <div className="font-semibold text-slate-900">저장 미리보기</div>
                                        <div className="mt-1 text-sm text-slate-500">회원별로 어떤 규칙이 적용되는지와 총점을 함께 확인합니다.</div>
                                    </div>
                                    <div className="rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                                        {mixedPreviewRows.length}건
                                    </div>
                                </div>

                                <div className="space-y-4 p-6">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                        {mixedCategorySummary.map((summary) => (
                                            <div key={summary.categoryId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                                                        v{summary.version}
                                                    </span>
                                                    <div className="text-sm font-semibold text-slate-900">{summary.categoryName}</div>
                                                </div>
                                                <div className="mt-3 text-2xl font-bold text-slate-900">{summary.count}명</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    예상 {summary.delta > 0 ? '+' : ''}
                                                    {summary.delta}점
                                                </div>
                                            </div>
                                        ))}

                                        {mixedCategorySummary.length === 0 && (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                                                아직 저장할 혼합 활동 선택이 없습니다. 왼쪽에서 회원별 결과를 지정해 주세요.
                                            </div>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex items-center gap-2 text-slate-900 font-semibold">
                                            <Users2 size={16} className="text-indigo-600" />
                                            저장 예정 멤버
                                        </div>
                                        <div className="mt-4 space-y-3 max-h-[360px] overflow-auto pr-1">
                                            {mixedPreviewRows.map((preview) => (
                                                <div
                                                    key={preview.member.id}
                                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                                >
                                                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                                        <div>
                                                            <div className="font-medium text-slate-900">{preview.member.name}</div>
                                                            <div className="mt-1 text-sm text-slate-500">
                                                                {preview.category.categoryName}
                                                                <span className="text-slate-300"> · </span>
                                                                {(preview.member.teamNames?.join(', ') || preview.member.teamName) || '팀 미지정'}
                                                            </div>
                                                            {preview.row.note && (
                                                                <div className="mt-2 text-sm text-slate-600">{preview.row.note}</div>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                                v{preview.category.version ?? 1}
                                                            </span>
                                                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                                preview.category.pointValue >= 0
                                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                                    : 'border-rose-200 bg-rose-50 text-rose-700'
                                                            }`}>
                                                                {preview.category.pointValue > 0 ? '+' : ''}
                                                                {preview.category.pointValue}점
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500">유효 활동 기록</div>
                                <div className="mt-2 text-3xl font-bold text-slate-900">{effectiveLogs.length}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500">활동 중 멤버</div>
                                <div className="mt-2 text-3xl font-bold text-slate-900">{activeMembers.length}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500">사용 가능한 규칙</div>
                                <div className="mt-2 text-3xl font-bold text-slate-900">{categories.length}</div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-slate-900 font-semibold">
                            <CalendarClock size={18} className="text-indigo-600" />
                            최근 활동 피드
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                        <th className="py-4 px-6 w-44">시각</th>
                                        <th className="py-4 px-6 w-44">멤버</th>
                                        <th className="py-4 px-6">규칙</th>
                                        <th className="py-4 px-6 w-24">점수</th>
                                        <th className="py-4 px-6 w-28">상태</th>
                                        <th className="py-4 px-6">메모</th>
                                        <th className="py-4 px-6 w-36">증빙</th>
                                        <th className="py-4 px-6 w-28 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.map((log) => {
                                        const activityState = getActivityStateInfo(log);
                                        const canReverse = Boolean(log.recordId) && !log.isReversal && log.recordStatus !== 'reversed';
                                        const isReversing = reversingRecordId === log.recordId;

                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="py-4 px-6 text-sm text-slate-600">{formatDateTime(log.timestamp)}</td>
                                                <td className="py-4 px-6 font-medium text-slate-900">{log.memberName ?? log.memberId}</td>
                                                <td className="py-4 px-6">
                                                    <div className="font-medium text-slate-900">{log.categoryName ?? log.categoryId}</div>
                                                    {log.reason && <div className="text-xs text-slate-500 mt-1">{log.reason}</div>}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${log.pointDelta >= 0
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}>
                                                        {log.pointDelta > 0 ? '+' : ''}
                                                        {log.pointDelta}점
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${activityState.className}`}>
                                                        {activityState.label}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-6 text-sm text-slate-600">{log.note || '-'}</td>
                                                <td className="py-4 px-6">
                                                    {log.evidenceUrl ? (
                                                        <a
                                                            href={log.evidenceUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                                                        >
                                                            <Link2 size={14} />
                                                            링크 보기
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6 text-center">
                                                    {canReverse ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReverseLog(log)}
                                                            disabled={isReversing}
                                                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                                        >
                                                            <RotateCcw size={14} />
                                                            {isReversing ? '취소 중...' : '기록 취소'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-500">
                                                아직 활동 기록이 없습니다. 왼쪽 폼에서 첫 기록을 추가해 주세요.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-2 text-slate-900 font-semibold">
                                <MessageSquareWarning size={18} className="text-indigo-600" />
                                정정 요청 검토
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(['pending', 'reviewing', 'resolved', 'rejected'] as CorrectionRequestStatus[]).map((status) => (
                                    <span key={status} className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${correctionRequestStatusClasses[status]}`}>
                                        {correctionRequestStatusLabels[status]} {correctionRequestCounts[status]}건
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {correctionRequests.slice(0, 8).map((request) => {
                                const isUpdating = updatingCorrectionRequestId === request.id;
                                const canReview = request.status === 'pending' || request.status === 'reviewing';

                                return (
                                    <div key={request.id} className="space-y-4 px-6 py-5">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-medium text-slate-900">{request.requesterName ?? '알 수 없는 회원'}</div>
                                                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[request.status]}`}>
                                                        {correctionRequestStatusLabels[request.status]}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {request.activitySummary ?? '활동 기록'}
                                                    {request.activityOccurredAt ? (
                                                        <>
                                                            <span className="text-slate-300"> · </span>
                                                            {formatDateTime(request.activityOccurredAt)}
                                                        </>
                                                    ) : null}
                                                    {typeof request.activityPointDelta === 'number' ? (
                                                        <>
                                                            <span className="text-slate-300"> · </span>
                                                            {request.activityPointDelta > 0 ? '+' : ''}
                                                            {request.activityPointDelta}점
                                                        </>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-500">{formatDateTime(request.createdAt)}</div>
                                        </div>

                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                                            {request.reason}
                                        </div>

                                        <textarea
                                            value={reviewNotes[request.id] ?? request.reviewNote ?? ''}
                                            onChange={(event) =>
                                                setReviewNotes((current) => ({
                                                    ...current,
                                                    [request.id]: event.target.value,
                                                }))
                                            }
                                            rows={3}
                                            placeholder="운영진 메모 또는 처리 결과를 남겨 주세요."
                                            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        />

                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div className="text-sm text-slate-500">
                                                {request.reviewedAt
                                                    ? `${request.reviewedByName ?? '운영진'} · ${formatDateTime(request.reviewedAt)}`
                                                    : '아직 검토 전입니다.'}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {canReview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleCorrectionRequestStatusUpdate(request, 'reviewing')}
                                                        disabled={isUpdating}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-100 disabled:opacity-50"
                                                    >
                                                        <Clock3 size={15} />
                                                        검토 시작
                                                    </button>
                                                )}
                                                {canReview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleCorrectionRequestStatusUpdate(request, 'resolved')}
                                                        disabled={isUpdating}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                                                    >
                                                        <BadgeCheck size={15} />
                                                        해결 완료
                                                    </button>
                                                )}
                                                {canReview && (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleCorrectionRequestStatusUpdate(request, 'rejected')}
                                                        disabled={isUpdating}
                                                        className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                                                    >
                                                        <CircleSlash size={15} />
                                                        반려
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {correctionRequests.length === 0 && (
                                <div className="px-6 py-12 text-center text-slate-500">
                                    아직 접수된 정정 요청이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-slate-900 font-semibold">
                            <History size={18} className="text-indigo-600" />
                            최근 운영 이력
                        </div>
                        <div className="divide-y divide-slate-100">
                            {auditLogs.slice(0, 8).map((auditLog) => {
                                const delta = getAuditDelta(auditLog);

                                return (
                                    <div key={auditLog.id} className="flex flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <div className="font-medium text-slate-900">{auditLog.summary}</div>
                                            <div className="mt-1 text-sm text-slate-500">
                                                {auditLog.actorName ?? '시스템'}
                                                <span className="text-slate-300"> · </span>
                                                {formatDateTime(auditLog.createdAt)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                                {auditLog.action === 'created' ? '생성' : auditLog.action === 'reversed' ? '취소' : auditLog.action}
                                            </span>
                                            {delta !== null && (
                                                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                                    delta >= 0
                                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                        : 'border-rose-200 bg-rose-50 text-rose-700'
                                                }`}>
                                                    {delta > 0 ? '+' : ''}
                                                    {delta}점
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {auditLogs.length === 0 && (
                                <div className="px-6 py-12 text-center text-slate-500">
                                    아직 운영 이력이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
