import React, { useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    CalendarClock,
    CheckSquare,
    CircleSlash,
    ClipboardList,
    Clock3,
    Coins,
    History,
    Link2,
    MessageSquareWarning,
    PlusCircle,
    RotateCcw,
    Sparkles,
    Square,
    TriangleAlert,
    Users2,
} from 'lucide-react';
import type { ActivityLog, AttendanceSession, AuditLogEntry, Category, CorrectionRequest, CorrectionRequestStatus, Member, SeasonSummary } from '../../types';
import {
    createActivityEntry,
    createBatchActivityEntries,
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
import { AttendanceSessionManager } from './AttendanceSessionManager';

type EntryMode = 'attendance' | 'single' | 'mixed' | 'batch';
type MixedDraftRow = {
    selected: boolean;
    categoryId: string;
    note: string;
};

const memberStatusLabels: Record<string, string> = {
    active: '활동 중',
    dormant: '휴면',
    inactive: '비활성',
};

const entryModeMeta: Record<EntryMode, { label: string; title: string; description: string }> = {
    attendance: {
        label: '출석 세션',
        title: '관리자가 직접 여닫는 출석 세션 모드',
        description: '출석 세션을 만들고, 대상자 카드를 눌러 출석·지각·결석 상태를 바로 저장합니다.',
    },
    mixed: {
        label: '혼합 배치',
        title: '회원마다 다른 규칙을 한 번에 반영하는 모드',
        description: '같은 활동 안에서도 발표, 참여, 불참처럼 서로 다른 결과를 함께 저장할 때 씁니다.',
    },
    batch: {
        label: '빠른 일괄 반영',
        title: '같은 규칙을 여러 회원에게 한 번에 반영하는 모드',
        description: '기존 점수 탭의 빠른 입력 흐름을 그대로 옮긴 모드입니다. 규칙 하나를 정하고 여러 회원을 즉시 반영합니다.',
    },
    single: {
        label: '개별 활동',
        title: '한 사람의 활동을 자세히 기록하는 모드',
        description: '메모와 증빙 링크를 함께 남기면서 단건 활동을 정확히 기록할 때 적합합니다.',
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

    const [mixedDate, setMixedDate] = useState(new Date().toISOString().slice(0, 10));
    const [mixedTitle, setMixedTitle] = useState('운영 활동');
    const [mixedNote, setMixedNote] = useState('');
    const [mixedEvidenceUrl, setMixedEvidenceUrl] = useState('');
    const [selectedMixedTeamFilter, setSelectedMixedTeamFilter] = useState('all');
    const [mixedBulkCategoryId, setMixedBulkCategoryId] = useState('');
    const [mixedDraft, setMixedDraft] = useState<Record<string, MixedDraftRow>>({});
    const [selectedBatchTeamFilter, setSelectedBatchTeamFilter] = useState('all');
    const [batchCategoryId, setBatchCategoryId] = useState('');
    const [selectedBatchMemberIds, setSelectedBatchMemberIds] = useState<string[]>([]);
    const [batchNote, setBatchNote] = useState('');
    const [batchEvidenceUrl, setBatchEvidenceUrl] = useState('');

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
        const firstActiveMemberId = membersData.find((member) => member.status !== 'inactive')?.id ?? '';
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
        setBatchCategoryId((current) => current || categoriesData[0]?.id || '');
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
            setBatchCategoryId((current) => current || categoriesData[0]?.id || '');
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

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

    const filteredBatchMembers = useMemo(
        () =>
            activeMembers.filter((member) => {
                if (selectedBatchTeamFilter === 'all') {
                    return true;
                }

                if (selectedBatchTeamFilter === 'ungrouped') {
                    return (member.teamIds ?? []).length === 0 && !member.teamId;
                }

                return (member.teamIds ?? []).includes(selectedBatchTeamFilter) || member.teamId === selectedBatchTeamFilter;
            }),
        [activeMembers, selectedBatchTeamFilter],
    );

    const selectedCategory = useMemo(
        () => categories.find((category) => category.id === selectedCategoryId) ?? null,
        [categories, selectedCategoryId],
    );

    const selectedBatchCategory = useMemo(
        () => categories.find((category) => category.id === batchCategoryId) ?? null,
        [batchCategoryId, categories],
    );

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

    const groupedBatchMembers = useMemo(
        () =>
            filteredBatchMembers.reduce<Record<string, Member[]>>((groups, member) => {
                const key = member.teamNames?.[0] || member.teamName || '미지정';
                groups[key] = groups[key] ? [...groups[key], member] : [member];
                return groups;
            }, {}),
        [filteredBatchMembers],
    );

    const selectedBatchMembers = useMemo(
        () => filteredBatchMembers.filter((member) => selectedBatchMemberIds.includes(member.id)),
        [filteredBatchMembers, selectedBatchMemberIds],
    );

    const batchExpectedDelta = (selectedBatchCategory?.pointValue ?? 0) * selectedBatchMemberIds.length;

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

    const handleMixedTeamFilterChange = (value: string) => {
        setSelectedMixedTeamFilter(value);
        setMixedDraft({});
    };

    const handleBatchTeamFilterChange = (value: string) => {
        setSelectedBatchTeamFilter(value);
        setSelectedBatchMemberIds([]);
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

    const toggleBatchMember = (memberId: string) => {
        setSelectedBatchMemberIds((current) =>
            current.includes(memberId)
                ? current.filter((id) => id !== memberId)
                : [...current, memberId],
        );
    };

    const selectAllFilteredBatchMembers = () => {
        setSelectedBatchMemberIds(filteredBatchMembers.map((member) => member.id));
    };

    const clearFilteredBatchSelection = () => {
        setSelectedBatchMemberIds([]);
    };

    const handleBatchSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!batchCategoryId || selectedBatchMemberIds.length === 0) {
            return;
        }

        setIsSaving(true);
        await createBatchActivityEntries(selectedBatchMemberIds, batchCategoryId, batchNote, {
            evidenceUrl: batchEvidenceUrl,
        });
        setBatchNote('');
        setBatchEvidenceUrl('');
        setSelectedBatchMemberIds([]);
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
                        출석 세션
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
                        onClick={() => setEntryMode('batch')}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                            entryMode === 'batch'
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        빠른 일괄 반영
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
                        저장되는 데이터는 모두 동일한 활동 기록으로 합쳐지고, 입력 방식만 목적에 맞게 나뉩니다.
                    </div>
                </div>
            </section>

            {entryMode === 'attendance' ? (
                <AttendanceSessionManager
                    season={season}
                    members={members}
                    categories={categories}
                    sessions={attendanceSessions}
                    onRefresh={refreshData}
                />
            ) : (
                <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[420px_minmax(0,1fr)]">
                <section>
                    {entryMode === 'mixed' ? (
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
                    ) : entryMode === 'batch' ? (
                        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                            <div className="border-b border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-sky-50 p-6">
                                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/90 px-3 py-1 text-xs font-semibold text-indigo-700">
                                    <Coins size={14} />
                                    빠른 일괄 반영
                                </div>
                                <h3 className="mt-4 text-xl font-bold text-slate-950">같은 규칙을 여러 회원에게 한 번에 적용</h3>
                                <p className="mt-2 text-sm text-slate-600">
                                    규칙 하나를 고르고 여러 회원을 선택해 바로 저장합니다. 점수 처리도 결국 활동 기록으로 남기 때문에 별도 점수 탭 없이 이 화면에서 끝낼 수 있습니다.
                                </p>
                            </div>

                            <form className="space-y-5 p-6" onSubmit={handleBatchSubmit}>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">규칙</span>
                                    <select
                                        value={batchCategoryId}
                                        onChange={(event) => setBatchCategoryId(event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.categoryName} ({category.pointValue > 0 ? '+' : ''}
                                                {category.pointValue}) · v{category.version ?? 1}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">대상 그룹</span>
                                    <select
                                        value={selectedBatchTeamFilter}
                                        onChange={(event) => handleBatchTeamFilterChange(event.target.value)}
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

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">공통 메모</span>
                                    <textarea
                                        value={batchNote}
                                        onChange={(event) => setBatchNote(event.target.value)}
                                        rows={4}
                                        placeholder="예: 주간 스터디 참여, 회의 출석, 운영 지원"
                                        className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">증빙 링크</span>
                                    <input
                                        type="url"
                                        value={batchEvidenceUrl}
                                        onChange={(event) => setBatchEvidenceUrl(event.target.value)}
                                        placeholder="예: 회의록, 시트, 제출물 링크"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>

                                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">선택한 멤버</span>
                                        <span className="font-semibold text-slate-900">{selectedBatchMemberIds.length}명</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">규칙 점수</span>
                                        <span className="font-semibold text-slate-900">
                                            {(selectedBatchCategory?.pointValue ?? 0) > 0 ? '+' : ''}
                                            {selectedBatchCategory?.pointValue ?? 0}점
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">규칙 버전</span>
                                        <span className="font-semibold text-slate-900">v{selectedBatchCategory?.version ?? 1}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-500">예상 총합</span>
                                        <span className={`font-semibold ${batchExpectedDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {batchExpectedDelta > 0 ? '+' : ''}
                                            {batchExpectedDelta}점
                                        </span>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={!batchCategoryId || selectedBatchMemberIds.length === 0 || isSaving}
                                    className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isSaving ? '일괄 저장 중...' : '일괄 활동 반영'}
                                </button>
                            </form>
                        </section>
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
                    {entryMode === 'mixed' ? (
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
                    ) : entryMode === 'batch' ? (
                        <>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">현재 범위 멤버</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{filteredBatchMembers.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">선택 완료</div>
                                    <div className="mt-2 text-3xl font-bold text-slate-900">{selectedBatchMemberIds.length}</div>
                                </div>
                                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                                    <div className="text-sm text-slate-500">예상 총점</div>
                                    <div className={`mt-2 text-3xl font-bold ${batchExpectedDelta >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {batchExpectedDelta > 0 ? '+' : ''}
                                        {batchExpectedDelta}점
                                    </div>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="font-semibold text-slate-900">멤버 선택</div>
                                        <div className="mt-1 text-sm text-slate-500">현재 팀 기준으로 묶어서 보여줍니다.</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={selectAllFilteredBatchMembers}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                                        >
                                            현재 범위 전체 선택
                                        </button>
                                        <button
                                            type="button"
                                            onClick={clearFilteredBatchSelection}
                                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                                        >
                                            선택 해제
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6 p-6 2xl:grid-cols-[minmax(0,1.2fr)_320px]">
                                    <div className="space-y-6">
                                        {Object.entries(groupedBatchMembers).map(([teamName, teamMembers]) => (
                                            <div key={teamName} className="space-y-3">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                    <Users2 size={16} className="text-indigo-500" />
                                                    {teamName}
                                                    <span className="font-normal text-slate-400">({teamMembers.length})</span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                    {teamMembers.map((member) => {
                                                        const isSelected = selectedBatchMemberIds.includes(member.id);

                                                        return (
                                                            <button
                                                                key={member.id}
                                                                type="button"
                                                                onClick={() => toggleBatchMember(member.id)}
                                                                className={`rounded-2xl border p-4 text-left transition-all ${
                                                                    isSelected
                                                                        ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                                                        : 'border-slate-200 bg-white hover:bg-slate-50'
                                                                }`}
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div>
                                                                        <div className="font-medium text-slate-900">{member.name}</div>
                                                                        <div className="mt-1 text-sm text-slate-500">
                                                                            {member.roleName || '역할 없음'} · {member.status ? memberStatusLabels[member.status] ?? member.status : '상태 미확인'}
                                                                        </div>
                                                                        <div className="mt-2 text-sm font-semibold text-indigo-600">{member.score}점</div>
                                                                    </div>
                                                                    <div className="text-indigo-600">
                                                                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {filteredBatchMembers.length === 0 && (
                                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                                                현재 범위에 표시할 멤버가 없습니다.
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div>
                                            <div className="font-semibold text-slate-900">저장 미리보기</div>
                                            <div className="mt-1 text-sm text-slate-500">같은 규칙이 여러 회원에게 적용됩니다.</div>
                                        </div>

                                        {selectedBatchCategory && (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                                                        v{selectedBatchCategory.version ?? 1}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                        {selectedBatchCategory.categoryName}
                                                    </span>
                                                </div>
                                                <div className="mt-3 text-sm text-slate-600">
                                                    {selectedBatchCategory.conditionSummary ?? '규칙 설명이 아직 없습니다.'}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-3">
                                            {selectedBatchMembers.map((member) => (
                                                <div
                                                    key={member.id}
                                                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                                >
                                                    <div>
                                                        <div className="font-medium text-slate-900">{member.name}</div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {(member.teamNames?.join(', ') || member.teamName) || '팀 미지정'}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-indigo-600">
                                                        {(selectedBatchCategory?.pointValue ?? 0) > 0 ? '+' : ''}
                                                        {selectedBatchCategory?.pointValue ?? 0}점
                                                    </div>
                                                </div>
                                            ))}

                                            {selectedBatchMembers.length === 0 && (
                                                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">
                                                    아직 선택한 멤버가 없습니다.
                                                </div>
                                            )}
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
            )}
        </div>
    );
};
