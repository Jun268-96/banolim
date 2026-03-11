import React, { useEffect, useMemo, useState } from 'react';
import { Activity, BadgeCheck, Flame, Link2, Medal, MessageSquareWarning, PlayCircle, Send, ShieldCheck, Sparkles, TrendingUp, TriangleAlert, UserRound, Zap } from 'lucide-react';
import type {
    ActivityLog,
    AnnouncementItem,
    CorrectionRequest,
    CorrectionRequestStatus,
    Member,
    MemberBadge,
    MemberStatus,
    ScheduleEventItem,
    SeasonSummary,
} from '../../types';
import {
    getAnnouncements,
    getCorrectionRequests,
    getCurrentSeason,
    getMyActivityLogs,
    getMyMemberBadges,
    getMyMemberOverview,
    getScheduleEvents,
    submitCorrectionRequest,
} from '../../lib/db';
import { roleLabels } from '../../lib/permissions';
import { useAuth } from '../auth/auth-context';
import { MemberRecapViewer } from './MemberRecapViewer';
import { NoticeScheduleBoard } from '../shared/NoticeScheduleBoard';

type TimelineRange = '30d' | '90d' | 'all';
type MemberRecapPeriod = 'month' | 'season';

const memberStatusLabels: Record<MemberStatus, string> = {
    active: '활동 중',
    dormant: '휴면',
    inactive: '비활성',
};

const memberStatusClasses: Record<MemberStatus, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dormant: 'border-sky-200 bg-sky-50 text-sky-700',
    inactive: 'border-slate-200 bg-slate-100 text-slate-700',
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
const timelineRangeOptions: Array<{ id: TimelineRange; label: string }> = [
    { id: '30d', label: '최근 30일' },
    { id: '90d', label: '최근 90일' },
    { id: 'all', label: '전체' },
];
const badgeToneClasses: Record<NonNullable<MemberBadge['tone']>, string> = {
    gold: 'border-amber-200 bg-amber-50 text-amber-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
};
const bandiMascotUrl = new URL('../../../반디.png', import.meta.url).href;
const didiMascotUrl = new URL('../../../디디.png', import.meta.url).href;
const banollimSchoolLogoUrl = new URL('../../../반디스쿨 로고1.png', import.meta.url).href;

const getBadgeMascotUrl = (iconKey: string) =>
    iconKey.startsWith('didi')
        ? didiMascotUrl
        : bandiMascotUrl;

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

const formatDateTime = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
        : '-';

const formatMonthLabel = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(new Date(value));

const formatDayLabel = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(value));

