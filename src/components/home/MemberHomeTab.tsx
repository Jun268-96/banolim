import React, { useMemo, useState } from 'react';
import { Sparkles, TriangleAlert } from 'lucide-react';
import type {
    ActivityLog,
    CorrectionRequest,
    CorrectionRequestStatus,
    MemberStatus,
} from '../../types';
import { submitCorrectionRequest } from '../../lib/api/member/self';
import {
    computeBadgeMetrics,
    getBadgeRequirementEntries,
} from '../../lib/badges';
import { filterEffectiveActivityLogs, filterLogsWithinRange, toLocalDayKey } from '../../lib/domain/activityLogs';
import { roleLabels } from '../../lib/permissions';
import { useAuth } from '../auth/auth-context';
import { useMemberHomeResources } from './hooks/useMemberHomeResources';
import { MemberAccountSection } from './sections/MemberAccountSection';
import { MemberActivitySection } from './sections/MemberActivitySection';
import { MemberBadgeSection } from './sections/MemberBadgeSection';
import { MemberHomeOverviewSection } from './sections/MemberHomeOverviewSection';

type TimelineRange = '30d' | '90d' | 'all';
type MemberHomeSection = 'home' | 'activity' | 'badges' | 'account';

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
const badgeToneClasses = {
    gold: 'border-amber-200 bg-amber-50 text-amber-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-800',
} as const;
const bandiMascotUrl = new URL('../../../반디.png', import.meta.url).href;
const didiMascotUrl = new URL('../../../디디.png', import.meta.url).href;
const banollimSchoolLogoUrl = new URL('../../../반디스쿨 로고1.png', import.meta.url).href;

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

