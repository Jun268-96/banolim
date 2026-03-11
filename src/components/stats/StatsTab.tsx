import React, { useEffect, useMemo, useState } from 'react';
import {
    Archive,
    ArrowDownRight,
    ArrowUpRight,
    Award,
    BarChart3,
    CalendarRange,
    Clock3,
    LoaderCircle,
    Minus,
    PlayCircle,
    Sparkles,
    TrendingUp,
    Users,
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import type { ActivityLog, Member, MemberBadge, RecapSnapshot, RecapSnapshotPeriod, SeasonSummary } from '../../types';
import { createRecapSnapshots, getCurrentSeason, getLogs, getMemberBadges, getMembers, getRecapSnapshots, getSeasons } from '../../lib/db';
import { buildMemberRecapSnapshotDraft, buildOverallRecapSnapshotDraft } from '../../lib/recapSnapshots';
import { RecapViewer } from './RecapViewer';
import { RecapSnapshotViewer } from '../recap/RecapSnapshotViewer';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

type TeamStatRow = {
    team: string;
    totalPoints: number;
    activityCount: number;
    participantCount: number;
};

type CategoryStatRow = {
    name: string;
    count: number;
    delta: number;
};

type MemberStatRow = {
    memberId: string;
    name: string;
    totalPoints: number;
    activityCount: number;
};

const toSeasonRange = (season: SeasonSummary | null) => {
    if (!season) {
        return {
            start: new Date(0),
            end: new Date(),
        };
    }

    return {
        start: new Date(`${season.startDate}T00:00:00`),
        end: season.endDate ? new Date(`${season.endDate}T23:59:59`) : new Date(),
    };
};

const isWithinRange = (value: string, start: Date, end: Date) => {
    const target = new Date(value);
    return target >= start && target <= end;
};

const buildTeamStats = (logs: ActivityLog[], members: Member[]): TeamStatRow[] => {
    const memberMap = new Map(members.map((member) => [member.id, member]));
    const rows = new Map<string, { totalPoints: number; activityCount: number; participantIds: Set<string> }>();

    logs.forEach((log) => {
        const teamName = memberMap.get(log.memberId)?.teamName ?? '미지정';
        const current = rows.get(teamName) ?? {
            totalPoints: 0,
            activityCount: 0,
            participantIds: new Set<string>(),
        };

        current.totalPoints += log.pointDelta;
        current.activityCount += 1;
        current.participantIds.add(log.memberId);
        rows.set(teamName, current);
    });

    return [...rows.entries()]
        .map(([team, value]) => ({
            team,
            totalPoints: value.totalPoints,
            activityCount: value.activityCount,
            participantCount: value.participantIds.size,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints || b.activityCount - a.activityCount);
};

const buildCategoryStats = (logs: ActivityLog[]): CategoryStatRow[] => {
    const rows = new Map<string, { count: number; delta: number }>();

    logs.forEach((log) => {
        const name = log.categoryName ?? log.reason ?? '알 수 없는 규칙';
        const current = rows.get(name) ?? { count: 0, delta: 0 };
        current.count += 1;
        current.delta += log.pointDelta;
        rows.set(name, current);
    });

    return [...rows.entries()]
        .map(([name, value]) => ({
            name,
            count: value.count,
            delta: value.delta,
        }))
        .sort((a, b) => b.count - a.count || b.delta - a.delta);
};

const buildMemberStats = (logs: ActivityLog[], members: Member[]): MemberStatRow[] => {
    const memberNameMap = new Map(members.map((member) => [member.id, member.name]));
    const rows = new Map<string, { totalPoints: number; activityCount: number }>();

    logs.forEach((log) => {
        const current = rows.get(log.memberId) ?? { totalPoints: 0, activityCount: 0 };
        current.totalPoints += log.pointDelta;
        current.activityCount += 1;
        rows.set(log.memberId, current);
    });

    return [...rows.entries()]
        .map(([memberId, value]) => ({
            memberId,
            name: memberNameMap.get(memberId) ?? '알 수 없는 회원',
            totalPoints: value.totalPoints,
            activityCount: value.activityCount,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints || b.activityCount - a.activityCount);
};

const formatDelta = (current: number, previous: number, suffix = '') => {
    const diff = current - previous;
    if (diff === 0) {
        return `변화 없음${suffix}`;
    }

    const prefix = diff > 0 ? '+' : '';
    return `${prefix}${diff}${suffix}`;
};

const DeltaIndicator: React.FC<{ current: number; previous: number; suffix?: string }> = ({ current, previous, suffix = '' }) => {
    const diff = current - previous;

    if (diff === 0) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                <Minus size={14} />
                변화 없음
            </span>
        );
    }

    const isPositive = diff > 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                isPositive
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-rose-200 bg-rose-50 text-rose-700'
            }`}
        >
            <Icon size={14} />
            {formatDelta(current, previous, suffix)}
        </span>
    );
};

export const StatsTab: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [memberBadges, setMemberBadges] = useState<MemberBadge[]>([]);
    const [seasons, setSeasons] = useState<SeasonSummary[]>([]);
    const [currentSeason, setCurrentSeason] = useState<SeasonSummary | null>(null);
    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
    const [recapSnapshots, setRecapSnapshots] = useState<RecapSnapshot[]>([]);
    const [selectedSnapshot, setSelectedSnapshot] = useState<RecapSnapshot | null>(null);
    const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
    const [recapError, setRecapError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showRecap, setShowRecap] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [membersData, logsData, seasonData, memberBadgeData, seasonsData, recapSnapshotData] = await Promise.all([
                getMembers(),
                getLogs(),
                getCurrentSeason(),
                getMemberBadges(),
                getSeasons(),
                getRecapSnapshots({ scope: 'overall', limit: 6 }),
            ]);

            setMembers(membersData);
            setLogs(logsData);
            setCurrentSeason(seasonData);
            setMemberBadges(memberBadgeData);
            setSeasons(seasonsData);
            setRecapSnapshots(recapSnapshotData);
            setSelectedSeasonId(seasonData?.id ?? seasonsData[0]?.id ?? null);
            setIsLoading(false);
        };

        loadData();
    }, []);

    const selectedSeason = useMemo(
        () => seasons.find((season) => season.id === selectedSeasonId) ?? currentSeason ?? seasons[0] ?? null,
        [currentSeason, seasons, selectedSeasonId],
    );

    const previousSeason = useMemo(() => {
        if (!selectedSeason) {
            return null;
        }

        const selectedIndex = seasons.findIndex((season) => season.id === selectedSeason.id);
        return selectedIndex >= 0 ? seasons[selectedIndex + 1] ?? null : null;
    }, [seasons, selectedSeason]);

    const eligibleSnapshotMembers = useMemo(
        () => members.filter((member) => member.isApproved && member.status === 'active'),
        [members],
    );

    const stats = useMemo(() => {
        const effectiveLogs = logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed');
        const selectedRange = toSeasonRange(selectedSeason);
        const previousRange = toSeasonRange(previousSeason);

        const selectedLogs = effectiveLogs.filter((log) => isWithinRange(log.timestamp, selectedRange.start, selectedRange.end));
        const previousLogs = previousSeason
            ? effectiveLogs.filter((log) => isWithinRange(log.timestamp, previousRange.start, previousRange.end))
            : [];

        const selectedBadges = memberBadges.filter((badge) => {
            if (selectedSeason?.id && badge.seasonId === selectedSeason.id) {
                return true;
            }

            return isWithinRange(badge.awardedAt, selectedRange.start, selectedRange.end);
        });

        const previousBadges = previousSeason
            ? memberBadges.filter((badge) => {
                if (badge.seasonId === previousSeason.id) {
                    return true;
                }

                return isWithinRange(badge.awardedAt, previousRange.start, previousRange.end);
            })
            : [];

        const totalMembers = members.length;
        const levelCounts = [0, 0, 0];
        members.forEach((member) => {
            if (member.score >= 200) levelCounts[2] += 1;
            else if (member.score >= 100) levelCounts[1] += 1;
            else levelCounts[0] += 1;
        });

        const selectedTeamStats = buildTeamStats(selectedLogs, members);
        const previousTeamStats = buildTeamStats(previousLogs, members);
        const selectedCategoryStats = buildCategoryStats(selectedLogs);
        const previousCategoryStats = buildCategoryStats(previousLogs);
        const selectedMemberStats = buildMemberStats(selectedLogs, members);

        const teamComparison = [...new Set([...selectedTeamStats.map((row) => row.team), ...previousTeamStats.map((row) => row.team)])]
            .map((team) => {
                const current = selectedTeamStats.find((row) => row.team === team);
                const previous = previousTeamStats.find((row) => row.team === team);

                return {
                    team,
                    currentPoints: current?.totalPoints ?? 0,
                    previousPoints: previous?.totalPoints ?? 0,
                    currentActivities: current?.activityCount ?? 0,
                    participantCount: current?.participantCount ?? 0,
                };
            })
            .sort((a, b) => b.currentPoints - a.currentPoints || b.previousPoints - a.previousPoints)
            .slice(0, 6);

        const categoryComparison = [...new Set([...selectedCategoryStats.map((row) => row.name), ...previousCategoryStats.map((row) => row.name)])]
            .map((name) => {
                const current = selectedCategoryStats.find((row) => row.name === name);
                const previous = previousCategoryStats.find((row) => row.name === name);

                return {
                    name,
                    currentCount: current?.count ?? 0,
                    previousCount: previous?.count ?? 0,
                };
            })
            .sort((a, b) => b.currentCount + b.previousCount - (a.currentCount + a.previousCount))
            .slice(0, 5);

        return {
            effectiveLogs,
            totalMembers,
            levelCounts,
            selectedLogs,
            previousLogs,
            selectedBadges,
            previousBadges,
            selectedTeamStats,
            selectedCategoryStats,
            selectedMemberStats,
            teamComparison,
            categoryComparison,
            selectedUniqueMembers: new Set(selectedLogs.map((log) => log.memberId)).size,
            previousUniqueMembers: new Set(previousLogs.map((log) => log.memberId)).size,
            selectedActiveDays: new Set(selectedLogs.map((log) => new Date(log.timestamp).toISOString().slice(0, 10))).size,
            previousActiveDays: new Set(previousLogs.map((log) => new Date(log.timestamp).toISOString().slice(0, 10))).size,
            selectedPoints: selectedLogs.reduce((sum, log) => sum + log.pointDelta, 0),
            previousPoints: previousLogs.reduce((sum, log) => sum + log.pointDelta, 0),
            topContributor: selectedMemberStats[0] ?? null,
            topTeam: selectedTeamStats[0] ?? null,
            topRule: selectedCategoryStats[0] ?? null,
        };
    }, [logs, memberBadges, members, previousSeason, selectedSeason]);

    const handleGenerateRecapSnapshots = async (periodType: RecapSnapshotPeriod) => {
        setIsGeneratingRecap(true);
        setRecapError(null);

        try {
            const effectiveLogs = stats.effectiveLogs;
            const overallDraft = buildOverallRecapSnapshotDraft({
                members,
                season: periodType === 'season' ? selectedSeason : currentSeason,
                logs: effectiveLogs,
                memberBadges,
                periodType,
            });

            const memberDrafts = eligibleSnapshotMembers
                .map((member) => buildMemberRecapSnapshotDraft({
                    member,
                    season: periodType === 'season' ? selectedSeason : currentSeason,
                    logs: effectiveLogs.filter((log) => log.memberId === member.id),
                    memberBadges: memberBadges.filter((badge) => badge.memberId === member.id),
                    periodType,
                }))
                .filter((draft) => {
                    const totalStat = draft.payload.stats.find((stat) => stat.label === '활동 수');
                    return totalStat ? totalStat.value !== '0건' : true;
                });

            await createRecapSnapshots([overallDraft, ...memberDrafts]);
            const nextSnapshots = await getRecapSnapshots({ scope: 'overall', limit: 6 });
            setRecapSnapshots(nextSnapshots);
        } catch (error) {
            setRecapError(error instanceof Error ? error.message : '리캡 저장본을 생성하지 못했습니다.');
        } finally {
            setIsGeneratingRecap(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="flex animate-pulse flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100" />
                    <div className="font-medium text-indigo-600">통계를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    const doughnutData = {
        labels: ['1단계 회원', '2단계 우수 기여자', '3단계 핵심 멤버'],
        datasets: [
            {
                data: stats.levelCounts,
                backgroundColor: ['#f8fafc', '#d1fae5', '#fde68a'],
                borderColor: ['#cbd5e1', '#10b981', '#f59e0b'],
                borderWidth: 1,
            },
        ],
    };

    const teamBarData = {
        labels: stats.teamComparison.map((team) => team.team),
        datasets: [
            {
                label: selectedSeason?.name ?? '선택 시즌',
                data: stats.teamComparison.map((team) => team.currentPoints),
                backgroundColor: '#2563eb',
                borderRadius: 8,
            },
            {
                label: previousSeason?.name ?? '이전 시즌',
                data: stats.teamComparison.map((team) => team.previousPoints),
                backgroundColor: '#cbd5e1',
                borderRadius: 8,
            },
        ],
    };

    const ruleBarData = {
        labels: stats.categoryComparison.map((category) => category.name),
        datasets: [
            {
                label: selectedSeason?.name ?? '선택 시즌',
                data: stats.categoryComparison.map((category) => category.currentCount),
                backgroundColor: '#7c3aed',
                borderRadius: 8,
            },
            {
                label: previousSeason?.name ?? '이전 시즌',
                data: stats.categoryComparison.map((category) => category.previousCount),
                backgroundColor: '#e9d5ff',
                borderRadius: 8,
            },
        ],
    };

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                        <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                            <BarChart3 className="text-indigo-600" />
                            통계 및 리캡
                        </h2>
                        <p className="mt-1 text-slate-500">
                            선택한 시즌을 기준으로 팀 흐름과 전시즌 대비 변화량을 함께 읽어봅니다.
                        </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
                            <CalendarRange size={18} className="text-indigo-600" />
                            <span>비교 시즌</span>
                            <select
                                value={selectedSeason?.id ?? ''}
                                onChange={(event) => setSelectedSeasonId(event.target.value)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition-colors focus:border-indigo-300"
                            >
                                {seasons.map((season) => (
                                    <option key={season.id} value={season.id}>
                                        {season.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <button
                            onClick={() => setShowRecap(true)}
                            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-3 font-bold text-white shadow-md shadow-indigo-200 transition-all active:scale-95"
                        >
                            <PlayCircle size={20} />
                            리캡 열기
                        </button>
                    </div>
                </header>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-sm">
                        <div className="flex flex-col gap-5">
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                                <Archive size={14} />
                                저장형 리캡
                            </div>
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">월말/시즌말 리캡을 저장본으로 남깁니다</h3>
                                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                                    생성 시점의 요약, 대표 장면, 배지 흐름을 그대로 보관합니다. 이후 데이터가 더 쌓여도 저장본 해석은 바뀌지 않습니다.
                                </p>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => void handleGenerateRecapSnapshots('month')}
                                    disabled={isGeneratingRecap}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm font-bold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isGeneratingRecap ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
                                    월간 리캡 생성
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void handleGenerateRecapSnapshots('season')}
                                    disabled={isGeneratingRecap}
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/30 bg-sky-400/15 px-4 py-4 text-sm font-bold text-sky-100 transition-colors hover:bg-sky-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {isGeneratingRecap ? <LoaderCircle size={18} className="animate-spin" /> : <PlayCircle size={18} />}
                                    시즌 리캡 생성
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">선택 시즌</div>
                                    <div className="mt-2 font-semibold text-white">{selectedSeason?.name ?? '시즌 미선택'}</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">생성 대상 회원</div>
                                    <div className="mt-2 font-semibold text-white">{eligibleSnapshotMembers.length}명</div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">최근 저장본</div>
                                    <div className="mt-2 font-semibold text-white">{recapSnapshots[0] ? new Date(recapSnapshots[0].createdAt).toLocaleDateString('ko-KR') : '없음'}</div>
                                </div>
                            </div>
                            {recapError && (
                                <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                                    {recapError}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">저장된 운영 리캡</h3>
                                <p className="mt-1 text-sm text-slate-500">생성된 저장본은 여기서 다시 열어보고 공유 카드로도 내보낼 수 있습니다.</p>
                            </div>
                            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                                최근 {recapSnapshots.length}개
                            </div>
                        </div>

                        <div className="mt-5 space-y-3">
                            {recapSnapshots.length === 0 ? (
                                <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500">
                                    아직 저장된 운영 리캡이 없습니다. 월간 또는 시즌 리캡을 한 번 생성하면 이후에는 같은 기간 저장본을 다시 열어볼 수 있습니다.
                                </div>
                            ) : (
                                recapSnapshots.map((snapshot) => (
                                    <button
                                        key={snapshot.id}
                                        type="button"
                                        onClick={() => setSelectedSnapshot(snapshot)}
                                        className="flex w-full flex-col gap-3 rounded-[24px] border border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 px-5 py-5 text-left shadow-sm transition-transform hover:-translate-y-0.5"
                                    >
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div>
                                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                                                    {snapshot.periodType === 'month' ? '월간 저장본' : '시즌 저장본'}
                                                </div>
                                                <div className="mt-3 text-lg font-bold text-slate-900">{snapshot.title}</div>
                                                <div className="mt-1 text-sm text-slate-500">{snapshot.subtitle}</div>
                                            </div>
                                            <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
                                                <Clock3 size={14} />
                                                {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.createdAt))}
                                            </div>
                                        </div>
                                        <p className="text-sm leading-7 text-slate-600">{snapshot.summary}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {snapshot.payload.stats.slice(0, 3).map((stat) => (
                                                <span
                                                    key={`${snapshot.id}_${stat.label}`}
                                                    className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                                                >
                                                    {stat.label} · {stat.value}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                                <TrendingUp size={22} />
                            </div>
                            <DeltaIndicator current={stats.selectedPoints} previous={stats.previousPoints} suffix="점" />
                        </div>
                        <div className="mt-5 text-sm font-medium text-slate-500">시즌 누적 점수</div>
                        <div className="mt-2 text-3xl font-black text-slate-900">
                            {stats.selectedPoints > 0 ? '+' : ''}
                            {stats.selectedPoints}점
                        </div>
                        <div className="mt-2 text-sm text-slate-500">
                            비교 기준: {previousSeason?.name ?? '이전 시즌 없음'}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
                                <Award size={22} />
                            </div>
                            <DeltaIndicator current={stats.selectedLogs.length} previous={stats.previousLogs.length} suffix="건" />
                        </div>
                        <div className="mt-5 text-sm font-medium text-slate-500">활동 기록 수</div>
                        <div className="mt-2 text-3xl font-black text-slate-900">{stats.selectedLogs.length}건</div>
                        <div className="mt-2 text-sm text-slate-500">기록량 증가가 곧 시즌 밀도를 보여줍니다.</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
                                <Users size={22} />
                            </div>
                            <DeltaIndicator current={stats.selectedUniqueMembers} previous={stats.previousUniqueMembers} suffix="명" />
                        </div>
                        <div className="mt-5 text-sm font-medium text-slate-500">참여 회원</div>
                        <div className="mt-2 text-3xl font-black text-slate-900">{stats.selectedUniqueMembers}명</div>
                        <div className="mt-2 text-sm text-slate-500">전체 멤버 {stats.totalMembers}명 중 실제 참여 인원입니다.</div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="rounded-xl bg-amber-50 p-3 text-amber-600">
                                <Sparkles size={22} />
                            </div>
                            <DeltaIndicator current={stats.selectedBadges.length} previous={stats.previousBadges.length} suffix="개" />
                        </div>
                        <div className="mt-5 text-sm font-medium text-slate-500">신규 배지</div>
                        <div className="mt-2 text-3xl font-black text-slate-900">{stats.selectedBadges.length}개</div>
                        <div className="mt-2 text-sm text-slate-500">보상 체계가 실제로 열린 순간을 추적합니다.</div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="mb-6 text-lg font-bold text-slate-900">전체 레벨 분포</h3>
                        <div className="flex h-72 justify-center">
                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">팀별 시즌 비교</h3>
                                <p className="mt-1 text-sm text-slate-500">선택 시즌과 직전 시즌의 팀 점수를 나란히 비교합니다.</p>
                            </div>
                        </div>
                        <div className="h-80">
                            <Bar
                                data={teamBarData}
                                options={{
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-6 flex items-center justify-between gap-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">규칙 사용량 비교</h3>
                                <p className="mt-1 text-sm text-slate-500">어떤 활동 규칙이 시즌 분위기를 만들었는지 전시즌과 비교합니다.</p>
                            </div>
                        </div>
                        <div className="h-80">
                            <Bar
                                data={ruleBarData}
                                options={{
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900">운영 하이라이트</h3>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-medium text-slate-500">상위 기록자</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{stats.topContributor?.name ?? '-'}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {stats.topContributor
                                        ? `${stats.topContributor.totalPoints > 0 ? '+' : ''}${stats.topContributor.totalPoints}점 · ${stats.topContributor.activityCount}건`
                                        : '아직 기록이 없습니다.'}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-medium text-slate-500">이번 시즌 최상위 팀</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{stats.topTeam?.team ?? '-'}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {stats.topTeam
                                        ? `${stats.topTeam.totalPoints > 0 ? '+' : ''}${stats.topTeam.totalPoints}점 · 참여 ${stats.topTeam.participantCount}명`
                                        : '아직 팀 집계가 없습니다.'}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-medium text-slate-500">대표 규칙</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{stats.topRule?.name ?? '-'}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {stats.topRule
                                        ? `${stats.topRule.count}건 · ${stats.topRule.delta > 0 ? '+' : ''}${stats.topRule.delta}점`
                                        : '아직 대표 규칙이 없습니다.'}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-sky-50 px-4 py-4">
                                <div className="text-sm font-medium text-indigo-600">활동 밀도</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{stats.selectedActiveDays}일 운영</div>
                                <div className="mt-1 text-sm text-slate-600">
                                    전시즌 대비 {formatDelta(stats.selectedActiveDays, stats.previousActiveDays, '일')}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">팀별 비교 보드</h3>
                            <span className="text-sm text-slate-500">{selectedSeason?.name ?? '전체 시즌'} 기준</span>
                        </div>
                        <div className="space-y-3">
                            {stats.teamComparison.map((team) => {
                                const maxPoints = Math.max(...stats.teamComparison.map((entry) => Math.max(entry.currentPoints, entry.previousPoints)), 1);
                                const width = `${Math.max((team.currentPoints / maxPoints) * 100, team.currentPoints > 0 ? 8 : 0)}%`;
                                const delta = team.currentPoints - team.previousPoints;

                                return (
                                    <div key={team.team} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="font-semibold text-slate-900">{team.team}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    활동 {team.currentActivities}건 · 참여 {team.participantCount}명
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-slate-900">
                                                    {team.currentPoints > 0 ? '+' : ''}
                                                    {team.currentPoints}점
                                                </div>
                                                <div className={`mt-1 text-sm font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                    {delta > 0 ? '+' : ''}
                                                    {delta}점
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 h-2 rounded-full bg-slate-200">
                                            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600" style={{ width }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-900">비교 메모</h3>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-medium text-slate-500">시즌 해석</div>
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                    {stats.topTeam
                                        ? `${stats.topTeam.team}이 이번 구간의 흐름을 주도했고, ${stats.topContributor?.name ?? '핵심 멤버'}가 점수 기준 상위권을 이끌고 있습니다.`
                                        : '충분한 기록이 쌓이면 시즌 해석 문장이 자동으로 더 풍부해집니다.'}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-medium text-slate-500">전시즌 대비</div>
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                    {previousSeason
                                        ? `총점은 ${formatDelta(stats.selectedPoints, stats.previousPoints, '점')}이고, 활동량은 ${formatDelta(stats.selectedLogs.length, stats.previousLogs.length, '건')}입니다.`
                                        : '현재는 비교 가능한 이전 시즌이 없어서 단일 시즌 관점으로만 해석합니다.'}
                                </p>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                <div className="text-sm font-medium text-slate-500">보상 흐름</div>
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                    신규 배지는 {stats.selectedBadges.length}개 열렸고, 규칙 사용량 상위는 {stats.topRule?.name ?? '미집계'}입니다. 활동 설계와 보상이 같은 방향으로 움직이는지 여기서 바로 읽을 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {showRecap && (
                <RecapViewer
                    members={members}
                    logs={stats.effectiveLogs}
                    memberBadges={memberBadges}
                    season={selectedSeason}
                    onClose={() => setShowRecap(false)}
                />
            )}

            {selectedSnapshot && (
                <RecapSnapshotViewer
                    snapshot={selectedSnapshot}
                    onClose={() => setSelectedSnapshot(null)}
                />
            )}
        </>
    );
};
