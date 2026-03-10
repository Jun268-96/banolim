import React, { useEffect, useMemo, useState } from 'react';
import {
    BadgeCheck,
    CalendarClock,
    CheckCircle2,
    CircleSlash,
    ClipboardList,
    Clock3,
    History,
    MessageSquareWarning,
    PlusCircle,
    RotateCcw,
    Sparkles,
    TriangleAlert,
    Users2,
} from 'lucide-react';
import type { ActivityLog, AuditLogEntry, Category, CorrectionRequest, CorrectionRequestStatus, Member, SeasonSummary } from '../../types';
import {
    createActivityEntry,
    createBatchActivityEntries,
    getCorrectionRequests,
    getCategories,
    getAuditLogs,
    getCurrentSeason,
    getLogs,
    getMembers,
    reverseActivityEntry,
    updateCorrectionRequestStatus,
} from '../../lib/db';

type EntryMode = 'attendance' | 'single';
type AttendanceStatus = 'present' | 'late' | 'absent';

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
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [entryMode, setEntryMode] = useState<EntryMode>('attendance');

    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [note, setNote] = useState('');

    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
    const [attendanceTitle, setAttendanceTitle] = useState('정기모임');
    const [attendanceNote, setAttendanceNote] = useState('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
    const [attendanceDraft, setAttendanceDraft] = useState<Record<string, AttendanceStatus>>({});

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [reversingRecordId, setReversingRecordId] = useState<string | null>(null);
    const [updatingCorrectionRequestId, setUpdatingCorrectionRequestId] = useState<string | null>(null);
    const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

    const refreshData = async () => {
        setIsLoading(true);
        const [seasonData, membersData, categoriesData, logsData, auditLogsData, correctionRequestData] = await Promise.all([
            getCurrentSeason(),
            getMembers(),
            getCategories(),
            getLogs(),
            getAuditLogs(),
            getCorrectionRequests(),
        ]);
        const firstActiveMemberId = membersData.find((member) => member.status !== 'inactive')?.id ?? '';
        setSeason(seasonData);
        setMembers(membersData);
        setCategories(categoriesData);
        setLogs(logsData);
        setAuditLogs(auditLogsData);
        setCorrectionRequests(correctionRequestData);
        setSelectedMemberId((current) => current || firstActiveMemberId);
        setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [seasonData, membersData, categoriesData, logsData, auditLogsData, correctionRequestData] = await Promise.all([
                getCurrentSeason(),
                getMembers(),
                getCategories(),
                getLogs(),
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
            setAuditLogs(auditLogsData);
            setCorrectionRequests(correctionRequestData);
            setSelectedMemberId((current) => current || firstActiveMemberId);
            setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
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
                    if (!member.teamId || !member.teamName) {
                        return acc;
                    }

                    if (acc.some((team) => team.id === member.teamId)) {
                        return acc;
                    }

                    return [...acc, { id: member.teamId, name: member.teamName }];
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
                    return !member.teamId;
                }

                return member.teamId === selectedTeamFilter;
            }),
        [activeMembers, selectedTeamFilter],
    );

    const attendanceRules = useMemo(
        () => ({
            present: getAttendanceRule(categories, 'present'),
            late: getAttendanceRule(categories, 'late'),
            absent: getAttendanceRule(categories, 'absent'),
        }),
        [categories],
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
            });
        }

        setAttendanceDraft({});
        setAttendanceNote('');
        await refreshData();
        setIsSaving(false);
    };

    const handleSingleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedMemberId || !selectedCategoryId) {
            return;
        }

        setIsSaving(true);
        await createActivityEntry(selectedMemberId, selectedCategoryId, note);
        setNote('');
        await refreshData();
        setIsSaving(false);
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
                    <p className="text-slate-500 mt-1">정기모임 출석을 먼저 빠르게 처리하고, 필요한 경우 개별 활동을 이어서 기록합니다.</p>
                </div>

                <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
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

            <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
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
                                                            {member.teamName || '팀 미지정'}
                                                            <span className="text-slate-300"> · </span>
                                                            {member.roleName || '역할 없음'}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm font-semibold text-indigo-600">{member.score}점</div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-3 gap-2">
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                            <td colSpan={7} className="py-12 text-center text-slate-500">
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
