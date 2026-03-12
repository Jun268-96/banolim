import React, { useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    CalendarClock,
    CircleSlash,
    ClipboardList,
    Clock3,
    History,
    Link2,
    MessageSquareWarning,
    RotateCcw,
    TriangleAlert,
    Users2,
} from 'lucide-react';
import type {
    ActivityLog,
    AttendanceSession,
    AuditLogEntry,
    Category,
    CorrectionRequest,
    CorrectionRequestStatus,
    Member,
    SeasonSummary,
} from '../../types';
import {
    createActivityEntry,
    getAttendanceSessions,
    getCategories,
    getCorrectionRequests,
    getCurrentSeason,
    getAuditLogs,
    getLogs,
    getMembers,
    reverseActivityEntry,
    updateCorrectionRequestStatus,
} from '../../lib/db';
import { AttendanceSessionManager } from './AttendanceSessionManager';

type EntryMode = 'attendance' | 'record';
type RecordSourceMode = 'attendance' | 'manual';

type RecordDraftRow = {
    selected: boolean;
    categoryId: string;
    note: string;
};

const entryModeMeta: Record<EntryMode, { label: string; title: string; description: string }> = {
    attendance: {
        label: '출석 세션',
        title: '관리자가 직접 여닫는 출석 세션 모드',
        description: '출석 세션을 만들고, 대상자 카드를 눌러 출석·지각·결석 상태를 바로 저장합니다.',
    },
    record: {
        label: '기록 세션',
        title: '출석 외 활동 규칙을 한 화면에서 정리하는 통합 기록 모드',
        description: '출석 세션 명단을 그대로 가져오거나 직접 대상을 고른 뒤, 공통 규칙과 개별 override를 함께 적용합니다.',
    },
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

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

const toOccurredAt = (dateValue: string) =>
    dateValue ? new Date(`${dateValue}T12:00:00`).toISOString() : new Date().toISOString();

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

const attendanceRuleNames = new Set(['정기모임 출석', '지각', '불참']);

const isAttendanceCategory = (category: Category) => {
    if (attendanceRuleNames.has(category.categoryName)) {
        return true;
    }

    const groupName = category.groupName?.trim();
    if (groupName === '출석') {
        return true;
    }

    return false;
};

export const ActivitiesTab: React.FC = () => {
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [entryMode, setEntryMode] = useState<EntryMode>('attendance');

    const [recordSourceMode, setRecordSourceMode] = useState<RecordSourceMode>('attendance');
    const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] = useState('');
    const [selectedManualTeamFilter, setSelectedManualTeamFilter] = useState('all');
    const [recordDate, setRecordDate] = useState(new Date().toISOString().slice(0, 10));
    const [recordTitle, setRecordTitle] = useState('활동 기록');
    const [recordNote, setRecordNote] = useState('');
    const [recordEvidenceUrl, setRecordEvidenceUrl] = useState('');
    const [recordBulkCategoryId, setRecordBulkCategoryId] = useState('');
    const [recordDraft, setRecordDraft] = useState<Record<string, RecordDraftRow>>({});

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [reversingRecordId, setReversingRecordId] = useState<string | null>(null);
    const [updatingCorrectionRequestId, setUpdatingCorrectionRequestId] = useState<string | null>(null);
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
        const usableCategories = categoriesData.filter((category) => !isAttendanceCategory(category));
        setSeason(seasonData);
        setMembers(membersData);
        setCategories(categoriesData);
        setLogs(logsData);
        setAttendanceSessions(attendanceSessionsData);
        setAuditLogs(auditLogsData);
        setCorrectionRequests(correctionRequestData);
        setRecordBulkCategoryId((current) => current || usableCategories[0]?.id || '');
        setSelectedAttendanceSessionId((current) => current || attendanceSessionsData[0]?.id || '');
        setIsLoading(false);
    };

    useEffect(() => {
        void refreshData();
    }, []);

    const activeMembers = useMemo(
        () => members.filter((member) => member.status !== 'inactive'),
        [members],
    );

    const recordCategories = useMemo(
        () => categories.filter((category) => !isAttendanceCategory(category)),
        [categories],
    );

    const selectedAttendanceSession = useMemo(
        () => attendanceSessions.find((session) => session.id === selectedAttendanceSessionId) ?? null,
        [attendanceSessions, selectedAttendanceSessionId],
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

    const manualMembers = useMemo(
        () =>
            activeMembers.filter((member) => {
                if (selectedManualTeamFilter === 'all') {
                    return true;
                }

                if (selectedManualTeamFilter === 'ungrouped') {
                    return (member.teamIds ?? []).length === 0 && !member.teamId;
                }

                return (member.teamIds ?? []).includes(selectedManualTeamFilter) || member.teamId === selectedManualTeamFilter;
            }),
        [activeMembers, selectedManualTeamFilter],
    );

    const attendanceSourceMembers = useMemo(() => {
        if (!selectedAttendanceSession) {
            return [] as Member[];
        }

        const memberMap = new Map(activeMembers.map((member) => [member.id, member]));
        return selectedAttendanceSession.entries
            .map((entry) => memberMap.get(entry.memberId))
            .filter((member): member is Member => Boolean(member));
    }, [activeMembers, selectedAttendanceSession]);

    const recordSourceMembers = recordSourceMode === 'attendance' ? attendanceSourceMembers : manualMembers;

    const recordDraftRows = useMemo(
        () =>
            recordSourceMembers.map((member) => {
                const row = recordDraft[member.id] ?? {
                    selected: false,
                    categoryId: '',
                    note: '',
                };

                const category = recordCategories.find((item) => item.id === row.categoryId) ?? null;
                const attendanceEntry = selectedAttendanceSession?.entries.find((entry) => entry.memberId === member.id) ?? null;

                return {
                    member,
                    row,
                    category,
                    attendanceEntry,
                };
            }),
        [recordCategories, recordDraft, recordSourceMembers, selectedAttendanceSession],
    );

    const selectedRecordRows = useMemo(
        () => recordDraftRows.filter((row) => row.row.selected),
        [recordDraftRows],
    );

    const incompleteRecordRows = useMemo(
        () => selectedRecordRows.filter((row) => !row.row.categoryId),
        [selectedRecordRows],
    );

    const recordPreviewRows = useMemo(
        () => selectedRecordRows.filter((row) => row.category),
        [selectedRecordRows],
    );

    const recordExpectedDelta = useMemo(
        () => recordPreviewRows.reduce((sum, row) => sum + (row.category?.pointValue ?? 0), 0),
        [recordPreviewRows],
    );

    const recordCategorySummary = useMemo(
        () =>
            recordPreviewRows.reduce<Array<{
                categoryId: string;
                categoryName: string;
                count: number;
                delta: number;
                version: number;
            }>>((acc, row) => {
                if (!row.category) {
                    return acc;
                }

                const existing = acc.find((item) => item.categoryId === row.category?.id);
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
        [recordPreviewRows],
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

    const selectedEntryModeMeta = entryModeMeta[entryMode];

    const updateRecordRow = (memberId: string, updater: (current: RecordDraftRow) => RecordDraftRow) => {
        setRecordDraft((current) => {
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

    const handleRecordMemberToggle = (memberId: string) => {
        updateRecordRow(memberId, (current) => ({
            ...current,
            selected: !current.selected,
            categoryId: current.categoryId || recordBulkCategoryId || '',
        }));
    };

    const handleRecordCategoryChange = (memberId: string, categoryId: string) => {
        updateRecordRow(memberId, (current) => ({
            ...current,
            selected: true,
            categoryId,
        }));
    };

    const handleRecordNoteChange = (memberId: string, value: string) => {
        updateRecordRow(memberId, (current) => ({
            ...current,
            note: value,
        }));
    };

    const handleRecordSourceModeChange = (value: RecordSourceMode) => {
        setRecordSourceMode(value);
        setRecordDraft({});
    };

    const handleAttendanceSourceChange = (sessionId: string) => {
        setSelectedAttendanceSessionId(sessionId);
        setRecordDraft({});
    };

    const handleManualTeamFilterChange = (value: string) => {
        setSelectedManualTeamFilter(value);
        setRecordDraft({});
    };

    const applyBulkCategoryToVisibleMembers = () => {
        if (!recordBulkCategoryId) {
            return;
        }

        setRecordDraft((current) => {
            const next = { ...current };
            recordSourceMembers.forEach((member) => {
                next[member.id] = {
                    selected: true,
                    categoryId: recordBulkCategoryId,
                    note: current[member.id]?.note ?? '',
                };
            });
            return next;
        });
    };

    const clearRecordSourceMembers = () => {
        setRecordDraft((current) => {
            const next = { ...current };
            recordSourceMembers.forEach((member) => {
                delete next[member.id];
            });
            return next;
        });
    };

    const handleRecordSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (recordPreviewRows.length === 0 || incompleteRecordRows.length > 0) {
            return;
        }

        setIsSaving(true);

        try {
            const occurredAt = toOccurredAt(recordDate);
            const baseTitle = recordTitle.trim() || '활동 기록';
            const sharedNote = recordNote.trim();

            for (const preview of recordPreviewRows) {
                if (!preview.category) {
                    continue;
                }

                const memberNote = preview.row.note.trim();
                const mergedNote = [sharedNote, memberNote].filter(Boolean).join(' · ');
                await createActivityEntry(preview.member.id, preview.category.id, mergedNote || undefined, {
                    occurredAt,
                    reason: `${baseTitle} · ${preview.category.categoryName}`,
                    evidenceUrl: recordEvidenceUrl,
                });
            }

            setRecordDraft({});
            setRecordNote('');
            setRecordEvidenceUrl('');
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

    const handleCorrectionRequestStatusUpdate = async (
        request: CorrectionRequest,
        status: CorrectionRequestStatus,
    ) => {
        setUpdatingCorrectionRequestId(request.id);
        await updateCorrectionRequestStatus(request.id, status, reviewNotes[request.id]);
        await refreshData();
        setUpdatingCorrectionRequestId(null);
    };

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
                    <p className="text-slate-500 mt-1">출석 세션과 기록 세션 두 흐름으로 운영 기록을 정리합니다.</p>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm lg:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setEntryMode('attendance')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'attendance'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        출석 세션
                    </button>
                    <button
                        type="button"
                        onClick={() => setEntryMode('record')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'record'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        기록 세션
                    </button>
                </div>
            </header>

            {entryMode !== 'attendance' && (
                <section className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="text-xs font-semibold tracking-[0.18em] text-indigo-500">
                                현재 모드 · {selectedEntryModeMeta.label}
                            </div>
                            <h3 className="mt-1 text-lg font-bold text-slate-950">{selectedEntryModeMeta.title}</h3>
                            <p className="mt-1 text-sm text-slate-600">{selectedEntryModeMeta.description}</p>
                        </div>
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
                            출석 규칙은 출석 세션에서 처리되고, 여기서는 출석 외 활동 규칙만 추가로 기록합니다.
                        </div>
                    </div>
                </section>
            )}

            {entryMode === 'attendance' ? (
                <AttendanceSessionManager
                    season={season}
                    members={members}
                    categories={categories}
                    sessions={attendanceSessions}
                    onRefresh={refreshData}
                />
            ) : (
                <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[460px_minmax(0,1fr)]">
                    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/90 px-3 py-1 text-xs font-semibold text-violet-700">
                                <Users2 size={14} />
                                통합 기록 세션
                            </div>
                            <h3 className="mt-4 text-xl font-bold text-slate-950">출석 외 활동 규칙 기록</h3>
                            <p className="mt-2 text-sm text-slate-600">
                                기존 출석 세션 명단을 불러오거나 직접 대상을 골라, 발표·참여·운영지원 같은 활동을 한 번에 저장합니다.
                            </p>
                        </div>

                        <form className="space-y-5 p-6" onSubmit={handleRecordSubmit}>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => handleRecordSourceModeChange('attendance')}
                                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                                        recordSourceMode === 'attendance'
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="text-sm font-semibold">출석 세션 연동</div>
                                    <div className="mt-1 text-xs leading-5 text-inherit/80">이미 만들어진 출석 세션 명단을 그대로 가져옵니다.</div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleRecordSourceModeChange('manual')}
                                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                                        recordSourceMode === 'manual'
                                            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="text-sm font-semibold">직접 선택</div>
                                    <div className="mt-1 text-xs leading-5 text-inherit/80">전체/팀 기준으로 원하는 멤버를 직접 고릅니다.</div>
                                </button>
                            </div>

                            {recordSourceMode === 'attendance' ? (
                                <label className="space-y-1.5 block">
                                    <span className="text-xs font-medium text-slate-600">연동할 출석 세션</span>
                                    <select
                                        value={selectedAttendanceSessionId}
                                        onChange={(event) => handleAttendanceSourceChange(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {attendanceSessions.map((session) => (
                                            <option key={session.id} value={session.id}>
                                                {session.title} · {session.targetGroupLabel} · {formatDateTime(session.startsAt)}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : (
                                <label className="space-y-1.5 block">
                                    <span className="text-xs font-medium text-slate-600">직접 선택 대상 그룹</span>
                                    <select
                                        value={selectedManualTeamFilter}
                                        onChange={(event) => handleManualTeamFilterChange(event.target.value)}
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
                            )}

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">기록 날짜</span>
                                    <input
                                        type="date"
                                        value={recordDate}
                                        onChange={(event) => setRecordDate(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">세션 제목</span>
                                    <input
                                        type="text"
                                        value={recordTitle}
                                        onChange={(event) => setRecordTitle(event.target.value)}
                                        placeholder="예: 3월 정기모임 부가 활동"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                            </div>

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-medium text-slate-600">공통 메모</span>
                                <textarea
                                    value={recordNote}
                                    onChange={(event) => setRecordNote(event.target.value)}
                                    rows={3}
                                    placeholder="예: 발표 3건, 운영지원 2건, 현장 정리 반영"
                                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>

                            <label className="space-y-1.5 block">
                                <span className="text-xs font-medium text-slate-600">증빙 링크</span>
                                <input
                                    type="url"
                                    value={recordEvidenceUrl}
                                    onChange={(event) => setRecordEvidenceUrl(event.target.value)}
                                    placeholder="예: 회의록, 발표 자료, 결과물 링크"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                                    <label className="flex-1 space-y-1.5">
                                        <span className="text-xs font-medium text-slate-600">현재 범위 기본 규칙</span>
                                        <select
                                            value={recordBulkCategoryId}
                                            onChange={(event) => setRecordBulkCategoryId(event.target.value)}
                                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                        >
                                            {recordCategories.map((category) => (
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
                                            onClick={applyBulkCategoryToVisibleMembers}
                                            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                                        >
                                            현재 범위 기본 적용
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearRecordSourceMembers}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-white"
                                        >
                                            현재 범위 초기화
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {incompleteRecordRows.length > 0 && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                    <div className="flex items-start gap-2">
                                        <TriangleAlert size={18} className="mt-0.5" />
                                        <div>
                                            <div className="font-semibold">아직 규칙이 비어 있는 선택 항목이 있습니다.</div>
                                            <div className="mt-1">
                                                {incompleteRecordRows.map((row) => row.member.name).join(', ')} 행에 활동 규칙을 지정한 뒤 저장해 주세요.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={recordPreviewRows.length === 0 || incompleteRecordRows.length > 0 || isSaving}
                                className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isSaving ? '기록 세션 저장 중...' : '기록 세션 저장'}
                            </button>
                        </form>
                    </section>

                    <section className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500">현재 범위 멤버</div>
                                <div className="mt-2 text-3xl font-bold text-slate-900">{recordSourceMembers.length}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500">선택 완료</div>
                                <div className="mt-2 text-3xl font-bold text-slate-900">{selectedRecordRows.length}</div>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                <div className="text-sm text-slate-500">예상 총점</div>
                                <div className={`mt-2 text-3xl font-bold ${recordExpectedDelta >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                    {recordExpectedDelta > 0 ? '+' : ''}
                                    {recordExpectedDelta}점
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                <div>
                                    <div className="font-semibold text-slate-900">대상 선택 및 override</div>
                                    <div className="mt-1 text-sm text-slate-500">대상을 고르고, 필요하면 각 멤버별로 다른 규칙이나 메모를 덮어씁니다.</div>
                                </div>
                                <div className="rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                                    {recordSourceMembers.length}명
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[540px] overflow-auto p-6">
                                {recordDraftRows.map((preview) => (
                                    <div key={preview.member.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="min-w-0">
                                                <label className="inline-flex items-center gap-3 text-sm font-semibold text-slate-900">
                                                    <input
                                                        type="checkbox"
                                                        checked={preview.row.selected}
                                                        onChange={() => handleRecordMemberToggle(preview.member.id)}
                                                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    <span>{preview.member.name}</span>
                                                </label>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {(preview.member.teamNames?.join(', ') || preview.member.teamName) || '팀 미지정'}
                                                    <span className="text-slate-300"> · </span>
                                                    {preview.member.roleName || '역할 없음'}
                                                    <span className="text-slate-300"> · </span>
                                                    현재 {preview.member.score}점
                                                    {preview.attendanceEntry ? (
                                                        <>
                                                            <span className="text-slate-300"> · </span>
                                                            출석 상태 {preview.attendanceEntry.status === 'present' ? '출석' : preview.attendanceEntry.status === 'late' ? '지각' : '결석'}
                                                        </>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {preview.category && preview.row.selected && (
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
                                            )}
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                                            <label className="space-y-1.5">
                                                <span className="text-xs font-medium text-slate-600">활동 규칙</span>
                                                <select
                                                    value={preview.row.categoryId}
                                                    onChange={(event) => handleRecordCategoryChange(preview.member.id, event.target.value)}
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                >
                                                    <option value="">규칙 선택</option>
                                                    {recordCategories.map((categoryOption) => (
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
                                                    value={preview.row.note}
                                                    onChange={(event) => handleRecordNoteChange(preview.member.id, event.target.value)}
                                                    placeholder="예: 발표 담당, 운영 지원, 현장 정리"
                                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </label>
                                        </div>

                                        {preview.category && (
                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                                <div className="font-medium text-slate-900">{preview.category.categoryName}</div>
                                                <div className="mt-1">{preview.category.conditionSummary ?? '추가 조건 요약이 아직 등록되지 않았습니다.'}</div>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                {recordSourceMembers.length === 0 && (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                                        현재 범위에 표시할 멤버가 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                <div>
                                    <div className="font-semibold text-slate-900">저장 미리보기</div>
                                    <div className="mt-1 text-sm text-slate-500">선택된 멤버와 규칙 구성을 저장 전에 확인합니다.</div>
                                </div>
                                <div className="rounded-full bg-slate-50 px-3 py-1 text-sm font-semibold text-slate-700">
                                    {recordPreviewRows.length}건
                                </div>
                            </div>

                            <div className="space-y-4 p-6">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                                    {recordCategorySummary.map((summary) => (
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

                                    {recordCategorySummary.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
                                            아직 저장할 활동 기록 선택이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

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
                                                    아직 활동 기록이 없습니다. 기록 세션에서 첫 기록을 추가해 주세요.
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
            )}
        </div>
    );
};
