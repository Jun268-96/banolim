import React from 'react';
import { Archive, LoaderCircle, PlayCircle, Sparkles } from 'lucide-react';
import type { RecapSnapshot, RecapSnapshotPeriod } from '../../../types';
import { SnapshotCardList } from './SnapshotCardList';

interface StatsRecapSectionProps {
    selectedSeasonName: string | null;
    eligibleSnapshotMemberCount: number;
    latestSnapshotDateLabel: string;
    isGeneratingRecap: boolean;
    recapError: string | null;
    onGenerateRecap: (periodType: RecapSnapshotPeriod) => void | Promise<void>;
    recentSnapshots: RecapSnapshot[];
    onOpenArchives: () => void;
    onSelectSnapshot: (snapshot: RecapSnapshot) => void;
}

export const StatsRecapSection: React.FC<StatsRecapSectionProps> = ({
    selectedSeasonName,
    eligibleSnapshotMemberCount,
    latestSnapshotDateLabel,
    isGeneratingRecap,
    recapError,
    onGenerateRecap,
    recentSnapshots,
    onOpenArchives,
    onSelectSnapshot,
}) => (
    <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-sm">
            <div className="flex flex-col gap-5">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                    <Archive size={14} />
                    저장형 리캡
                </div>
                <div>
                    <h3 className="text-2xl font-black tracking-tight">월말/시즌말 리캡을 저장본으로 남깁니다</h3>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-white/75">
                        생성 시점의 요약과 대표 장면을 저장합니다. 이후 데이터가 더 쌓여도 저장본 해석은 바뀌지 않습니다.
                    </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => void onGenerateRecap('month')}
                        disabled={isGeneratingRecap}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm font-bold text-white transition-colors hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isGeneratingRecap ? <LoaderCircle size={18} className="animate-spin" /> : <Sparkles size={18} />}
                        월간 리캡 생성
                    </button>
                    <button
                        type="button"
                        onClick={() => void onGenerateRecap('season')}
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
                        <div className="mt-2 font-semibold text-white">{selectedSeasonName ?? '시즌 미선택'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/45">생성 대상 회원</div>
                        <div className="mt-2 font-semibold text-white">{eligibleSnapshotMemberCount}명</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/45">최근 저장본</div>
                        <div className="mt-2 font-semibold text-white">{latestSnapshotDateLabel}</div>
                    </div>
                </div>
                {recapError && (
                    <div className="rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                        {recapError}
                    </div>
                )}
            </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-lg font-bold text-slate-900">최근 저장본</h3>
                    <p className="mt-1 text-sm text-slate-500">방금 생성한 리캡을 다시 열어보고 공유 카드로 내보낼 수 있습니다.</p>
                </div>
                <button
                    type="button"
                    onClick={onOpenArchives}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100"
                >
                    전체 저장본 보기
                </button>
            </div>
            <div className="mt-5">
                <SnapshotCardList
                    snapshots={recentSnapshots}
                    emptyMessage="아직 저장된 운영 리캡이 없습니다. 월간 또는 시즌 리캡을 한 번 생성하면 최근 저장본이 여기에 나타납니다."
                    onSelectSnapshot={onSelectSnapshot}
                />
            </div>
        </section>
    </div>
);
