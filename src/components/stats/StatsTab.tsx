import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart3,
    CalendarRange,
    PlayCircle,
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import type { RecapSnapshot, RecapSnapshotPeriod } from '../../types';
import { createRecapSnapshots } from '../../lib/api/stats/overview';
import { filterEffectiveActivityLogs, filterLogsWithinRange } from '../../lib/domain/activityLogs';
import { buildMemberRecapSnapshotDraft, buildOverallRecapSnapshotDraft, buildRecapScope } from '../../lib/recapSnapshots';
import { buildCategoryStats, buildMemberStats, buildTeamStats, isWithinRange, toSeasonRange } from '../../lib/domain/stats';
import { useStatsResources } from './hooks/useStatsResources';
import { RecapViewer } from './RecapViewer';
import { StatsArchivesSection } from './sections/StatsArchivesSection';
import { StatsCompareSection } from './sections/StatsCompareSection';
import { StatsRecapSection } from './sections/StatsRecapSection';
import { RecapSnapshotViewer } from '../recap/RecapSnapshotViewer';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

type StatsViewTab = 'recap' | 'compare' | 'archives';

export const StatsTab: React.FC = () => {
    const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
    const [selectedSnapshot, setSelectedSnapshot] = useState<RecapSnapshot | null>(null);
    const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
    const [recapError, setRecapError] = useState<string | null>(null);
    const [showRecap, setShowRecap] = useState(false);
    const [activeView, setActiveView] = useState<StatsViewTab>('recap');
    const {
        members,
        logs,
        memberBadges,
        seasons,
        currentSeason,
        recapSnapshots,
        isLoading,
        refreshSnapshots,
    } = useStatsResources();

    useEffect(() => {
        if (!selectedSeasonId || !seasons.some((season) => season.id === selectedSeasonId)) {
            setSelectedSeasonId(currentSeason?.id ?? seasons[0]?.id ?? null);
        }
    }, [currentSeason, seasons, selectedSeasonId]);

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

    const eligibleSnapshotMembers = useMemo(() => {
        const scope = buildRecapScope('season', selectedSeason ?? currentSeason);
        const activeVisibleMembers = members.filter((member) => member.status === 'active' && (member.isVisible ?? true));
        const effectiveLogs = filterEffectiveActivityLogs(logs);
        const loggedMemberIds = new Set(
            filterLogsWithinRange(effectiveLogs, scope.start, scope.end).map((log) => log.memberId),
        );

        return activeVisibleMembers.filter((member) => loggedMemberIds.has(member.id));
    }, [currentSeason, logs, members, selectedSeason]);

    const stats = useMemo(() => {
        const effectiveLogs = filterEffectiveActivityLogs(logs);
        const selectedRange = toSeasonRange(selectedSeason);
        const previousRange = toSeasonRange(previousSeason);

        const selectedLogs = filterLogsWithinRange(effectiveLogs, selectedRange.start, selectedRange.end);
        const previousLogs = previousSeason
            ? filterLogsWithinRange(effectiveLogs, previousRange.start, previousRange.end)
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
            await refreshSnapshots();
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

    const recentSnapshots = recapSnapshots.slice(0, 3);
    const latestSnapshotDateLabel = recapSnapshots[0]
        ? new Date(recapSnapshots[0].createdAt).toLocaleDateString('ko-KR')
        : '없음';

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

                <section className="rounded-[28px] border border-slate-200 bg-white p-2 shadow-sm">
                    <div className="flex flex-wrap gap-2">
                        {([
                            { key: 'recap', label: '리캡' },
                            { key: 'compare', label: '비교 통계' },
                            { key: 'archives', label: '저장본' },
                        ] satisfies Array<{ key: StatsViewTab; label: string }>).map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveView(tab.key)}
                                className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                                    activeView === tab.key
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </section>

                {activeView === 'recap' && (
                    <StatsRecapSection
                        selectedSeasonName={selectedSeason?.name ?? null}
                        eligibleSnapshotMemberCount={eligibleSnapshotMembers.length}
                        latestSnapshotDateLabel={latestSnapshotDateLabel}
                        isGeneratingRecap={isGeneratingRecap}
                        recapError={recapError}
                        onGenerateRecap={handleGenerateRecapSnapshots}
                        recentSnapshots={recentSnapshots}
                        onOpenArchives={() => setActiveView('archives')}
                        onSelectSnapshot={setSelectedSnapshot}
                    />
                )}

                {activeView === 'compare' && (
                    <StatsCompareSection
                        doughnutData={doughnutData}
                        teamBarData={teamBarData}
                        ruleBarData={ruleBarData}
                        stats={{
                            topContributor: stats.topContributor
                                ? {
                                    name: stats.topContributor.name,
                                    totalPoints: stats.topContributor.totalPoints,
                                    activityCount: stats.topContributor.activityCount,
                                }
                                : null,
                            topTeam: stats.topTeam
                                ? {
                                    team: stats.topTeam.team,
                                    totalPoints: stats.topTeam.totalPoints,
                                    participantCount: stats.topTeam.participantCount,
                                }
                                : null,
                            topRule: stats.topRule
                                ? {
                                    name: stats.topRule.name,
                                    count: stats.topRule.count,
                                    delta: stats.topRule.delta,
                                }
                                : null,
                            selectedActiveDays: stats.selectedActiveDays,
                            previousActiveDays: stats.previousActiveDays,
                        }}
                    />
                )}

                {activeView === 'archives' && (
                    <StatsArchivesSection
                        recapSnapshots={recapSnapshots}
                        onSelectSnapshot={setSelectedSnapshot}
                    />
                )}
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
