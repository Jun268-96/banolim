import React, { useEffect, useMemo, useState } from 'react';
import { Award, CalendarDays, ChevronLeft, ChevronRight, Flame, Link2, Share2, Sparkles, Star, TrendingUp, X } from 'lucide-react';
import type { ActivityLog, Member, MemberBadge, SeasonSummary } from '../../types';
import { ShareRecapCard } from '../recap/ShareRecapCard';

type RecapPeriod = 'month' | 'season';

interface MemberRecapViewerProps {
    member: Member;
    season: SeasonSummary | null;
    logs: ActivityLog[];
    memberBadges: MemberBadge[];
    period: RecapPeriod;
    onClose: () => void;
}

const bandiMascotUrl = new URL('../../../반디.png', import.meta.url).href;
const didiMascotUrl = new URL('../../../디디.png', import.meta.url).href;
const banollimSchoolLogoUrl = new URL('../../../반디스쿨 로고1.png', import.meta.url).href;

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

const formatMonthLabel = (value: Date) =>
    new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long' }).format(value);

const toDayKey = (value: string) => new Date(value).toISOString().slice(0, 10);

const getScopeRange = (period: RecapPeriod, season: SeasonSummary | null) => {
    const now = new Date();
    if (period === 'month') {
        return {
            title: '이번 달 리캡',
            subtitle: formatMonthLabel(now),
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        };
    }

    if (season) {
        return {
            title: '현재 시즌 리캡',
            subtitle: season.name,
            start: new Date(`${season.startDate}T00:00:00`),
            end: season.endDate ? new Date(`${season.endDate}T23:59:59`) : new Date(now.getFullYear() + 1, 0, 1),
        };
    }

    return {
        title: '현재 시즌 리캡',
        subtitle: '전체 활동 기준',
        start: new Date(0),
        end: now,
    };
};