export const MemberHomeTab: React.FC = () => {
    const { profile } = useAuth();
    const [activeSection, setActiveSection] = useState<MemberHomeSection>('home');
    const [selectedRequestLog, setSelectedRequestLog] = useState<ActivityLog | null>(null);
    const [timelineRange, setTimelineRange] = useState<TimelineRange>('90d');
    const [requestReason, setRequestReason] = useState('');
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);
    const {
        season,
        member,
        logs,
        badgeCatalog,
        memberBadges,
        announcements,
        scheduleEvents,
        correctionRequests,
        isLoading,
        refreshCorrectionRequests,
    } = useMemberHomeResources(profile?.memberId ?? null);

    const effectiveLogs = useMemo(
        () => filterEffectiveActivityLogs(logs),
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

        return filterLogsWithinRange(
            effectiveLogs,
            seasonStart,
            seasonEnd ?? new Date(),
        );
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

    const latestLog = effectiveLogs[0] ?? null;
    const homeRecentLogs = effectiveLogs.slice(0, 4);
    const earnedBadgeMap = useMemo(
        () => new Map(memberBadges.map((badge) => [badge.badgeId, badge])),
        [memberBadges],
    );
    const badgeCards = useMemo(() => badgeCatalog.map((badge) => {
        const earnedBadge = earnedBadgeMap.get(badge.id) ?? null;
        const scopedLogs = (badge.evaluationScope ?? 'season') === 'lifetime' ? effectiveLogs : seasonLogs;
        const metrics = computeBadgeMetrics(scopedLogs);
        const requirementEntries = getBadgeRequirementEntries(badge.criteria, metrics);

        return {
            badge,
            earnedBadge,
            requirementEntries,
        };
    }), [badgeCatalog, earnedBadgeMap, effectiveLogs, seasonLogs]);
    const accountStatus = !member?.authUserId
        ? {
            label: '계정 미발급',
            className: 'border-amber-200 bg-amber-50 text-amber-700',
        }
        : member.passwordResetRequired
            ? {
                label: '첫 로그인 대기',
                className: 'border-sky-200 bg-sky-50 text-sky-700',
            }
            : {
                label: '계정 활성',
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            };
    const status = member?.status ?? 'active';
    const statusClass = member ? memberStatusClasses[status] : memberStatusClasses.active;
    const seasonScore = seasonLogs.reduce((sum, log) => sum + log.pointDelta, 0);
    const seasonLogCount = seasonLogs.length;
    const memberTeamLabel = member?.teamNames && member.teamNames.length > 0
        ? member.teamNames.join(' · ')
        : member?.teamName ?? '미지정';
    const badgeChallengeCopy = memberBadges.length >= 4
        ? '이제 희귀 배지 단계입니다. 증빙 기록과 다양한 역할 참여를 더 쌓아 보세요.'
        : '배지마다 시즌 누적 또는 전체 누적 기준이 다르게 적용됩니다. 조건을 채우면 잠금 카드가 바로 열립니다.';
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
            await refreshCorrectionRequests();
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

    const memberSectionTabs: Array<{ id: MemberHomeSection; label: string }> = [
        { id: 'home', label: '내 홈' },
        { id: 'activity', label: '내 활동' },
        { id: 'badges', label: '배지' },
        { id: 'account', label: '계정' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                            <Sparkles size={15} />
                            일반 회원 공간
                        </div>
                        <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{member.name}님의 활동 공간</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500 sm:text-base">
                            자주 보는 정보는 탭으로 나눠 두었습니다. 공지 확인, 활동 기록, 배지, 계정 상태를 목적별로 볼 수 있습니다.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        현재 시즌 · {season?.name ?? '시즌 없음'}
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                    {memberSectionTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveSection(tab.id)}
                            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-colors ${
                                activeSection === tab.id
                                    ? 'bg-slate-950 text-white shadow-sm'
                                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </section>

            {activeSection === 'home' && (
                <MemberHomeOverviewSection
                    announcements={announcements}
                    scheduleEvents={scheduleEvents}
                    seasonName={season?.name ?? '시즌 기준 없음'}
                    seasonScore={seasonScore}
                    seasonLogCount={seasonLogCount}
                    memberBadgeCount={memberBadges.length}
                    homeRecentLogs={homeRecentLogs}
                    recentSnapshot={recentSnapshot}
                    growthDescription={growthDescription}
                    formatDateTime={formatDateTime}
                    onOpenActivity={() => setActiveSection('activity')}
                />
            )}

            {activeSection === 'activity' && (
                <MemberActivitySection
                    timelineRange={timelineRange}
                    timelineRangeOptions={timelineRangeOptions}
                    timelineGroups={timelineGroups}
                    timelineLogsCount={timelineLogs.length}
                    correctionRequests={correctionRequests}
                    openCorrectionRequestsByRecordId={openCorrectionRequestsByRecordId}
                    correctionRequestStatusLabels={correctionRequestStatusLabels}
                    correctionRequestStatusClasses={correctionRequestStatusClasses}
                    selectedRequestLog={selectedRequestLog}
                    requestReason={requestReason}
                    requestError={requestError}
                    isSubmittingRequest={isSubmittingRequest}
                    onChangeTimelineRange={setTimelineRange}
                    onSelectRequestLog={(log) => {
                        setSelectedRequestLog(log);
                        setRequestReason(`${log.categoryName ?? '활동'} 기록에 대한 정정 요청입니다. `);
                        setRequestError(null);
                    }}
                    onChangeRequestReason={setRequestReason}
                    onSubmitCorrectionRequest={handleSubmitCorrectionRequest}
                    onCloseRequestForm={() => {
                        setSelectedRequestLog(null);
                        setRequestReason('');
                        setRequestError(null);
                    }}
                    formatDayLabel={formatDayLabel}
                    formatDateTime={formatDateTime}
                />
            )}

            {activeSection === 'badges' && (
                <MemberBadgeSection
                    badgeCards={badgeCards}
                    memberBadges={memberBadges}
                    badgeChallengeCopy={badgeChallengeCopy}
                    badgeToneClasses={badgeToneClasses}
                    bandiMascotUrl={bandiMascotUrl}
                    didiMascotUrl={didiMascotUrl}
                    banollimSchoolLogoUrl={banollimSchoolLogoUrl}
                />
            )}

            {activeSection === 'account' && (
                <MemberAccountSection
                    member={member}
                    roleLabel={member.roleName ?? roleLabels[profile?.appRole ?? 'member']}
                    memberTeamLabel={memberTeamLabel}
                    joinedAtLabel={formatDate(member.joinedAt)}
                    latestActivityLabel={latestLog ? formatDateTime(latestLog.timestamp) : '아직 없음'}
                    statusLabel={memberStatusLabels[status]}
                    statusClass={statusClass}
                    accountStatus={accountStatus}
                    loginEmail={profile?.email ?? '-'}
                />
            )}
        </div>
    );
};
