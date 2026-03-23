import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, CopyCheck, Shield, Share2, Sparkles, UserRound, X, Zap } from 'lucide-react';
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
        gradients: [
            'from-sky-500 via-indigo-600 to-slate-950',
            'from-indigo-600 via-sky-700 to-slate-950',
            'from-slate-950 via-indigo-950 to-sky-900',
        ],
        frame: 'border-sky-200/40 bg-sky-500/10',
        label: '개인 저장 리캡',
    },
    overall: {
        gradients: [
            'from-fuchsia-600 via-violet-700 to-slate-950',
            'from-violet-700 via-purple-700 to-slate-950',
            'from-slate-950 via-violet-950 to-fuchsia-900',
        ],
        frame: 'border-violet-200/40 bg-violet-500/10',
        label: '운영 저장 리캡',
    },
} as const;

export const RecapSnapshotViewer: React.FC<RecapSnapshotViewerProps> = ({
    snapshot,
    onClose,
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showShareCard, setShowShareCard] = useState(false);

    const theme = recapThemes[snapshot.payload.theme];
    const mascotUrl = snapshot.payload.mascotKey === 'bandi' ? bandiMascotUrl : didiMascotUrl;

    const slides = useMemo(() => [
        {
            id: 'cover',
            kicker: theme.label,
            body: (
                <div className="space-y-6">
                    <div className="max-w-3xl">
                        <div className="text-sm font-semibold text-white/70">{snapshot.subtitle}</div>
                        <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-tight lg:text-5xl">
                            {snapshot.title}
                        </h2>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
                            {snapshot.summary}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {snapshot.payload.stats.map((stat) => (
                            <div key={stat.label} className="rounded-[28px] border border-white/15 bg-black/15 p-5 backdrop-blur-sm">
                                <div className="text-xs uppercase tracking-[0.16em] text-white/50">{stat.label}</div>
                                <div className="mt-3 text-3xl font-black text-white">{stat.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: 'highlights',
            kicker: '하이라이트',
            body: (
                <div className="space-y-6">
                    <div className="max-w-3xl">
                        <div className="text-sm font-semibold text-white/70">{snapshot.subtitle}</div>
                        <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-tight lg:text-5xl">
                            이번 구간의 핵심 장면
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {snapshot.payload.highlights.map((highlight) => (
                            <div key={highlight.label} className="rounded-[30px] border border-white/15 bg-black/15 p-6 backdrop-blur-sm">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">{highlight.label}</div>
                                <div className="mt-3 text-2xl font-black text-white">{highlight.value}</div>
                                <p className="mt-3 text-sm leading-7 text-white/72">{highlight.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ),
        },
        {
            id: 'closing',
            kicker: '클로징',
            body: (
                <div className="space-y-6">
                    <div className="max-w-3xl">
                        <div className="text-sm font-semibold text-white/70">{snapshot.subtitle}</div>
                        <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-tight lg:text-5xl">
                            저장본 요약
                        </h2>
                        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/82">
                            {snapshot.note}
                        </p>
                    </div>

                    <div className={`rounded-[30px] border p-5 backdrop-blur-sm ${theme.frame}`}>
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
                    </div>
                </div>
            ),
        },
    ], [snapshot, theme.frame, theme.label]);

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

    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    const current = slides[currentSlide];
    const gradient = theme.gradients[currentSlide] ?? theme.gradients[0];

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

            <div className={`relative flex h-[86vh] w-full max-w-[1080px] overflow-hidden rounded-[40px] border border-white/10 bg-gradient-to-br ${gradient} shadow-[0_40px_120px_rgba(15,23,42,0.45)] transition-all duration-500`}>
                <img
                    src={banollimSchoolLogoUrl}
                    alt="반디스쿨 로고"
                    className="pointer-events-none absolute left-1/2 top-10 h-20 w-auto -translate-x-1/2 opacity-10 saturate-0"
                />

                {/* Progress bar + kicker */}
                <div className="absolute left-6 right-6 top-5 z-20 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex gap-1.5">
                        {slides.map((slide, index) => (
                            <div key={slide.id} className="h-1.5 w-10 overflow-hidden rounded-full bg-white/20 sm:w-14">
                                <div className={`h-full rounded-full bg-white transition-all duration-500 ${index <= currentSlide ? 'w-full' : 'w-0'}`} />
                            </div>
                        ))}
                    </div>

                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/90 backdrop-blur-sm">
                        <Sparkles size={14} />
                        {current.kicker}
                    </div>
                </div>

                {/* Main content */}
                <div className="flex w-full flex-col justify-between p-7 pt-20 text-white lg:p-10 lg:pt-20">
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {current.body}
                    </div>

                    {/* Bottom bar */}
                    <div className="mt-6 flex items-center justify-between gap-4">
                        <div className="rounded-[28px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 backdrop-blur-sm">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/45">저장 리캡 / {currentSlide + 1}</div>
                            <div className="mt-2 flex items-center gap-2 font-semibold text-white/90">
                                <Zap size={15} />
                                {snapshot.subtitle}
                            </div>
                        </div>

                        <img
                            src={mascotUrl}
                            alt="리캡 마스코트"
                            className="hidden h-28 w-auto drop-shadow-[0_26px_56px_rgba(15,23,42,0.35)] lg:block"
                        />
                    </div>
                </div>

                {/* Nav arrows */}
                <button
                    type="button"
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/20 p-3 text-white/70 transition-colors hover:bg-black/30 hover:text-white"
                >
                    <ChevronLeft size={22} />
                </button>
                <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 z-20 -translate-y-1/2 rounded-full border border-white/10 bg-black/20 p-3 text-white/70 transition-colors hover:bg-black/30 hover:text-white"
                >
                    <ChevronRight size={22} />
                </button>
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