export const MemberRecapViewer: React.FC<MemberRecapViewerProps> = ({
    member,
    season,
    logs,
    memberBadges,
    period,
    onClose,
}) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [showShareCard, setShowShareCard] = useState(false);

    const scope = useMemo(() => getScopeRange(period, season), [period, season]);

    const scopeLogs = useMemo(
        () =>
            logs.filter((log) => {
                const occurredAt = new Date(log.timestamp);
                return occurredAt >= scope.start && occurredAt <= scope.end;
            }),
        [logs, scope.end, scope.start],
    );

    const scopeBadges = useMemo(
        () =>
            memberBadges.filter((badge) => {
                const awardedAt = new Date(badge.awardedAt);
                return awardedAt >= scope.start && awardedAt <= scope.end;
            }),
        [memberBadges, scope.end, scope.start],
    );

    const recap = useMemo(() => {
        const totalPoints = scopeLogs.reduce((sum, log) => sum + log.pointDelta, 0);
        const evidenceCount = scopeLogs.filter((log) => Boolean(log.evidenceUrl)).length;
        const activeDays = new Set(scopeLogs.map((log) => toDayKey(log.timestamp))).size;
        const topCategory = Object.values(
            scopeLogs.reduce<Record<string, { name: string; count: number; delta: number }>>((acc, log) => {
                const key = log.categoryId;
                const current = acc[key] ?? {
                    name: log.categoryName ?? '알 수 없는 규칙',
                    count: 0,
                    delta: 0,
                };

                acc[key] = {
                    name: current.name,
                    count: current.count + 1,
                    delta: current.delta + log.pointDelta,
                };

                return acc;
            }, {}),
        ).sort((a, b) => b.count - a.count || b.delta - a.delta)[0] ?? null;

        const highlightLog = [...scopeLogs]
            .sort((a, b) => b.pointDelta - a.pointDelta || a.timestamp.localeCompare(b.timestamp))[0] ?? null;

        const dayTotals = Object.entries(
            scopeLogs.reduce<Record<string, number>>((acc, log) => {
                const key = toDayKey(log.timestamp);
                acc[key] = (acc[key] ?? 0) + log.pointDelta;
                return acc;
            }, {}),
        ).sort((a, b) => b[1] - a[1])[0];

        const bestDay = dayTotals ? {
            day: dayTotals[0],
            delta: dayTotals[1],
        } : null;

        const positiveLogs = scopeLogs.filter((log) => log.pointDelta > 0).length;
        const contributionRate = scopeLogs.length > 0 ? Math.round((positiveLogs / scopeLogs.length) * 100) : 0;

        return {
            totalPoints,
            evidenceCount,
            activeDays,
            topCategory,
            highlightLog,
            bestDay,
            contributionRate,
        };
    }, [scopeLogs]);

    const slides = useMemo(() => {
        const emptySlides = [
            {
                id: 'empty',
                gradient: 'from-slate-900 via-indigo-950 to-slate-950',
                kicker: scope.subtitle,
                title: `${member.name}님의 ${scope.title}`,
                mascotUrl: didiMascotUrl,
                body: (
                    <div className="space-y-4">
                        <p className="text-lg leading-8 text-white/85">
                            아직 이 기간에 집계할 활동이 없습니다. 첫 기록이 쌓이면 반디와 디디가 자동으로 하이라이트를 정리해 줍니다.
                        </p>
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                            <Sparkles size={16} />
                            다음 활동이 이 리캡의 첫 장면이 됩니다.
                        </div>
                    </div>
                ),
            },
        ];

        if (scopeLogs.length === 0) {
            return emptySlides;
        }

        return [
            {
                id: 'cover',
                gradient: 'from-sky-500 via-indigo-600 to-slate-950',
                kicker: scope.subtitle,
                title: `${member.name}님의 ${scope.title}`,
                mascotUrl: bandiMascotUrl,
                body: (
                    <div className="space-y-5">
                        <p className="text-lg leading-8 text-white/85">
                            이 기간 동안 기록된 활동 흐름과 대표 장면을 반디스쿨 방식으로 한 번에 요약했습니다.
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-white/55">총점</div>
                                <div className="mt-3 text-3xl font-black text-white">
                                    {recap.totalPoints > 0 ? '+' : ''}
                                    {recap.totalPoints}점
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-white/55">활동 수</div>
                                <div className="mt-3 text-3xl font-black text-white">{scopeLogs.length}건</div>
                            </div>
                        </div>
                    </div>
                ),
            },
            {
                id: 'momentum',
                gradient: 'from-amber-300 via-orange-500 to-rose-600',
                kicker: '활동 온도',
                title: `${recap.activeDays}일 동안 흐름을 만들었습니다`,
                mascotUrl: didiMascotUrl,
                body: (
                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-3 text-left">
                            <div className="rounded-2xl border border-white/20 bg-black/15 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                    <CalendarDays size={16} />
                                    활동 일수
                                </div>
                                <div className="mt-3 text-3xl font-black text-white">{recap.activeDays}일</div>
                            </div>
                            <div className="rounded-2xl border border-white/20 bg-black/15 p-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                    <Link2 size={16} />
                                    증빙 기록
                                </div>
                                <div className="mt-3 text-3xl font-black text-white">{recap.evidenceCount}건</div>
                            </div>
                        </div>
                        <p className="text-lg leading-8 text-white/85">
                            전체 기록의 {recap.contributionRate}%가 플러스 점수 활동이었고, 기록의 밀도가 꾸준히 유지됐습니다.
                        </p>
                    </div>
                ),
            },
            {
                id: 'category',
                gradient: 'from-fuchsia-600 via-violet-700 to-indigo-950',
                kicker: '대표 활동',
                title: recap.topCategory?.name ?? '대표 규칙 집계 중',
                mascotUrl: bandiMascotUrl,
                body: (
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                            <Award size={16} />
                            {recap.topCategory ? `${recap.topCategory.count}회 · 총 ${recap.topCategory.delta > 0 ? '+' : ''}${recap.topCategory.delta}점` : '아직 데이터가 부족합니다.'}
                        </div>
                        <p className="text-lg leading-8 text-white/85">
                            이번 구간에서 가장 자주 등장한 활동입니다. 한 가지 역할에 머물지 않고 여러 기여 흐름의 중심이 된 패턴도 여기서 읽힙니다.
                        </p>
                    </div>
                ),
            },
            {
                id: 'highlight',
                gradient: 'from-emerald-500 via-teal-700 to-slate-950',
                kicker: '하이라이트 장면',
                title: recap.highlightLog?.categoryName ?? '대표 장면 준비 중',
                mascotUrl: bandiMascotUrl,
                body: (
                    <div className="space-y-4">
                        {recap.highlightLog && (
                            <div className="rounded-[24px] border border-white/15 bg-black/15 p-5 text-left">
                                <div className="text-sm font-semibold text-emerald-100">
                                    {formatDate(recap.highlightLog.timestamp)}
                                </div>
                                <div className="mt-3 text-4xl font-black text-white">
                                    {recap.highlightLog.pointDelta > 0 ? '+' : ''}
                                    {recap.highlightLog.pointDelta}점
                                </div>
                                <div className="mt-3 text-base leading-7 text-white/85">
                                    {recap.highlightLog.reason ?? recap.highlightLog.note ?? '대표 활동 장면'}
                                </div>
                            </div>
                        )}
                        <p className="text-lg leading-8 text-white/80">
                            가장 임팩트가 큰 기록을 중심으로 이번 기간의 분위기를 압축했습니다.
                        </p>
                    </div>
                ),
            },
            {
                id: 'badges',
                gradient: 'from-slate-950 via-indigo-950 to-sky-900',
                kicker: '배지 컬렉션',
                title: scopeBadges.length > 0 ? `${scopeBadges.length}개의 배지가 열렸습니다` : '이번 구간 새 배지는 없었습니다',
                mascotUrl: scopeBadges.length > 0 ? bandiMascotUrl : didiMascotUrl,
                body: (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-3 text-left">
                            {scopeBadges.slice(0, 3).map((badge) => (
                                <div key={badge.id} className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                        <Star size={15} className="text-yellow-300" />
                                        {badge.badgeName}
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-white/75">{badge.badgeDescription}</div>
                                </div>
                            ))}
                        </div>
                        {scopeBadges.length === 0 && (
                            <p className="text-lg leading-8 text-white/80">
                                다음 리캡에서는 배지가 열릴 수 있도록 발표, 증빙 기록, 다양한 활동 참여를 더 쌓아 보세요.
                            </p>
                        )}
                    </div>
                ),
            },
            {
                id: 'closing',
                gradient: 'from-rose-500 via-amber-400 to-lime-400',
                kicker: '클로징 노트',
                title: recap.bestDay ? `${formatDate(recap.bestDay.day)}가 가장 뜨거웠습니다` : '다음 하이라이트를 준비 중입니다',
                mascotUrl: didiMascotUrl,
                body: (
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900">
                            <TrendingUp size={16} />
                            {recap.bestDay
                                ? `하루 최고 합계 ${recap.bestDay.delta > 0 ? '+' : ''}${recap.bestDay.delta}점`
                                : '다음 활동을 기다리는 중'}
                        </div>
                        <p className="text-lg leading-8 text-slate-900/90">
                            이번 구간의 기록은 여기까지입니다. 다음 리캡에서는 더 많은 배지와 더 선명한 성장 궤적을 보여드릴게요.
                        </p>
                    </div>
                ),
            },
        ];
    }, [member.name, recap, scope.subtitle, scope.title, scopeBadges, scopeLogs.length]);

    const shareCard = useMemo(() => ({
        title: `${member.name}님의 ${scope.title}`,
        subtitle: scope.subtitle,
        summary: recap.topCategory
            ? `${recap.topCategory.name} 활동이 가장 자주 등장했고, 이번 구간 총 ${scopeLogs.length}건의 기록이 쌓였습니다.`
            : `${member.name}님의 현재 리캡을 한 장 카드로 정리했습니다.`,
        badge: period === 'month' ? '월간 성장 카드' : '시즌 성장 카드',
        note: recap.bestDay
            ? `${formatDate(recap.bestDay.day)}에 하루 최고 ${recap.bestDay.delta > 0 ? '+' : ''}${recap.bestDay.delta}점을 기록했습니다.`
            : '다음 활동이 쌓이면 더 선명한 하이라이트가 카드에 반영됩니다.',
        mascotUrl: scopeBadges.length > 0 ? bandiMascotUrl : didiMascotUrl,
        fileName: `${member.name}-${period === 'month' ? 'monthly' : 'season'}-recap`,
        stats: [
            { label: '총점', value: `${recap.totalPoints > 0 ? '+' : ''}${recap.totalPoints}점` },
            { label: '활동 수', value: `${scopeLogs.length}건` },
            { label: '활동 일수', value: `${recap.activeDays}일` },
            { label: '신규 배지', value: `${scopeBadges.length}개` },
        ],
    }), [member.name, period, recap.activeDays, recap.bestDay, recap.topCategory, recap.totalPoints, scope.subtitle, scope.title, scopeBadges.length, scopeLogs.length]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length);
        }, 5500);

        return () => window.clearInterval(timer);
    }, [slides.length]);

    const current = slides[currentSlide];
    const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-4 py-6 backdrop-blur-xl animate-in fade-in duration-300">
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

            <div className="relative flex h-[84vh] w-full max-w-[440px] overflow-hidden rounded-[36px] border border-white/10 bg-slate-950 shadow-[0_40px_120px_rgba(15,23,42,0.45)]">
                <div className={`relative flex-1 overflow-hidden bg-gradient-to-br ${current.gradient}`}>
                    <img
                        src={banollimSchoolLogoUrl}
                        alt="반디스쿨 로고"
                        className="pointer-events-none absolute left-1/2 top-8 h-16 w-auto -translate-x-1/2 opacity-15 saturate-0"
                    />

                    <div className="absolute left-5 right-5 top-5 z-20 flex gap-1.5">
                        {slides.map((slide, index) => (
                            <div key={slide.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/20">
                                <div
                                    className={`h-full rounded-full bg-white transition-all duration-500 ${index <= currentSlide ? 'w-full' : 'w-0'}`}
                                />
                            </div>
                        ))}
                    </div>

                    <div className="relative flex h-full flex-col justify-between p-7 pt-16 text-white">
                        <div className="space-y-5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                                <Sparkles size={14} />
                                {current.kicker}
                            </div>
                            <div className="max-w-[280px] text-[2rem] font-black leading-[1.06] tracking-tight">
                                {current.title}
                            </div>
                            <div className="max-w-[310px] text-base leading-7">
                                {current.body}
                            </div>
                        </div>

                        <div className="flex items-end justify-between gap-4">
                            <div className="rounded-[28px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 backdrop-blur-sm">
                                <div className="text-xs uppercase tracking-[0.16em] text-white/45">개인 리캡 / {currentSlide + 1}</div>
                                <div className="mt-2 flex items-center gap-2 font-semibold text-white/90">
                                    {period === 'month' ? <CalendarDays size={15} /> : <Flame size={15} />}
                                    {scope.title}
                                </div>
                            </div>

                            <img
                                src={current.mascotUrl}
                                alt="리캡 마스코트"
                                className="h-28 w-auto drop-shadow-[0_22px_48px_rgba(15,23,42,0.35)]"
                            />
                        </div>
                    </div>

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
