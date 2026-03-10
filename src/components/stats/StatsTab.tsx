import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, TrendingUp, Users, Award, PlayCircle, Layers3 } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import type { ActivityLog, Category, Member } from '../../types';
import { getCategories, getLogs, getMembers } from '../../lib/db';
import { RecapViewer } from './RecapViewer';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export const StatsTab: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showRecap, setShowRecap] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const [membersData, categoriesData, logsData] = await Promise.all([
                getMembers(),
                getCategories(),
                getLogs(),
            ]);

            setMembers(membersData);
            setCategories(categoriesData);
            setLogs(logsData);
            setIsLoading(false);
        };

        loadData();
    }, []);

    const stats = useMemo(() => {
        const totalMembers = members.length;
        const totalScore = members.reduce((sum, member) => sum + member.score, 0);
        const avgScore = totalMembers > 0 ? Math.round(totalScore / totalMembers) : 0;
        const totalActivities = logs.length;

        const levelCounts = [0, 0, 0];
        members.forEach((member) => {
            if (member.score >= 200) levelCounts[2]++;
            else if (member.score >= 100) levelCounts[1]++;
            else levelCounts[0]++;
        });

        const categoryStats = categories
            .map((category) => {
                const categoryLogs = logs.filter((log) => log.categoryId === category.id);
                return {
                    name: category.categoryName,
                    count: categoryLogs.length,
                };
            })
            .sort((a, b) => b.count - a.count);

        const teamStats = Object.entries(
            members.reduce<Record<string, { totalScore: number; memberCount: number }>>((teams, member) => {
                const key = member.teamName || 'Unassigned';
                const current = teams[key] ?? { totalScore: 0, memberCount: 0 };
                teams[key] = {
                    totalScore: current.totalScore + member.score,
                    memberCount: current.memberCount + 1,
                };
                return teams;
            }, {}),
        )
            .map(([team, summary]) => ({
                team,
                totalScore: summary.totalScore,
                memberCount: summary.memberCount,
            }))
            .sort((a, b) => b.totalScore - a.totalScore);

        return { totalMembers, avgScore, totalActivities, levelCounts, categoryStats, teamStats };
    }, [members, categories, logs]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">Loading stats...</div>
                </div>
            </div>
        );
    }

    const doughnutData = {
        labels: ['Lv.1 Member', 'Lv.2 Top contributor', 'Lv.3 Core team'],
        datasets: [
            {
                data: stats.levelCounts,
                backgroundColor: ['#f1f5f9', '#d1fae5', '#fef3c7'],
                borderColor: ['#cbd5e1', '#10b981', '#f59e0b'],
                borderWidth: 1,
            },
        ],
    };

    const ruleBarData = {
        labels: stats.categoryStats.slice(0, 5).map((category) => category.name),
        datasets: [
            {
                label: 'Log count',
                data: stats.categoryStats.slice(0, 5).map((category) => category.count),
                backgroundColor: '#6366f1',
                borderRadius: 4,
            },
        ],
    };

    const teamBarData = {
        labels: stats.teamStats.slice(0, 6).map((team) => team.team),
        datasets: [
            {
                label: 'Team score',
                data: stats.teamStats.slice(0, 6).map((team) => team.totalScore),
                backgroundColor: '#0ea5e9',
                borderRadius: 4,
            },
        ],
    };

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
                <header className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <BarChart3 className="text-indigo-600" />
                            Stats & Recap
                        </h2>
                        <p className="text-slate-500 mt-1">Read the platform from both member and team perspectives.</p>
                    </div>

                    <button
                        onClick={() => setShowRecap(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 transition-all active:scale-95"
                    >
                        <PlayCircle size={20} />
                        Open recap
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Total members</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalMembers}</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Average score</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.avgScore}pt</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                            <Award size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Total activity logs</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalActivities}</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-xl flex items-center justify-center">
                            <Layers3 size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Top team</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.teamStats[0]?.team ?? '-'}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 xl:col-span-1">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Score distribution</h3>
                        <div className="h-72 flex justify-center">
                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 xl:col-span-2">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Team leaderboard</h3>
                        <div className="h-72">
                            <Bar
                                data={teamBarData}
                                options={{
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">Top rules by usage</h3>
                        <div className="h-72">
                            <Bar
                                data={ruleBarData}
                                options={{
                                    maintainAspectRatio: false,
                                    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                                }}
                            />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Team summary</h3>
                        <div className="space-y-3">
                            {stats.teamStats.slice(0, 5).map((team) => (
                                <div key={team.team} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                                    <div>
                                        <div className="font-medium text-slate-900">{team.team}</div>
                                        <div className="text-sm text-slate-500">{team.memberCount} members</div>
                                    </div>
                                    <div className="text-lg font-bold text-indigo-600">{team.totalScore}pt</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {showRecap && (
                <RecapViewer
                    members={members}
                    categories={categories}
                    logs={logs}
                    onClose={() => setShowRecap(false)}
                />
            )}
        </>
    );
};
