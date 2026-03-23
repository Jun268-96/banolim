import React from 'react';
import { PlayCircle, Sparkles } from 'lucide-react';
import type { RecapSnapshot } from '../../../types';

type MemberRecapPeriod = 'month' | 'season';

interface MemberRecapSectionProps {
  recapSnapshots: RecapSnapshot[];
  formatDate: (value?: string | null) => string;
  onOpenRecapPeriod: (period: MemberRecapPeriod) => void;
  onSelectSnapshot: (snapshot: RecapSnapshot) => void;
}

export const MemberRecapSection: React.FC<MemberRecapSectionProps> = ({
  recapSnapshots,
  formatDate,
  onOpenRecapPeriod,
  onSelectSnapshot,
}) => (
  <div className="space-y-6">
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles size={18} className="text-indigo-600" />
            개인 리캡
          </div>
          <p className="mt-1 text-sm text-slate-500">이번 달 리캡과 시즌 리캡을 바로 열고, 저장된 개인 리캡도 여기서 다시 볼 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onOpenRecapPeriod('month')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <PlayCircle size={16} className="text-indigo-600" />
            이번 달 리캡
          </button>
          <button
            type="button"
            onClick={() => onOpenRecapPeriod('season')}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <Sparkles size={16} />
            현재 시즌 리캡
          </button>
        </div>
      </div>
    </section>

    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles size={18} className="text-indigo-600" />
            저장된 개인 리캡
          </div>
          <p className="mt-1 text-sm text-slate-500">운영진이 월간 또는 시즌 리캡을 생성하면 이곳에 저장본이 쌓입니다.</p>
        </div>
        <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
          최근 {recapSnapshots.length}개
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 2xl:grid-cols-2">
        {recapSnapshots.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500 lg:col-span-2">
            아직 저장된 개인 리캡이 없습니다. 운영진이 월간 또는 시즌 저장본을 생성하면 여기서 다시 열어볼 수 있습니다.
          </div>
        ) : (
          recapSnapshots.map((snapshot) => (
            <button
              key={snapshot.id}
              type="button"
              onClick={() => onSelectSnapshot(snapshot)}
              className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-white to-slate-50 p-5 text-left shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                    {snapshot.periodType === 'month' ? '월간 저장본' : '시즌 저장본'}
                  </div>
                  <div className="mt-3 text-lg font-bold text-slate-900">{snapshot.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{snapshot.subtitle}</div>
                </div>
                <div className="text-xs font-semibold text-slate-400">{formatDate(snapshot.createdAt)}</div>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">{snapshot.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
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
    </section>
  </div>
);
