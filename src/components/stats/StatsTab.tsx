import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, Award, PlayCircle } from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import type { Member, Category, ActivityLog } from '../../types';
import { getMembers, getCategories, getLogs } from '../../lib/db';
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
                getLogs()
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
        const totalScore = members.reduce((sum, m) => sum + m.score, 0);
        const avgScore = totalMembers > 0 ? Math.round(totalScore / totalMembers) : 0;
        const totalActivities = logs.length;

        const levelCounts = [0, 0, 0]; // 1, 2, 3
        members.forEach(m => {
            if (m.score >= 200) levelCounts[2]++;
            else if (m.score >= 100) levelCounts[1]++;
            else levelCounts[0]++;
        });

        const categoryStats = categories.map(cat => {
            const catLogs = logs.filter(l => l.categoryId === cat.id);
            return {
                name: cat.categoryName,
                count: catLogs.length,
                totalPoints: catLogs.reduce((sum, l) => sum + l.pointDelta, 0)
            };
        }).sort((a, b) => b.count - a.count);

        return { totalMembers, avgScore, totalActivities, levelCounts, categoryStats };
    }, [members, categories, logs]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">통계를 집계하는 중...</div>
                </div>
            </div>
        );
    }

    const doughnutData = {
        labels: ['Lv.1 일반', 'Lv.2 선임', 'Lv.3 수석'],
        datasets: [
            {
                data: stats.levelCounts,
                backgroundColor: ['#f1f5f9', '#d1fae5', '#fef3c7'],
                borderColor: ['#cbd5e1', '#10b981', '#f59e0b'],
                borderWidth: 1,
            },
        ],
    };

    const barData = {
        labels: stats.categoryStats.slice(0, 5).map(c => c.name),
        datasets: [
            {
                label: '부여 횟수',
                data: stats.categoryStats.slice(0, 5).map(c => c.count),
                backgroundColor: '#6366f1',
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
                            통계 & Recap
                        </h2>
                        <p className="text-slate-500 mt-1">연구회의 활동 성과와 연말 정산을 확인하세요.</p>
                    </div>

                    <button
                        onClick={() => setShowRecap(true)}
                        className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 transition-all active:scale-95"
                    >
                        <PlayCircle size={20} />
                        반올림 Recap 재생
                    </button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Users size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">총 인원</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalMembers}명</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">평균 점수</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.avgScore}pt</div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                            <Award size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">총 활동 건수</div>
                            <div className="text-2xl font-bold text-slate-900">{stats.totalActivities}건</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">레벨 분포도</h3>
                        <div className="h-64 flex justify-center">
                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-6">가장 많이 달성된 항목 (Top 5)</h3>
                        <div className="h-64">
                            <Bar data={barData} options={{ maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} />
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
