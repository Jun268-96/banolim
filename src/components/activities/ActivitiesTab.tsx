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
    PlusCircle,
    RotateCcw,
    TriangleAlert,
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
import { AppDialog } from '../shared/AppDialog';

type EntryMode = 'attendance' | 'record' | 'feed';
type RecordSourceMode = 'attendance' | 'manual';

type RecordDraftRow = {
    selected: boolean;
    categoryId: string;
    note: string;
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

    return category.groupName?.trim() === '출석';
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
    const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);

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

    const resetRecordDraft = () => {
        setRecordDraft({});
        setRecordNote('');
        setRecordEvidenceUrl('');
    };

    const openAttendanceRecordModal = (sessionId: string) => {
        setRecordSourceMode('attendance');
        setSelectedAttendanceSessionId(sessionId);
        setRecordTitle('활동 기록');
        resetRecordDraft();
        setIsRecordModalOpen(true);
    };

    const openManualRecordModal = () => {
        setRecordSourceMode('manual');
        setRecordTitle('직접 활동 기록');
        resetRecordDraft();
        setIsRecordModalOpen(true);
    };

    const closeRecordModal = () => {
        setIsRecordModalOpen(false);
        resetRecordDraft();
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

            await refreshData();
            closeRecordModal();
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
                    <p className="text-slate-500 mt-1">출석 세션과 기록 세션, 활동 피드를 한 화면에서 오갑니다.</p>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
                    {[
                        { id: 'attendance', label: '출석 세션' },
                        { id: 'record', label: '기록 세션' },
                        { id: 'feed', label: '활동 피드' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setEntryMode(tab.id as EntryMode)}
                            className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                                entryMode === tab.id
                                    ? 'bg-indigo-600 text-white'
                                    : 'text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {entryMode === 'attendance' ? (
                <AttendanceSessionManager
                    season={season}
                    members={members}
                    categories={categories}
                    sessions={attendanceSessions}
                    onRefresh={refreshData}
                />
            ) : entryMode === 'record' ? (
                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-950">기록 세션 목록</h3>
                            <p className="mt-1 text-sm text-slate-500">출석 세션을 선택해 활동 기록을 추가하거나, 직접 기록을 열 수 있습니다.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openManualRecordModal}
                            className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                        >
                            <PlusCircle size={16} />
                            직접 기록
                        </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {attendanceSessions.map((session) => (
                            <button
                                key={session.id}
                                type="button"
                                onClick={() => openAttendanceRecordModal(session.id)}
                                className="flex w-full flex-col gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50"
                            >
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div>
                                        <div className="text-lg font-semibold text-slate-950">{session.title}</div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            {session.targetGroupLabel}
                                            <span className="text-slate-300"> · </span>
                                            {formatDateTime(session.startsAt)}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${session.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                                            {session.isActive ? '운영 중' : '마감됨'}
                                        </span>
                                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                            대상 {session.memberCount}명
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-3 text-sm text-slate-500 sm:max-w-xl">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        출석 {session.statusCounts.present ?? 0}
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        지각 {session.statusCounts.late ?? 0}
                                    </div>
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                                        결석 {session.statusCounts.absent ?? 0}
                                    </div>
                                </div>
                            </button>
                        ))}

                        {attendanceSessions.length === 0 && (
                            <div className="px-6 py-12 text-center text-slate-500">
                                먼저 출석 세션을 만들어야 기록 세션에서 명단을 연동할 수 있습니다.
                            </div>
                        )}
                    </div>
                </section>
            ) : (
                <section className="space-y-4">
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
                                                아직 활동 기록이 없습니다.
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
            )}

            <AppDialog
                isOpen={isRecordModalOpen}
                onClose={closeRecordModal}
                size="xl"
                title={recordSourceMode === 'attendance' ? (selectedAttendanceSession?.title ?? '기록 세션') : '직접 활동 기록'}
                description={recordSourceMode === 'attendance'
                    ? `${selectedAttendanceSession?.targetGroupLabel ?? '대상 그룹'} · ${selectedAttendanceSession ? formatDateTime(selectedAttendanceSession.startsAt) : ''}`
                    : '출석 세션 없이 직접 대상을 골라 활동 기록을 남깁니다.'}
            >
                <form className="space-y-5" onSubmit={handleRecordSubmit}>
                    {recordSourceMode === 'manual' ? (
                        <label className="space-y-1.5 block">
                            <span className="text-xs font-medium text-slate-600">대상 그룹</span>
                            <select
                                value={selectedManualTeamFilter}
                                onChange={(event) => setSelectedManualTeamFilter(event.target.value)}
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
                    ) : null}

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
                            <span className="text-xs font-medium text-slate-600">기록 제목</span>
                            <input
                                type="text"
                                value={recordTitle}
                                onChange={(event) => setRecordTitle(event.target.value)}
                                placeholder="예: 3월 정기모임 발표 기록"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                        <label className="space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">공통 규칙</span>
                            <select
                                value={recordBulkCategoryId}
                                onChange={(event) => setRecordBulkCategoryId(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {recordCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.categoryName} ({category.pointValue > 0 ? '+' : ''}{category.pointValue})
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="flex flex-wrap items-end gap-2">
                            <button
                                type="button"
                                onClick={applyBulkCategoryToVisibleMembers}
                                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                            >
                                현재 명단 전체 적용
                            </button>
                            <button
                                type="button"
                                onClick={clearRecordSourceMembers}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                현재 명단 초기화
                            </button>
                            <div className="ml-auto rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                                선택 {selectedRecordRows.length}명 · 예상 {recordExpectedDelta > 0 ? '+' : ''}{recordExpectedDelta}점
                            </div>
                        </div>
                    </div>

                    <label className="space-y-1.5 block">
                        <span className="text-xs font-medium text-slate-600">공통 메모</span>
                        <textarea
                            value={recordNote}
                            onChange={(event) => setRecordNote(event.target.value)}
                            rows={3}
                            placeholder="예: 발표 2건, 운영지원 1건, 현장 정리 반영"
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

                    {incompleteRecordRows.length > 0 ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <div className="flex items-start gap-2">
                                <TriangleAlert size={18} className="mt-0.5" />
                                <div>
                                    <div className="font-semibold">아직 규칙이 비어 있는 선택 항목이 있습니다.</div>
                                    <div className="mt-1">{incompleteRecordRows.map((row) => row.member.name).join(', ')} 항목의 규칙을 지정해 주세요.</div>
                                </div>
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                        <div className="mb-4 flex items-center justify-between gap-3">
                            <div>
                                <div className="font-semibold text-slate-900">기록 대상 선택</div>
                                <div className="mt-1 text-sm text-slate-500">카드를 눌러 대상을 고르고, 필요한 경우에만 규칙과 메모를 덮어씁니다.</div>
                            </div>
                            <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{recordSourceMembers.length}명</div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {recordDraftRows.map((preview) => {
                                const isSelected = preview.row.selected;
                                return (
                                    <button
                                        key={preview.member.id}
                                        type="button"
                                        onClick={() => handleRecordMemberToggle(preview.member.id)}
                                        className={`rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition-all ${
                                            isSelected
                                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {preview.member.name}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-5 space-y-3 max-h-[320px] overflow-auto pr-1">
                            {selectedRecordRows.map((preview) => (
                                <div key={preview.member.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="font-semibold text-slate-900">{preview.member.name}</div>
                                            <div className="mt-1 text-sm text-slate-500">
                                                {(preview.member.teamNames?.join(', ') || preview.member.teamName) || '팀 미지정'}
                                            </div>
                                        </div>
                                        {preview.attendanceEntry ? (
                                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                                출석 상태 {preview.attendanceEntry.status === 'present' ? '출석' : preview.attendanceEntry.status === 'late' ? '지각' : '결석'}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                                        <label className="space-y-1.5">
                                            <span className="text-xs font-medium text-slate-600">개별 규칙</span>
                                            <select
                                                value={preview.row.categoryId}
                                                onChange={(event) => handleRecordCategoryChange(preview.member.id, event.target.value)}
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            >
                                                <option value="">규칙 선택</option>
                                                {recordCategories.map((categoryOption) => (
                                                    <option key={categoryOption.id} value={categoryOption.id}>
                                                        {categoryOption.categoryName} ({categoryOption.pointValue > 0 ? '+' : ''}{categoryOption.pointValue})
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
                                                placeholder="예: 발표 담당, 운영 지원"
                                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                        <button
                            type="button"
                            onClick={closeRecordModal}
                            className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                        >
                            닫기
                        </button>
                        <button
                            type="submit"
                            disabled={recordPreviewRows.length === 0 || incompleteRecordRows.length > 0 || isSaving}
                            className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSaving ? '저장 중...' : '기록 저장'}
                        </button>
                    </div>
                </form>
            </AppDialog>
        </div>
    );
};
