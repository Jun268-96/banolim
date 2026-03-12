import React, { useEffect, useMemo, useState } from 'react';
import {
    CalendarClock,
    CheckCircle2,
    CircleSlash,
    Clock3,
    Lock,
    LockOpen,
    PlusCircle,
    RefreshCw,
    Users2,
} from 'lucide-react';
import type {
    AttendanceSession,
    AttendanceSessionMember,
    AttendanceStatus,
    AttendanceTargetGroup,
    Category,
    Member,
    SeasonSummary,
} from '../../types';
import {
    createAttendanceSession,
    setAttendanceSessionActive,
    updateAttendanceSessionMemberStatus,
} from '../../lib/db';

interface AttendanceSessionManagerProps {
    season: SeasonSummary | null;
    members: Member[];
    categories: Category[];
    sessions: AttendanceSession[];
    onRefresh: () => Promise<void>;
}

const attendanceStatusLabels: Record<AttendanceStatus, string> = {
    present: '출석',
    late: '지각',
    absent: '결석',
};

const attendanceStatusDescriptions: Record<AttendanceStatus, string> = {
    present: '정상 출석으로 기록됩니다.',
    late: '지각 규칙으로 다시 반영됩니다.',
    absent: '결석 규칙으로 다시 반영됩니다.',
};

const attendanceStatusStyles: Record<AttendanceStatus, string> = {
    present: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    late: 'border-amber-200 bg-amber-50 text-amber-700',
    absent: 'border-slate-300 bg-slate-100 text-slate-700',
};

const attendanceStatusIcons = {
    present: CheckCircle2,
    late: Clock3,
    absent: CircleSlash,
} satisfies Record<AttendanceStatus, React.ComponentType<{ size?: number; className?: string }>>;

const nextAttendanceStatus: Record<AttendanceStatus, AttendanceStatus> = {
    present: 'late',
    late: 'absent',
    absent: 'present',
};

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

const filterMembersForAttendanceGroup = (
    members: Member[],
    targetGroupType: AttendanceTargetGroup,
    targetTeamId?: string | null,
) =>
    members.filter((member) => {
        if (member.status === 'inactive') {
            return false;
        }

        if (targetGroupType === 'all') {
            return true;
        }

        if (targetGroupType === 'ungrouped') {
            return (member.teamIds ?? []).length === 0 && !member.teamId;
        }

        return (member.teamIds ?? []).includes(targetTeamId ?? '') || member.teamId === targetTeamId;
    });

const getTargetGroupLabel = (value: string, teamOptions: Array<{ id: string; name: string }>) => {
    if (value === 'all') {
        return '전체 멤버';
    }

    if (value === 'ungrouped') {
        return '팀 미지정';
    }

    if (value.startsWith('team:')) {
        const teamId = value.replace('team:', '');
        return teamOptions.find((team) => team.id === teamId)?.name ?? '선택 팀';
    }

    return '전체 멤버';
};

const sortSessionEntries = (entries: AttendanceSessionMember[]) =>
    [...entries].sort((a, b) => {
        if ((a.roleName ?? '') !== (b.roleName ?? '')) {
            return (a.roleName ?? '').localeCompare(b.roleName ?? '', 'ko');
        }

        return a.memberName.localeCompare(b.memberName, 'ko');
    });