const toLocalDayKey = (value: string) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const MemberHomeTab: React.FC = () => {
    const { profile } = useAuth();
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [memberBadges, setMemberBadges] = useState<MemberBadge[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [selectedRequestLog, setSelectedRequestLog] = useState<ActivityLog | null>(null);
    const [timelineRange, setTimelineRange] = useState<TimelineRange>('90d');
    const [selectedRecapPeriod, setSelectedRecapPeriod] = useState<MemberRecapPeriod | null>(null);
    const [requestReason, setRequestReason] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            setIsLoading(true);
            const [seasonData, memberData, logData, memberBadgeData, correctionRequestData, announcementData, scheduleData] = await Promise.all([
                getCurrentSeason(),
                getMyMemberOverview(profile?.memberId ?? null),
                getMyActivityLogs(profile?.memberId ?? null),
                getMyMemberBadges(profile?.memberId ?? null),
                getCorrectionRequests({ requesterMemberId: profile?.memberId ?? null }),
                getAnnouncements(),
                getScheduleEvents(),
            ]);

            if (!isMounted) {
                return;
            }

            setSeason(seasonData);
            setMember(memberData);
            setLogs(logData);
            setMemberBadges(memberBadgeData);
            setCorrectionRequests(correctionRequestData);
            setAnnouncements(announcementData);
            setScheduleEvents(scheduleData);
            setIsLoading(false);
        };

        void loadData();

        return () => {
            isMounted = false;
        };
    }, [profile?.memberId]);

    const effectiveLogs = useMemo(
        () => logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed'),
        [logs],
    );

    const openCorrectionRequestsByRecordId = useMemo(
        () =>
            correctionRequests.reduce<Record<string, CorrectionRequest>>((acc, request) => {
                if (!request.activityRecordId || (request.status !== 'pending' && request.status !== 'reviewing')) {
                    return acc;
                }

                acc[request.activityRecordId] = request;
                return acc;
            }, {}),
        [correctionRequests],
    );

    const seasonLogs = useMemo(() => {
        if (!season) {
            return effectiveLogs;
        }

        const seasonStart = new Date(`${season.startDate}T00:00:00`);
        const seasonEnd = season.endDate ? new Date(`${season.endDate}T23:59:59`) : null;

        return effectiveLogs.filter((log) => {
            const occurredAt = new Date(log.timestamp);
            if (occurredAt < seasonStart) {
                return false;
            }

            if (seasonEnd && occurredAt > seasonEnd) {
                return false;
            }

            return true;
        });
    }, [effectiveLogs, season]);

    const recentSnapshot = useMemo(() => {
        const now = new Date();
        const recentStart = new Date(now);
        recentStart.setDate(recentStart.getDate() - 30);
        const previousStart = new Date(now);
        previousStart.setDate(previousStart.getDate() - 60);

        const recentLogs = effectiveLogs.filter((log) => new Date(log.timestamp) >= recentStart);
        const previousLogs = effectiveLogs.filter((log) => {
            const occurredAt = new Date(log.timestamp);
            return occurredAt >= previousStart && occurredAt < recentStart;
        });

        const recentPoints = recentLogs.reduce((sum, log) => sum + log.pointDelta, 0);
        const previousPoints = previousLogs.reduce((sum, log) => sum + log.pointDelta, 0);
        const activeDays = new Set(recentLogs.map((log) => toLocalDayKey(log.timestamp))).size;
        const evidenceCount = recentLogs.filter((log) => Boolean(log.evidenceUrl)).length;

        const daySet = new Set(effectiveLogs.map((log) => toLocalDayKey(log.timestamp)));
        const today = new Date();
        const todayKey = toLocalDayKey(today.toISOString());
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = toLocalDayKey(yesterday.toISOString());
        const streakAnchor = daySet.has(todayKey) ? new Date(today) : daySet.has(yesterdayKey) ? new Date(yesterday) : null;

        let streakDays = 0;
        if (streakAnchor) {
            while (daySet.has(toLocalDayKey(streakAnchor.toISOString()))) {
                streakDays += 1;
                streakAnchor.setDate(streakAnchor.getDate() - 1);
            }
        }

        const growthRate = previousPoints === 0
            ? recentPoints > 0 ? null : 0
            : Math.round(((recentPoints - previousPoints) / Math.abs(previousPoints)) * 100);

        return {
            recentPoints,
            previousPoints,
            activeDays,
            evidenceCount,
            streakDays,
            growthRate,
            recentLogs,
        };
    }, [effectiveLogs]);

    const timelineLogs = useMemo(() => {
        if (timelineRange === 'all') {
            return effectiveLogs;
        }

        const now = new Date();
        const rangeStart = new Date(now);
        rangeStart.setDate(rangeStart.getDate() - (timelineRange === '30d' ? 30 : 90));

        return effectiveLogs.filter((log) => new Date(log.timestamp) >= rangeStart);
    }, [effectiveLogs, timelineRange]);

    const timelineGroups = useMemo(() => {
        const grouped = new Map<string, { monthLabel: string; items: ActivityLog[] }>();

        timelineLogs.forEach((log) => {
            const monthKey = log.timestamp.slice(0, 7);
            const existing = grouped.get(monthKey);

            if (existing) {
                existing.items.push(log);
                return;
            }

            grouped.set(monthKey, {
                monthLabel: formatMonthLabel(log.timestamp),
                items: [log],
            });
        });

        return Array.from(grouped.entries()).map(([monthKey, group]) => ({
            monthKey,
            monthLabel: group.monthLabel,
            items: group.items,
        }));
    }, [timelineLogs]);

    const filteredTopCategories = useMemo(
        () =>
            Object.values(
                timelineLogs.reduce<Record<string, { name: string; count: number; totalDelta: number }>>((acc, log) => {
                    const key = log.categoryId;
                    const current = acc[key] ?? {
                        name: log.categoryName ?? '알 수 없는 규칙',
                        count: 0,
                        totalDelta: 0,
                    };

                    acc[key] = {
                        name: current.name,
                        count: current.count + 1,
                        totalDelta: current.totalDelta + log.pointDelta,
                    };

                    return acc;
                }, {}),
            ).sort((a, b) => b.count - a.count || b.totalDelta - a.totalDelta).slice(0, 3),
        [timelineLogs],
    );

    const latestLog = effectiveLogs[0] ?? null;
    const approvedLabel = member?.isApproved ? '승인 완료' : '승인 대기';
    const status = member?.status ?? 'active';
    const statusClass = member ? memberStatusClasses[status] : memberStatusClasses.active;
    const seasonScore = seasonLogs.reduce((sum, log) => sum + log.pointDelta, 0);
    const seasonLogCount = seasonLogs.length;
    const badgeChallengeCopy = memberBadges.length >= 4
        ? '이제 희귀 배지 단계입니다. 증빙 기록과 다양한 역할 참여를 더 쌓아 보세요.'
        : '출석, 발표, 증빙 기록이 쌓일수록 반디와 디디가 새로운 배지를 열어 줍니다.';
    const growthDescription = recentSnapshot.growthRate === null
        ? '직전 30일 기록이 없어 이번 달 흐름이 새로 시작되었습니다.'
        : recentSnapshot.growthRate > 0
            ? `직전 30일 대비 ${recentSnapshot.growthRate}% 상승했습니다.`
            : recentSnapshot.growthRate < 0
                ? `직전 30일 대비 ${Math.abs(recentSnapshot.growthRate)}% 낮아졌습니다.`
                : '직전 30일과 비슷한 흐름을 유지하고 있습니다.';

    const handleSubmitCorrectionRequest = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedRequestLog?.recordId || !requestReason.trim()) {
            return;
        }

        setIsSubmittingRequest(true);
        setRequestError(null);

        try {
            await submitCorrectionRequest(selectedRequestLog.recordId, requestReason);
            const nextRequests = await getCorrectionRequests({ requesterMemberId: profile?.memberId ?? null });
            setCorrectionRequests(nextRequests);
            setRequestReason('');
            setSelectedRequestLog(null);
        } catch (error) {
            setRequestError(error instanceof Error ? error.message : '정정 요청을 저장하지 못했습니다.');
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100" />
                    <div className="font-medium text-indigo-600">내 활동 현황을 불러오는 중...</div>
                </div>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-sm">
                    <div className="border-b border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-xs font-semibold text-amber-800">
                            <TriangleAlert size={14} />
                            회원 매칭 필요
                        </div>
                        <h2 className="mt-4 text-2xl font-bold text-slate-950">내 상태를 불러올 수 없습니다.</h2>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            현재 로그인 이메일과 일치하는 회원 레코드를 찾지 못했습니다. 운영진이 멤버 관리 화면에서 본인 회원 레코드에 로그인 이메일을 등록하면
                            이 화면에서 본인 점수와 활동만 확인할 수 있습니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">로그인 이메일</div>
                            <div className="mt-2 font-semibold text-slate-900">{profile?.email ?? '알 수 없음'}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">현재 권한</div>
                            <div className="mt-2 font-semibold text-slate-900">{roleLabels[profile?.appRole ?? 'member']}</div>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
                <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
                    <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-sm font-medium text-sky-700">
                            <Sparkles size={15} />
                            개인 성장 대시보드
                        </div>

                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">{member.name}님의 활동 흐름</h2>
                            <p className="mt-3 max-w-3xl text-base text-slate-600 lg:text-lg">
                                최근 30일의 변화, 시즌 점수, 연속 활동 흐름을 한 화면에서 읽을 수 있게 정리했습니다.
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRecapPeriod('month')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    <PlayCircle size={16} className="text-indigo-600" />
                                    이번 달 리캡
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedRecapPeriod('season')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                                >
                                    <Sparkles size={16} />
                                    현재 시즌 리캡
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">현재 시즌 점수</div>
                                <div className="mt-2 text-2xl font-bold text-slate-950">
                                    {seasonScore > 0 ? '+' : ''}
                                    {seasonScore}점
                                </div>
                                <div className="mt-1 text-sm text-slate-500">{season ? `${season.name} · ${seasonLogCount}건` : '시즌 기준 없음'}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">최근 30일</div>
                                <div className={`mt-2 text-2xl font-bold ${recentSnapshot.recentPoints >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                    {recentSnapshot.recentPoints > 0 ? '+' : ''}
                                    {recentSnapshot.recentPoints}점
                                </div>
                                <div className="mt-1 text-sm text-slate-500">{recentSnapshot.recentLogs.length}건 기록</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">연속 활동</div>
                                <div className="mt-2 text-2xl font-bold text-slate-950">{recentSnapshot.streakDays}일</div>
                                <div className="mt-1 text-sm text-slate-500">최근 흐름이 이어진 일수</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">증빙 포함 기록</div>
                                <div className="mt-2 text-2xl font-bold text-slate-950">{recentSnapshot.evidenceCount}건</div>
                                <div className="mt-1 text-sm text-slate-500">최근 30일 기준</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white lg:p-6">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <UserRound size={16} />
                            내 프로필
                        </div>
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">역할</div>
                                <div className="mt-2 font-semibold text-white">{member.roleName ?? roleLabels[profile?.appRole ?? 'member']}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">소속 팀</div>
                                <div className="mt-2 font-semibold text-white">{member.teamName ?? '미지정'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">가입일</div>
                                <div className="mt-2 font-semibold text-white">{formatDate(member.joinedAt)}</div>
                            </div>
                            <div className="rounded-2xl border border-indigo-400/30 bg-indigo-400/10 p-4">
                                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-indigo-200">
                                    <TrendingUp size={14} />
                                    최근 모멘텀
                                </div>
                                <div className="mt-3 text-lg font-semibold text-white">
                                    {latestLog ? `${formatDateTime(latestLog.timestamp)} 이후 흐름 유지 중` : '아직 첫 활동을 준비 중입니다.'}
                                </div>
                                <div className="mt-2 text-sm leading-6 text-slate-300">{growthDescription}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <NoticeScheduleBoard
                announcements={announcements}
                scheduleEvents={scheduleEvents}
                title="공지와 다가오는 일정"
                description="운영진이 공유한 안내와 예정된 일정을 한곳에서 확인할 수 있습니다."
            />

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.22fr)_minmax(320px,0.78fr)]">
                <div className="space-y-6">
                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-6 py-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                                        <Activity size={18} className="text-indigo-600" />
                                        개인 활동 타임라인
                                    </div>
                                    <div className="mt-1 text-sm text-slate-500">저장된 활동을 시간순으로 묶어 보고, 바로 정정 요청까지 이어집니다.</div>
                                </div>
                                <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                                    {timelineRangeOptions.map((option) => (
                                        <button
                                            key={option.id}
                                            type="button"
                                            onClick={() => setTimelineRange(option.id)}
                                            className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                                                timelineRange === option.id
                                                    ? 'bg-white text-slate-900 shadow-sm'
                                                    : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">선택 기간 기록</div>
                                    <div className="mt-2 text-lg font-bold text-slate-950">{timelineLogs.length}건</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">활동 유형</div>
                                    <div className="mt-2 text-lg font-bold text-slate-950">{new Set(timelineLogs.map((log) => log.categoryId)).size}개</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">증빙 링크</div>
                                    <div className="mt-2 text-lg font-bold text-slate-950">{timelineLogs.filter((log) => Boolean(log.evidenceUrl)).length}건</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-8 px-6 py-6">
                            {timelineGroups.map((group) => (
                                <div key={group.monthKey} className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-semibold text-slate-900">{group.monthLabel}</div>
                                        <div className="h-px flex-1 bg-slate-200" />
                                    </div>

                                    <div className="space-y-3">
                                        {group.items.map((log) => {
                                            const openRequest = openCorrectionRequestsByRecordId[log.recordId ?? ''];

                                            return (
                                                <div
                                                    key={log.id}
                                                    className="rounded-[24px] border border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 p-5 shadow-sm"
                                                >
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="space-y-3">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                                                                    {formatDayLabel(log.timestamp)}
                                                                </span>
                                                                {log.evidenceUrl && (
                                                                    <a
                                                                        href={log.evidenceUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                                                                    >
                                                                        <Link2 size={13} />
                                                                        증빙 링크
                                                                    </a>
                                                                )}
                                                            </div>

                                                            <div>
                                                                <div className="font-semibold text-slate-950">{log.categoryName ?? '알 수 없는 규칙'}</div>
                                                                <div className="mt-1 text-sm leading-6 text-slate-600">
                                                                    {log.reason ?? '기록 사유 없음'}
                                                                    {log.note ? <span className="text-slate-300"> · {log.note}</span> : null}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-start gap-3 lg:items-end">
                                                            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${log.pointDelta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                                                                {log.pointDelta > 0 ? '+' : ''}
                                                                {log.pointDelta}점
                                                            </span>
                                                            <div className="text-sm text-slate-500">{formatDateTime(log.timestamp)}</div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                        <div className="text-sm text-slate-600">
                                                            {openRequest ? '이미 정정 요청이 접수되어 운영진이 확인 중입니다.' : '기록이 다르면 바로 정정 요청을 보낼 수 있습니다.'}
                                                        </div>
                                                        {openRequest ? (
                                                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[openRequest.status]}`}>
                                                                {correctionRequestStatusLabels[openRequest.status]}
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setSelectedRequestLog(log);
                                                                    setRequestReason(`${log.categoryName ?? '활동'} 기록에 대한 정정 요청입니다. `);
                                                                    setRequestError(null);
                                                                }}
                                                                disabled={!log.recordId}
                                                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                                                            >
                                                                <MessageSquareWarning size={16} />
                                                                정정 요청
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {timelineLogs.length === 0 && (
                                <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center">
                                    <div className="text-base font-semibold text-slate-900">아직 타임라인에 표시할 활동이 없습니다.</div>
                                    <div className="mt-2 text-sm text-slate-500">기록이 저장되면 이곳에 월별 흐름과 정정 요청 버튼이 함께 표시됩니다.</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <TrendingUp size={18} className="text-indigo-600" />
                            성장 스냅샷
                        </div>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">활동 일수</div>
                                <div className="mt-2 text-xl font-bold text-slate-950">{recentSnapshot.activeDays}일</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">연속 활동</div>
                                <div className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-950">
                                    <Flame size={18} className="text-amber-500" />
                                    {recentSnapshot.streakDays}일
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">직전 30일</div>
                                <div className="mt-2 text-xl font-bold text-slate-950">
                                    {recentSnapshot.previousPoints > 0 ? '+' : ''}
                                    {recentSnapshot.previousPoints}점
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">누적 점수</div>
                                <div className="mt-2 text-xl font-bold text-indigo-600">{member.score}점</div>
                            </div>
                        </div>
                        <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
                            {growthDescription}
                        </div>
                        <div className="mt-5 space-y-3">
                            {filteredTopCategories.map((category) => (
                                <div key={category.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div>
                                        <div className="font-medium text-slate-900">{category.name}</div>
                                        <div className="mt-1 text-sm text-slate-500">{category.count}회 기록</div>
                                    </div>
                                    <div className={`text-sm font-bold ${category.totalDelta >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {category.totalDelta > 0 ? '+' : ''}
                                        {category.totalDelta}점
                                    </div>
                                </div>
                            ))}
                            {filteredTopCategories.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                    선택한 기간에는 아직 대표 활동이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                        <div className="relative border-b border-slate-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 px-6 py-5">
                            <img
                                src={banollimSchoolLogoUrl}
                                alt="반디스쿨 로고"
                                className="pointer-events-none absolute right-4 top-4 h-16 w-auto opacity-20 saturate-50 sm:h-20"
                            />
                            <div className="relative flex items-start justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                                        <Medal size={18} className="text-indigo-600" />
                                        공식 배지 컬렉션
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-slate-600">
                                        활동 누적치가 기준을 넘으면 배지가 자동으로 열립니다. 반디는 공식 성취, 디디는 희귀·기록형 배지를 맡습니다.
                                    </div>
                                </div>
                                <img
                                    src={bandiMascotUrl}
                                    alt="반디 마스코트"
                                    className="h-16 w-auto shrink-0 drop-shadow-[0_12px_24px_rgba(15,23,42,0.18)] sm:h-20"
                                />
                            </div>
                        </div>

                        <div className="space-y-5 p-6">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                {memberBadges.map((badge) => (
                                    <div key={badge.id} className={`overflow-hidden rounded-[24px] border p-4 ${badgeToneClasses[badge.tone ?? 'sky']}`}>
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/80 shadow-sm">
                                                    <img
                                                        src={getBadgeMascotUrl(badge.iconKey)}
                                                        alt={badge.badgeName}
                                                        className="h-10 w-auto object-contain"
                                                    />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 text-sm font-semibold">
                                                        <BadgeCheck size={16} />
                                                        {badge.badgeName}
                                                    </div>
                                                    <div className="mt-1 text-xs opacity-80">{new Date(badge.awardedAt).toLocaleDateString('ko-KR')} 획득</div>
                                                </div>
                                            </div>
                                            <div className="rounded-full border border-white/70 bg-white/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] opacity-90">
                                                {badge.badgeCode.replace(/_/g, ' ')}
                                            </div>
                                        </div>
                                        <div className="mt-4 text-sm leading-6">
                                            {badge.badgeDescription}
                                        </div>
                                    </div>
                                ))}

                                {memberBadges.length === 0 && (
                                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500 sm:col-span-2">
                                        <img
                                            src={didiMascotUrl}
                                            alt="디디 마스코트"
                                            className="mx-auto h-16 w-auto opacity-90"
                                        />
                                        <div className="mt-4 font-medium text-slate-700">첫 배지를 기다리는 중입니다.</div>
                                        <div className="mt-2 leading-6">
                                            활동 기록이 누적되면 이곳에 실시간으로 획득 배지가 추가됩니다.
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-[24px] border border-slate-900 bg-slate-950 px-5 py-4 text-white">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <div className="text-xs uppercase tracking-[0.16em] text-slate-400">다음 챌린지</div>
                                        <div className="mt-2 text-lg font-semibold text-white">{memberBadges.length}개 배지 획득</div>
                                        <div className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{badgeChallengeCopy}</div>
                                    </div>
                                    <img
                                        src={didiMascotUrl}
                                        alt="디디 마스코트"
                                        className="h-20 w-auto shrink-0 self-end drop-shadow-[0_14px_24px_rgba(0,0,0,0.25)]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <MessageSquareWarning size={18} className="text-indigo-600" />
                            정정 요청
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-sm font-medium text-slate-700">최근 요청 내역</div>
                                <div className="mt-3 space-y-3">
                                    {correctionRequests.slice(0, 4).map((request) => (
                                        <div key={request.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium text-slate-900">{request.activitySummary ?? '활동 기록'}</div>
                                                    <div className="mt-1 text-sm text-slate-500">{formatDateTime(request.createdAt)}</div>
                                                </div>
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[request.status]}`}>
                                                    {correctionRequestStatusLabels[request.status]}
                                                </span>
                                            </div>
                                            <div className="mt-3 text-sm leading-6 text-slate-600">{request.reason}</div>
                                            {request.reviewNote && (
                                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                                    운영진 답변: {request.reviewNote}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {correctionRequests.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                                            아직 제출한 정정 요청이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedRequestLog && (
                                <form onSubmit={handleSubmitCorrectionRequest} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                                        <Send size={16} className="text-indigo-600" />
                                        {selectedRequestLog.categoryName ?? '활동 기록'} 정정 요청 작성
                                    </div>
                                    <div className="mt-2 text-sm text-slate-600">
                                        {formatDateTime(selectedRequestLog.timestamp)} 기록에 대해 운영진에게 검토를 요청합니다.
                                    </div>
                                    <textarea
                                        value={requestReason}
                                        onChange={(event) => setRequestReason(event.target.value)}
                                        rows={4}
                                        placeholder="어떤 부분이 잘못되었는지 구체적으로 남겨 주세요."
                                        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    {requestError && (
                                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                            {requestError}
                                        </div>
                                    )}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="submit"
                                            disabled={!requestReason.trim() || isSubmittingRequest}
                                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {isSubmittingRequest ? '제출 중...' : '정정 요청 제출'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedRequestLog(null);
                                                setRequestReason('');
                                                setRequestError(null);
                                            }}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <ShieldCheck size={18} className="text-indigo-600" />
                            계정 상태
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">회원 상태</span>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                    {memberStatusLabels[status]}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">승인 여부</span>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${member.isApproved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                    {approvedLabel}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">로그인 이메일</span>
                                <span className="text-sm font-medium text-slate-900">{profile?.email ?? '-'}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">획득 배지</span>
                                <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                    <Zap size={16} className="text-indigo-500" />
                                    {memberBadges.length}개
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                </section>
            </div>

            {selectedRecapPeriod && (
                <MemberRecapViewer
                    key={selectedRecapPeriod}
                    member={member}
                    season={season}
                    logs={effectiveLogs}
                    memberBadges={memberBadges}
                    period={selectedRecapPeriod}
                    onClose={() => setSelectedRecapPeriod(null)}
                />
            )}
        </>
    );
};
