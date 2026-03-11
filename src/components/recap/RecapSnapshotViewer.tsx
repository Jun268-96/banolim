import React, { useMemo, useState } from 'react';
import { CalendarDays, Clock3, CopyCheck, Share2, Shield, Sparkles, UserRound, X } from 'lucide-react';
import type { RecapSnapshot } from '../../types';
import { ShareRecapCard } from './ShareRecapCard';

interface RecapSnapshotViewerProps {
    snapshot: RecapSnapshot;
    onClose: () => void;
}

const bandiMascotUrl = new URL('../../../반디.png', import.meta.url).href;
const didiMascotUrl = new URL('../../../디디.png', import.meta.url).href;
const banollimSchoolLogoUrl = new URL('../../../반디스쿨 로고1.png', import.meta.url).href;

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const recapThemes = {
    member: {
        gradient: 'from-sky-500 via-indigo-600 to-slate-950',
        frame: 'border-sky-200/40 bg-sky-500/10',
        label: '개인 저장 리캡',
    },
    overall: {
        gradient: 'from-fuchsia-600 via-violet-700 to-slate-950',
        frame: 'border-violet-200/40 bg-violet-500/10',
        label: '운영 저장 리캡',
    },
} as const;

export const RecapSnapshotViewer: React.FC<RecapSnapshotViewerProps> = ({
    snapshot,
    onClose,
}) => {
    const [showShareCard, setShowShareCard] = useState(false);

    const theme = recapThemes[snapshot.payload.theme];
    const mascotUrl = snapshot.payload.mascotKey === 'bandi' ? bandiMascotUrl : didiMascotUrl;

    const shareCard = useMemo(() => ({
        title: snapshot.title,
        subtitle: snapshot.subtitle,
        summary: snapshot.summary,
        badge: snapshot.badgeLabel,
        note: snapshot.note,
        mascotUrl,
        fileName: `${snapshot.title.replace(/\s+/g, '-')}-snapshot`,
        stats: snapshot.payload.stats,
    }), [mascotUrl, snapshot.badgeLabel, snapshot.note, snapshot.payload.stats, snapshot.subtitle, snapshot.summary, snapshot.title]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-xl animate-in fade-in duration-300">
            <button
                type="button"
                onClick={() => setShowShareCard(true)}
                className="absolute left-5 top-5 rounded-full border border-white/10 bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
                <Share2 size={20} />
            </button>

            <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
                <X size={22} />
            </button>

            <div className={`relative flex h-[86vh] w-full max-w-[1080px] overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br ${theme.gradient} shadow-[0_40px_120px_rgba(15,23,42,0.45)]`}>
                <img
                    src={banollimSchoolLogoUrl}
                    alt="반디스쿨 로고"
                    className="pointer-events-none absolute left-1/2 top-10 h-20 w-auto -translate-x-1/2 opacity-10 saturate-0"
                />

                <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_360px]">
                    <div className="flex flex-col justify-between p-7 pt-16 text-white lg:p-10 lg:pt-16">
                        <div className="space-y-6">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90">
                                <Sparkles size={14} />
                                {theme.label}
                            </div>

                            <div className="max-w-3xl">
                                <div className="text-sm font-semibold text-white/70">{snapshot.subtitle}</div>
                                <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-tight lg:text-5xl">
                                    {snapshot.title}
                                </h2>
                                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
                                    {snapshot.summary}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {snapshot.payload.stats.map((stat) => (
                                    <div key={stat.label} className="rounded-[28px] border border-white/15 bg-black/15 p-5 backdrop-blur-sm">
                                        <div className="text-xs uppercase tracking-[0.16em] text-white/50">{stat.label}</div>
                                        <div className="mt-3 text-3xl font-black text-white">{stat.value}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                                {snapshot.payload.highlights.map((highlight) => (
                                    <div key={highlight.label} className="rounded-[30px] border border-white/15 bg-black/15 p-6 backdrop-blur-sm">
                                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{highlight.label}</div>
                                        <div className="mt-3 text-2xl font-black text-white">{highlight.value}</div>
                                        <p className="mt-3 text-sm leading-7 text-white/72">{highlight.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`mt-8 rounded-[30px] border p-5 backdrop-blur-sm ${theme.frame}`}>
                            <div className="flex flex-col gap-3 text-sm text-white/80 lg:flex-row lg:items-center lg:justify-between">
                                <div className="flex flex-wrap items-center gap-4">
                                    <div className="inline-flex items-center gap-2">
                                        {snapshot.scope === 'member' ? <UserRound size={16} /> : <Shield size={16} />}
                                        {snapshot.scope === 'member' ? (snapshot.memberName ?? '개인 리캡') : '전체 운영 리캡'}
                                    </div>
                                    <div className="inline-flex items-center gap-2">
                                        <CalendarDays size={16} />
                                        {snapshot.periodType === 'month' ? '월간 저장본' : '시즌 저장본'}
                                    </div>
                                    <div className="inline-flex items-center gap-2">
                                        <CopyCheck size={16} />
                                        {snapshot.badgeLabel}
                                    </div>
                                </div>
                                <div className="inline-flex items-center gap-2 text-white/70">
                                    <Clock3 size={16} />
                                    {formatDateTime(snapshot.createdAt)} 생성
                                </div>
                            </div>
                            <p className="mt-4 text-sm leading-7 text-white/75">{snapshot.note}</p>
                        </div>
                    </div>

                    <div className="hidden border-l border-white/10 bg-black/15 p-6 lg:flex lg:flex-col lg:justify-between">
                        <div>
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="text-xs uppercase tracking-[0.16em] text-white/45">저장 범위</div>
                                <div className="mt-3 text-lg font-bold text-white">{snapshot.subtitle}</div>
                                <div className="mt-2 text-sm leading-7 text-white/72">
                                    생성 시점의 요약과 하이라이트를 그대로 보관하는 저장형 리캡입니다. 이후 데이터가 더 쌓여도 이 저장본의 해석은 유지됩니다.
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="text-xs uppercase tracking-[0.16em] text-white/45">한 줄 메모</div>
                                <div className="mt-3 text-sm leading-7 text-white/75">{snapshot.note}</div>
                            </div>

                            <div className="flex items-end justify-between gap-4 rounded-[28px] border border-white/10 bg-black/20 p-5">
                                <div className="space-y-2">
                                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">리캡 마스코트</div>
                                    <div className="text-lg font-semibold text-white">{snapshot.payload.mascotKey === 'bandi' ? '반디' : '디디'}</div>
                                    <div className="text-sm text-white/65">이 저장본을 대표하는 캐릭터 톤입니다.</div>
                                </div>
                                <img
                                    src={mascotUrl}
                                    alt="리캡 마스코트"
                                    className="h-28 w-auto drop-shadow-[0_26px_56px_rgba(15,23,42,0.35)]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showShareCard && (
                <ShareRecapCard
                    title={shareCard.title}
                    subtitle={shareCard.subtitle}
                    summary={shareCard.summary}
                    badge={shareCard.badge}
                    note={shareCard.note}
                    mascotUrl={shareCard.mascotUrl}
                    fileName={shareCard.fileName}
                    stats={shareCard.stats}
                    onClose={() => setShowShareCard(false)}
                />
            )}
        </div>
    );
};