export const AttendanceSessionManager: React.FC<AttendanceSessionManagerProps> = ({
    season,
    members,
    categories,
    sessions,
    onRefresh,
}) => {
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');
    const [sessionStartsAt, setSessionStartsAt] = useState(() => toDateTimeInputValue());
    const [targetGroupValue, setTargetGroupValue] = useState('all');
    const [sessionTitle, setSessionTitle] = useState('정기모임 출석');
    const [sessionNote, setSessionNote] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [togglingSessionId, setTogglingSessionId] = useState<string | null>(null);
    const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

    const teamOptions = useMemo(
        () =>
            members
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
                .sort((a, b) => a.name.localeCompare(b.name, 'ko')),
        [members],
    );

    const selectedTargetGroupType = useMemo<AttendanceTargetGroup>(() => {
        if (targetGroupValue === 'all' || targetGroupValue === 'ungrouped') {
            return targetGroupValue;
        }

        return 'team';
    }, [targetGroupValue]);

    const selectedTargetTeamId = useMemo(
        () => (targetGroupValue.startsWith('team:') ? targetGroupValue.replace('team:', '') : null),
        [targetGroupValue],
    );

    const targetMembers = useMemo(
        () => filterMembersForAttendanceGroup(members, selectedTargetGroupType, selectedTargetTeamId),
        [members, selectedTargetGroupType, selectedTargetTeamId],
    );

    const selectedSession = useMemo(
        () => sessions.find((session) => session.id === selectedSessionId) ?? sessions[0] ?? null,
        [selectedSessionId, sessions],
    );

    const activeSessionCount = useMemo(
        () => sessions.filter((session) => session.isActive).length,
        [sessions],
    );

    const totalTrackedMembers = useMemo(
        () => sessions.reduce((sum, session) => sum + session.memberCount, 0),
        [sessions],
    );

    const attendanceRulesReady = useMemo(
        () => ({
            present: Boolean(getAttendanceRule(categories, 'present')),
            late: Boolean(getAttendanceRule(categories, 'late')),
            absent: Boolean(getAttendanceRule(categories, 'absent')),
        }),
        [categories],
    );

    useEffect(() => {
        if (!selectedSessionId && sessions[0]?.id) {
            setSelectedSessionId(sessions[0].id);
            return;
        }

        if (selectedSessionId && !sessions.some((session) => session.id === selectedSessionId)) {
            setSelectedSessionId(sessions[0]?.id ?? '');
        }
    }, [selectedSessionId, sessions]);

    const handleCreateSession = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsCreating(true);

        try {
            const created = await createAttendanceSession({
                title: sessionTitle,
                startsAt: toIsoFromLocalDateTime(sessionStartsAt),
                targetGroupType: selectedTargetGroupType,
                targetTeamId: selectedTargetTeamId,
                note: sessionNote,
            });

            setSelectedSessionId(created.id);
            setSessionStartsAt(toDateTimeInputValue());
            setSessionTitle('정기모임 출석');
            setSessionNote('');
            setTargetGroupValue('all');
            await onRefresh();
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleSession = async (session: AttendanceSession) => {
        setTogglingSessionId(session.id);
        try {
            await setAttendanceSessionActive(session.id, !session.isActive);
            await onRefresh();
        } finally {
            setTogglingSessionId(null);
        }
    };

    const handleCycleMemberStatus = async (entry: AttendanceSessionMember) => {
        if (!selectedSession || !selectedSession.isActive) {
            return;
        }

        const nextStatus = nextAttendanceStatus[entry.status];
        setUpdatingMemberId(entry.memberId);
        try {
            await updateAttendanceSessionMemberStatus({
                sessionId: selectedSession.id,
                memberId: entry.memberId,
                status: nextStatus,
                title: selectedSession.title,
                startsAt: selectedSession.startsAt,
                note: selectedSession.note ?? null,
            });
            await onRefresh();
        } finally {
            setUpdatingMemberId(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm text-slate-500">전체 출석 세션</div>
                    <div className="mt-2 text-3xl font-bold text-slate-950">{sessions.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm text-slate-500">운영 중 세션</div>
                    <div className="mt-2 text-3xl font-bold text-slate-950">{activeSessionCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-sm text-slate-500">관리 중 출석 대상</div>
                    <div className="mt-2 text-3xl font-bold text-slate-950">{totalTrackedMembers}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="space-y-6">
                    <form
                        onSubmit={handleCreateSession}
                        className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
                    >
                        <div className="border-b border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-xs font-semibold text-sky-700">
                                <PlusCircle size={14} />
                                관리자 출석 세션
                            </div>
                            <h3 className="mt-4 text-xl font-bold text-slate-950">출석 등록</h3>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                날짜/시간, 대상 그룹, 모임 목적을 정하면 기본 상태가 모두 출석인 세션이 열립니다. 이후 이름 카드를 눌러 지각, 결석으로 바로 조정할 수 있습니다.
                            </p>
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-600">
                                <div className="font-semibold text-slate-900">적용 시즌</div>
                                <div className="mt-1">
                                    {season ? `${season.name} · ${formatDateTime(`${season.startDate}T00:00:00`)}`.split(' · ')[0] : '활성 시즌 없음'}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">날짜와 시간</span>
                                <input
                                    type="datetime-local"
                                    value={sessionStartsAt}
                                    onChange={(event) => setSessionStartsAt(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>

                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">대상 그룹</span>
                                <select
                                    value={targetGroupValue}
                                    onChange={(event) => setTargetGroupValue(event.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="all">전체 멤버</option>
                                    <option value="ungrouped">팀 미지정</option>
                                    {teamOptions.map((team) => (
                                        <option key={team.id} value={`team:${team.id}`}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">모임 목적</span>
                                <input
                                    type="text"
                                    value={sessionTitle}
                                    onChange={(event) => setSessionTitle(event.target.value)}
                                    placeholder="예: 3월 둘째 주 정기모임"
                                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>

                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">세션 메모</span>
                                <textarea
                                    value={sessionNote}
                                    onChange={(event) => setSessionNote(event.target.value)}
                                    rows={3}
                                    placeholder="예: 발표 및 공지 후 출석 체크"
                                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <div className="font-semibold text-slate-900">이번 세션 대상자</div>
                                        <div className="mt-1 text-sm text-slate-500">{getTargetGroupLabel(targetGroupValue, teamOptions)}</div>
                                    </div>
                                    <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                                        {targetMembers.length}명
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {targetMembers.slice(0, 10).map((member) => (
                                        <span
                                            key={member.id}
                                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700"
                                        >
                                            {member.name}
                                        </span>
                                    ))}
                                    {targetMembers.length > 10 && (
                                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-500">
                                            외 {targetMembers.length - 10}명
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                <div className="font-semibold text-slate-900">출석 상태 규칙 확인</div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {(['present', 'late', 'absent'] as AttendanceStatus[]).map((status) => (
                                        <span
                                            key={status}
                                            className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                attendanceRulesReady[status]
                                                    ? attendanceStatusStyles[status]
                                                    : 'border-rose-200 bg-rose-50 text-rose-700'
                                            }`}
                                        >
                                            {attendanceStatusLabels[status]} {attendanceRulesReady[status] ? '준비됨' : '규칙 없음'}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isCreating || targetMembers.length === 0 || Object.values(attendanceRulesReady).some((value) => !value)}
                                className="w-full rounded-2xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {isCreating ? '출석 세션 생성 중...' : '출석 등록'}
                            </button>
                        </div>
                    </form>

                    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-200 px-6 py-5">
                            <div className="flex items-center gap-2 font-semibold text-slate-900">
                                <CalendarClock size={18} className="text-indigo-600" />
                                출석 세션 목록
                            </div>
                            <p className="mt-1 text-sm text-slate-500">기존 세션을 다시 열어 출석 상태를 수정할 수 있습니다.</p>
                        </div>
                        <div className="divide-y divide-slate-100">
                            {sessions.map((session) => {
                                const isSelected = selectedSession?.id === session.id;
                                const isToggling = togglingSessionId === session.id;

                                return (
                                    <button
                                        key={session.id}
                                        type="button"
                                        onClick={() => setSelectedSessionId(session.id)}
                                        className={`flex w-full flex-col gap-3 px-6 py-5 text-left transition-colors hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/70' : 'bg-white'}`}
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                            <div className="space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                                        session.isActive
                                                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                            : 'border-slate-200 bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {session.isActive ? '운영 중' : '마감'}
                                                    </span>
                                                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700">
                                                        {session.targetGroupLabel}
                                                    </span>
                                                </div>
                                                <div className="text-lg font-bold text-slate-950">{session.title}</div>
                                                <div className="text-sm text-slate-500">{formatDateTime(session.startsAt)}</div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2">
                                                {(['present', 'late', 'absent'] as AttendanceStatus[]).map((status) => (
                                                    <span
                                                        key={status}
                                                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${attendanceStatusStyles[status]}`}
                                                    >
                                                        {attendanceStatusLabels[status]} {session.statusCounts[status]}
                                                    </span>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void handleToggleSession(session);
                                                    }}
                                                    disabled={isToggling}
                                                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                                                >
                                                    {session.isActive ? <Lock size={14} /> : <LockOpen size={14} />}
                                                    {isToggling ? '변경 중...' : session.isActive ? '마감' : '마감 취소'}
                                                </button>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}

                            {sessions.length === 0 && (
                                <div className="px-6 py-12 text-center text-sm text-slate-500">
                                    아직 등록된 출석 세션이 없습니다.
                                </div>
                            )}
                        </div>
                    </section>
                </section>

                <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 px-6 py-5">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                    <Users2 size={14} />
                                    세션 상세
                                </div>
                                <h3 className="mt-4 text-xl font-bold text-slate-950">
                                    {selectedSession ? selectedSession.title : '선택한 출석 세션이 없습니다.'}
                                </h3>
                                {selectedSession && (
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                        {selectedSession.targetGroupLabel} · {formatDateTime(selectedSession.startsAt)}
                                        {selectedSession.note ? ` · ${selectedSession.note}` : ''}
                                    </p>
                                )}
                            </div>
                            {selectedSession && (
                                <button
                                    type="button"
                                    onClick={() => void onRefresh()}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <RefreshCw size={14} />
                                    새로고침
                                </button>
                            )}
                        </div>
                    </div>

                    {selectedSession ? (
                        <div className="space-y-5 p-6">
                            {!selectedSession.isActive && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    이 세션은 마감되어 있습니다. 출석 상태를 수정하려면 먼저 마감 취소를 눌러 주세요.
                                </div>
                            )}

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                {(['present', 'late', 'absent'] as AttendanceStatus[]).map((status) => {
                                    const Icon = attendanceStatusIcons[status];

                                    return (
                                        <div
                                            key={status}
                                            className={`rounded-2xl border p-4 ${attendanceStatusStyles[status]}`}
                                        >
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Icon size={16} />
                                                {attendanceStatusLabels[status]}
                                            </div>
                                            <div className="mt-2 text-2xl font-bold">
                                                {selectedSession.statusCounts[status]}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {sortSessionEntries(selectedSession.entries).map((entry) => {
                                    const statusTone = attendanceStatusStyles[entry.status];
                                    const Icon = attendanceStatusIcons[entry.status];
                                    const isUpdating = updatingMemberId === entry.memberId;

                                    return (
                                        <button
                                            key={entry.id}
                                            type="button"
                                            onClick={() => void handleCycleMemberStatus(entry)}
                                            disabled={!selectedSession.isActive || isUpdating}
                                            className={`rounded-[24px] border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70 ${statusTone}`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="text-lg font-bold">{entry.memberName}</div>
                                                    <div className="mt-1 text-sm opacity-80">{entry.roleName ?? '일반 회원'}</div>
                                                </div>
                                                <div className="rounded-full border border-current/20 bg-white/60 p-2">
                                                    <Icon size={18} />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center justify-between">
                                                <span className="text-sm font-semibold">{attendanceStatusLabels[entry.status]}</span>
                                                <span className="text-xs opacity-80">
                                                    클릭 시 {attendanceStatusLabels[nextAttendanceStatus[entry.status]]}
                                                </span>
                                            </div>
                                            <div className="mt-3 text-xs leading-5 opacity-80">
                                                {attendanceStatusDescriptions[nextAttendanceStatus[entry.status]]}
                                            </div>
                                            {entry.teamNames.length > 0 && (
                                                <div className="mt-3 text-xs opacity-80">
                                                    {entry.teamNames.join(', ')}
                                                </div>
                                            )}
                                            {isUpdating && (
                                                <div className="mt-3 text-xs font-semibold">상태 저장 중...</div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="px-6 py-16 text-center text-sm text-slate-500">
                            왼쪽에서 출석 세션을 선택하면 상태를 바로 수정할 수 있습니다.
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
