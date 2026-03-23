import React, { useEffect, useMemo, useState } from 'react';
import {
    ClipboardList,
    PlusCircle,
} from 'lucide-react';
import type {
    ActivityLog,
    Category,
    CorrectionRequest,
    CorrectionRequestStatus,
    Member,
} from '../../types';
import {
    createActivityEntry,
    reverseActivityEntry,
    updateCorrectionRequestStatus,
} from '../../lib/api/activities/manage';
import { ActivityRecordDialog } from './dialogs/ActivityRecordDialog';
import { useActivitiesResources } from './hooks/useActivitiesResources';
import { ActivityFeedSection } from './sections/ActivityFeedSection';
import { AttendanceSessionManager } from './AttendanceSessionManager';
import { PointRulesManager } from './PointRulesManager';

type EntryMode = 'attendance' | 'record' | 'feed' | 'rules';
type RecordSourceMode = 'attendance' | 'manual';

type RecordDraftRow = {
    selected: boolean;
    categoryId: string;
    note: string;
};

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

const toOccurredAt = (dateValue: string) =>
    dateValue ? new Date(`${dateValue}T12:00:00`).toISOString() : new Date().toISOString();

const attendanceRuleNames = new Set(['정기모임 출석', '지각', '불참']);

const isAttendanceCategory = (category: Category) => {
    if (attendanceRuleNames.has(category.categoryName)) {
        return true;
    }

    return category.groupName?.trim() === 'attendance';
};

export const ActivitiesTab: React.FC = () => {
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

    const [isSaving, setIsSaving] = useState(false);
    const [reversingRecordId, setReversingRecordId] = useState<string | null>(null);
    const [updatingCorrectionRequestId, setUpdatingCorrectionRequestId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

    const {
        season,
        members,
        categories,
        logs,
        attendanceSessions,
        auditLogs,
        correctionRequests,
        isLoading,
        refreshData,
    } = useActivitiesResources();

    const activeMembers = useMemo(
        () => members.filter((member) => member.status !== 'inactive'),
        [members],
    );

    const recordCategories = useMemo(
        () => categories.filter((category) => !isAttendanceCategory(category)),
        [categories],
    );

    useEffect(() => {
        if (!recordBulkCategoryId && recordCategories[0]?.id) {
            setRecordBulkCategoryId(recordCategories[0].id);
        }
    }, [recordBulkCategoryId, recordCategories]);

    useEffect(() => {
        if (!selectedAttendanceSessionId && attendanceSessions[0]?.id) {
            setSelectedAttendanceSessionId(attendanceSessions[0].id);
        }
    }, [attendanceSessions, selectedAttendanceSessionId]);

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

    const handleReviewNoteChange = (requestId: string, value: string) => {
        setReviewNotes((current) => ({
            ...current,
            [requestId]: value,
        }));
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

                <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm sm:grid-cols-4">
                    {[
                        { id: 'attendance', label: '출석 세션' },
                        { id: 'record', label: '기록 세션' },
                        { id: 'feed', label: '활동 피드' },
                        { id: 'rules', label: '점수 설정' },
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
            ) : entryMode === 'feed' ? (
                <ActivityFeedSection
                    logs={logs}
                    reversingRecordId={reversingRecordId}
                    onReverseLog={handleReverseLog}
                    correctionRequests={correctionRequests}
                    correctionRequestCounts={correctionRequestCounts}
                    updatingCorrectionRequestId={updatingCorrectionRequestId}
                    reviewNotes={reviewNotes}
                    onReviewNoteChange={handleReviewNoteChange}
                    onUpdateCorrectionRequestStatus={handleCorrectionRequestStatusUpdate}
                    auditLogs={auditLogs}
                />
            ) : (
                <PointRulesManager />
            )}

            <ActivityRecordDialog
                isOpen={isRecordModalOpen}
                onClose={closeRecordModal}
                recordSourceMode={recordSourceMode}
                selectedAttendanceSession={selectedAttendanceSession}
                selectedManualTeamFilter={selectedManualTeamFilter}
                onSelectedManualTeamFilterChange={setSelectedManualTeamFilter}
                teamOptions={teamOptions}
                recordDate={recordDate}
                onRecordDateChange={setRecordDate}
                recordTitle={recordTitle}
                onRecordTitleChange={setRecordTitle}
                recordBulkCategoryId={recordBulkCategoryId}
                onRecordBulkCategoryIdChange={setRecordBulkCategoryId}
                recordCategories={recordCategories}
                onApplyBulkCategoryToVisibleMembers={applyBulkCategoryToVisibleMembers}
                onClearRecordSourceMembers={clearRecordSourceMembers}
                selectedRecordRowsCount={selectedRecordRows.length}
                recordExpectedDelta={recordExpectedDelta}
                recordNote={recordNote}
                onRecordNoteChange={setRecordNote}
                recordEvidenceUrl={recordEvidenceUrl}
                onRecordEvidenceUrlChange={setRecordEvidenceUrl}
                incompleteRecordRows={incompleteRecordRows}
                recordSourceMembersCount={recordSourceMembers.length}
                recordDraftRows={recordDraftRows}
                onRecordMemberToggle={handleRecordMemberToggle}
                onRecordCategoryChange={handleRecordCategoryChange}
                onRecordNoteRowChange={handleRecordNoteChange}
                onSubmit={handleRecordSubmit}
                isSaving={isSaving}
                canSubmit={recordPreviewRows.length > 0 && incompleteRecordRows.length === 0}
            />
        </div>
    );
};
