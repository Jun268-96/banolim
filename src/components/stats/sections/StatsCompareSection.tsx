import React from 'react';
import type { ChartData } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { formatDelta } from '../../../lib/domain/stats';

interface StatsCompareSectionProps {
    doughnutData: ChartData<'doughnut', number[], string>;
    teamBarData: ChartData<'bar', number[], string>;
    ruleBarData: ChartData<'bar', number[], string>;
    stats: {
        topContributor: { name: string; totalPoints: number; activityCount: number } | null;
        topTeam: { team: string; totalPoints: number; participantCount: number } | null;
        topRule: { name: string; count: number; delta: number } | null;
        selectedActiveDays: number;
        previousActiveDays: number;
    };
}

export const StatsCompareSection: React.FC<StatsCompareSectionProps> = ({
    doughnutData,
    teamBarData,
    ruleBarData,
    stats,
}) => (
    <div className="space-y-6">
        <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">팀별 시즌 비교</h3>
                        <p className="mt-1 text-sm text-slate-500">선택 시즌과 직전 시즌의 팀 점수를 비교합니다.</p>
                    </div>
                </div>
                <div className="h-64 sm:h-72 lg:h-80">
                    <Bar
                        data={teamBarData}
                        options={{
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                        }}
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">규칙 사용량 비교</h3>
                        <p className="mt-1 text-sm text-slate-500">어떤 규칙이 이번 시즌 분위기를 만들었는지 읽습니다.</p>
                    </div>
                </div>
                <div className="h-64 sm:h-72 lg:h-80">
                    <Bar
                        data={ruleBarData}
                        options={{
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                        }}
                    />
                </div>
            </div>
        </section>

        <section className="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="mb-6 text-lg font-bold text-slate-900">전체 레벨 분포</h3>
                <div className="flex h-60 justify-center sm:h-72">
                    <Doughnut data={doughnutData} options={{ maintainAspectRatio: false }} />
                </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900">비교 메모</h3>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-sm font-medium text-slate-500">상위 기록자</div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{stats.topContributor?.name ?? '-'}</div>
                        <div className="mt-1 text-sm text-slate-500">
                            {stats.topContributor
                                ? `${stats.topContributor.totalPoints > 0 ? '+' : ''}${stats.topContributor.totalPoints}점 · ${stats.topContributor.activityCount}건`
                                : '아직 기록이 없습니다.'}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-sm font-medium text-slate-500">최상위 팀</div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{stats.topTeam?.team ?? '-'}</div>
                        <div className="mt-1 text-sm text-slate-500">
                            {stats.topTeam
                                ? `${stats.topTeam.totalPoints > 0 ? '+' : ''}${stats.topTeam.totalPoints}점 · 참여 ${stats.topTeam.participantCount}명`
                                : '아직 팀 집계가 없습니다.'}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-sm font-medium text-slate-500">대표 규칙</div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{stats.topRule?.name ?? '-'}</div>
                        <div className="mt-1 text-sm text-slate-500">
                            {stats.topRule
                                ? `${stats.topRule.count}건 · ${stats.topRule.delta > 0 ? '+' : ''}${stats.topRule.delta}점`
                                : '아직 대표 규칙이 없습니다.'}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="text-sm font-medium text-slate-500">활동 밀도</div>
                        <div className="mt-2 text-lg font-bold text-slate-900">{stats.selectedActiveDays}일 운영</div>
                        <div className="mt-1 text-sm text-slate-500">
                            전시즌 대비 {formatDelta(stats.selectedActiveDays, stats.previousActiveDays, '일')}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    </div>
);
