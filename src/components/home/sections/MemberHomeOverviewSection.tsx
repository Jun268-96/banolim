import React from 'react';
import { Activity, Flame, Link2, Sparkles, TrendingUp } from 'lucide-react';
import type { ActivityLog, AnnouncementItem, ScheduleEventItem } from '../../../types';
import { NoticeScheduleBoard } from '../../shared/NoticeScheduleBoard';

interface RecentSnapshot {
  recentPoints: number;
  activeDays: number;
  evidenceCount: number;
  streakDays: number;
}

interface MemberHomeOverviewSectionProps {
  announcements: AnnouncementItem[];
  scheduleEvents: ScheduleEventItem[];
  seasonName: string;
  seasonScore: number;
  seasonLogCount: number;
  memberBadgeCount: number;
  homeRecentLogs: ActivityLog[];
  recentSnapshot: RecentSnapshot;
  growthDescription: string;
  formatDateTime: (value?: string | null) => string;
  onOpenActivity: () => void;
}

export const MemberHomeOverviewSection: React.FC<MemberHomeOverviewSectionProps> = ({
  announcements,
  scheduleEvents,
  seasonName,
  seasonScore,
  seasonLogCount,
  memberBadgeCount,
  homeRecentLogs,
  recentSnapshot,
  growthDescription,
  formatDateTime,
  onOpenActivity,
}) => (
  <div className="space-y-6">
    <NoticeScheduleBoard
      announcements={announcements}
      scheduleEvents={scheduleEvents}
      title="공지와 다가오는 일정"
      description="운영진이 공유한 공지와 예정된 일정을 가장 먼저 확인할 수 있습니다."
    />

    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <Sparkles size={18} className="text-indigo-600" />
        이번 시즌 점수
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">누적 점수</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {seasonScore > 0 ? '+' : ''}
            {seasonScore}점
          </div>
          <div className="mt-1 text-sm text-slate-500">{seasonName}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">기록 건수</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{seasonLogCount}건</div>
          <div className="mt-1 text-sm text-slate-500">이번 시즌 누적 활동</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">공식 배지</div>
          <div className="mt-2 text-2xl font-bold text-indigo-600">{memberBadgeCount}개</div>
          <div className="mt-1 text-sm text-slate-500">활성 조건을 만족한 현재 배지 수</div>
        </div>
      </div>
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <Activity size={18} className="text-indigo-600" />
          최근 활동
        </div>
        <button
          type="button"
          onClick={onOpenActivity}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          내 활동 보기
        </button>
      </div>
      <div className="mt-5 space-y-3">
        {homeRecentLogs.length > 0 ? (
          homeRecentLogs.map((log) => (
            <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{log.categoryName ?? '알 수 없는 규칙'}</div>
                  <div className="mt-1 text-sm text-slate-500">{log.reason ?? '기록 사유 없음'}</div>
                </div>
                <div className="text-sm text-slate-500">{formatDateTime(log.timestamp)}</div>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${log.pointDelta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                  {log.pointDelta > 0 ? '+' : ''}
                  {log.pointDelta}점
                </span>
                {log.evidenceUrl ? (
                  <a
                    href={log.evidenceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-sky-700 hover:text-sky-800"
                  >
                    <Link2 size={14} />
                    증빙 보기
                  </a>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
            최근 활동이 아직 없습니다.
          </div>
        )}
      </div>
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-slate-900">
        <TrendingUp size={18} className="text-indigo-600" />
        최근 30일 변화
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">최근 30일 점수</div>
          <div className={`mt-2 text-2xl font-bold ${recentSnapshot.recentPoints >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
            {recentSnapshot.recentPoints > 0 ? '+' : ''}
            {recentSnapshot.recentPoints}점
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">활동 일수</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{recentSnapshot.activeDays}일</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">연속 활동</div>
          <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-950">
            <Flame size={18} className="text-amber-500" />
            {recentSnapshot.streakDays}일
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm text-slate-500">증빙 포함 기록</div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{recentSnapshot.evidenceCount}건</div>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-6 text-indigo-900">
        {growthDescription}
      </div>
    </section>
  </div>
);
