import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Medal, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import type { ActivityLog, Category, Member, SeasonSummary } from '../../types';
import { getCategories, getCurrentSeason, getLogs, getMembers } from '../../lib/db';
import { useAuth } from '../auth/AuthProvider';
import type { TabType } from '../layout/Sidebar';

interface HomeTabProps {
    onNavigate: (tab: TabType) => void;
}

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigate }) => {
    const { permissions } = useAuth();
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const [seasonData, memberData, categoryData, logData] = await Promise.all([
                getCurrentSeason(),
                getMembers(),
                getCategories(),
                getLogs(),
            ]);
            setSeason(seasonData);
            setMembers(memberData);
            setCategories(categoryData);
            setLogs(logData);
            setIsLoading(false);
        };

        void loadData();
    }, []);

    const insights = useMemo(() => {
        const topMember = [...members].sort((a, b) => b.score - a.score)[0] ?? null;
        const recentLogs = logs.slice(0, 6);

        const attendanceRuleIds = new Set(
            categories
                .filter((category) => /attendance|meeting|check-in|presence/i.test(category.categoryName))
                .map((category) => category.id),
        );

        const attendanceCounts = logs.reduce<Record<string, number>>((acc, log) => {
            if (!attendanceRuleIds.has(log.categoryId)) {
                return acc;
            }

            acc[log.memberId] = (acc[log.memberId] ?? 0) + 1;
            return acc;
        }, {});

        const mostConsistent = members
            .map((member) => ({
                member,
                count: attendanceCounts[member.id] ?? 0,
            }))
            .sort((a, b) => b.count - a.count)[0] ?? null;

        const hottestRule = categories
            .map((category) => ({
                category,
                count: logs.filter((log) => log.categoryId === category.id).length,
            }))
            .sort((a, b) => b.count - a.count)[0] ?? null;

        const teamSummary = Object.entries(
            members.reduce<Record<string, { score: number; count: number }>>((acc, member) => {
                const key = member.teamName || 'Unassigned';
                const current = acc[key] ?? { score: 0, count: 0 };
                acc[key] = { score: current.score + member.score, count: current.count + 1 };
                return acc;
            }, {}),
        )
            .map(([team, summary]) => ({ team, ...summary }))
            .sort((a, b) => b.score - a.score);

        return { topMember, recentLogs, mostConsistent, hottestRule, teamSummary };
    }, [categories, logs, members]);

    const quickActions = [
        permissions.canViewActivities
            ? {
                  id: 'activities' as const,
                  label: 'Quick activity log',
                  description: 'Record attendance, study, or contribution right away.',
                  icon: Zap,
              }
            : null,
        permissions.canManagePoints
            ? {
                  id: 'points' as const,
                  label: 'Batch score action',
                  description: 'Apply the same rule to several members in one pass.',
                  icon: Users,
              }
            : null,
        {
            id: 'stats' as const,
            label: 'Review stats',
            description: 'Check team movement, rule usage, and current leaders.',
            icon: TrendingUp,
        },
    ].filter(Boolean);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100"></div>
                    <div className="font-medium text-indigo-600">Loading home dashboard...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 lg:p-8">
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
                    <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-sm font-medium text-sky-700">
                            <Sparkles size={15} />
                            Banollim operations hub
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">
                                Keep the season moving with one shared dashboard.
                            </h2>
                            <p className="max-w-3xl text-base text-slate-600 lg:text-lg">
                                Review the current season, jump into the next action, and keep member activity visible in one place.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {permissions.canViewActivities && (
                                <button
                                    type="button"
                                    onClick={() => onNavigate('activities')}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
                                >
                                    Record an activity
                                    <ArrowRight size={16} />
                                </button>
                            )}
                            {permissions.canManagePoints && (
                                <button
                                    type="button"
                                    onClick={() => onNavigate('points')}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                                >
                                    Open batch scoring
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">Current season</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{season?.name ?? 'No active season'}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {season ? `${formatDate(season.startDate)} - ${formatDate(season.endDate)}` : 'Add a season to start tracking.'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">Visible members</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{members.length}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {members.filter((member) => member.status === 'active').length} currently active
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">Activity records</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{logs.length}</div>
                                <div className="mt-1 text-sm text-slate-500">{categories.length} rules available</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white lg:p-6">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <CalendarDays size={16} />
                            Season snapshot
                        </div>
                        <div>
                            <div className="text-sm text-slate-400">Leading member</div>
                            <div className="mt-1 text-2xl font-bold">{insights.topMember?.name ?? 'No data yet'}</div>
                            <div className="mt-1 text-sky-300">{insights.topMember ? `${insights.topMember.score}pt` : '-'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-wide text-slate-400">Top team</div>
                                <div className="mt-2 font-semibold text-white">{insights.teamSummary[0]?.team ?? 'Pending'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-wide text-slate-400">Most used rule</div>
                                <div className="mt-2 font-semibold text-white">{insights.hottestRule?.category.categoryName ?? 'Pending'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                    <div className={`grid gap-4 ${quickActions.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                        {quickActions.map((action) => {
                            if (!action) {
                                return null;
                            }

                            const Icon = action.icon;

                            return (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => onNavigate(action.id)}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <Icon size={18} className="text-indigo-600" />
                                    <div className="mt-4 font-semibold text-slate-900">{action.label}</div>
                                    <div className="mt-1 text-sm text-slate-500">{action.description}</div>
                                </button>
                            );
                        })}
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                            <div>
                                <div className="font-semibold text-slate-900">Recent activity feed</div>
                                <div className="mt-1 text-sm text-slate-500">The latest logs recorded across the platform.</div>
                            </div>
                            {permissions.canViewActivities && (
                                <button
                                    type="button"
                                    onClick={() => onNavigate('activities')}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                    Open activities
                                </button>
                            )}
                        </div>
                        <div className="divide-y divide-slate-100">
                            {insights.recentLogs.map((log) => (
                                <div key={log.id} className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {log.memberName ?? log.memberId}
                                            <span className="font-normal text-slate-400"> · </span>
                                            {log.categoryName ?? log.categoryId}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{log.note || log.reason || 'No note provided'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-semibold ${log.pointDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {log.pointDelta > 0 ? '+' : ''}
                                            {log.pointDelta}pt
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{formatDateTime(log.timestamp)}</div>
                                    </div>
                                </div>
                            ))}
                            {insights.recentLogs.length === 0 && (
                                <div className="px-6 py-12 text-center text-slate-500">No activity logs yet.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <Medal size={18} className="text-indigo-600" />
                            Highlights
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">Top score</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">{insights.topMember?.name ?? 'Pending'}</div>
                                <div className="mt-1 text-sm text-indigo-600">
                                    {insights.topMember ? `${insights.topMember.score}pt this season` : 'No score data yet'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">Most consistent attendance</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">{insights.mostConsistent?.member.name ?? 'Pending'}</div>
                                <div className="mt-1 text-sm text-emerald-700">
                                    {insights.mostConsistent ? `${insights.mostConsistent.count} attendance logs` : 'No attendance rule detected'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">Most active team</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">{insights.teamSummary[0]?.team ?? 'Pending'}</div>
                                <div className="mt-1 text-sm text-sky-700">
                                    {insights.teamSummary[0] ? `${insights.teamSummary[0].score} total points` : 'No team data yet'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="font-semibold text-slate-900">Top teams</div>
                        <div className="mt-1 text-sm text-slate-500">A quick glance before opening the full stats page.</div>
                        <div className="mt-5 space-y-3">
                            {insights.teamSummary.slice(0, 4).map((team, index) => (
                                <div key={team.team} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div>
                                        <div className="text-sm text-slate-500">#{index + 1}</div>
                                        <div className="font-medium text-slate-900">{team.team}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-indigo-600">{team.score}pt</div>
                                        <div className="text-sm text-slate-500">{team.count} members</div>
                                    </div>
                                </div>
                            ))}
                            {insights.teamSummary.length === 0 && (
                                <div className="text-sm text-slate-500">No team summary available yet.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
