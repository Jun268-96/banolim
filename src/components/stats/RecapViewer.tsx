import React, { useEffect, useMemo, useState } from 'react';
import { Award, CalendarDays, ChevronLeft, ChevronRight, Crown, Flame, Layers3, Sparkles, Star, TrendingUp, Trophy, Users, X, Zap } from 'lucide-react';
import type { ActivityLog, Member, MemberBadge, SeasonSummary } from '../../types';

type RecapPeriod = 'month' | 'season';

interface RecapViewerProps {
    members: Member[];
    logs: ActivityLog[];
    memberBadges: MemberBadge[];
    season: SeasonSummary | null;
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

const attendancePattern = /(출석|참석|지각|불참)/;

const getScopeRange = (period: RecapPeriod, season: SeasonSummary | null) => {
    const now = new Date();

    if (period === 'month') {
        return {
            title: '이번 달 전체 리캡',
            subtitle: formatMonthLabel(now),
            start: new Date(now.getFullYear(), now.getMonth(), 1),
            end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        };
    }

    if (season) {
        return {
            title: '현재 시즌 전체 리캡',
            subtitle: season.name,
            start: new Date(`${season.startDate}T00:00:00`),
            end: season.endDate ? new Date(`${season.endDate}T23:59:59`) : new Date(),
        };
    }

    return {
        title: '현재 시즌 전체 리캡',
        subtitle: '전체 기록 기준',
        start: new Date(0),
        end: new Date(),
    };
};

export const RecapViewer: React.FC<RecapViewerProps> = ({
    members,
    logs,
    memberBadges,
    season,
    onClose,
}) => {
    const [period, setPeriod] = useState<RecapPeriod>('season');
    const [currentSlide, setCurrentSlide] = useState(0);

    const effectiveLogs = useMemo(
        () => logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed'),
        [logs],
    );

    const scope = useMemo(() => getScopeRange(period, season), [period, season]);

    const scopeLogs = useMemo(
        () =>
            effectiveLogs.filter((log) => {
                const occurredAt = new Date(log.timestamp);
                return occurredAt >= scope.start && occurredAt <= scope.end;
            }),
        [effectiveLogs, scope.end, scope.start],
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
        const uniqueMemberIds = new Set(scopeLogs.map((log) => log.memberId));
        const activityCount = scopeLogs.length;

        const memberDeltaRows = Object.entries(
            scopeLogs.reduce<Record<string, { name: string; delta: number; count: number }>>((acc, log) => {
                const current = acc[log.memberId] ?? {
                    name: members.find((member) => member.id === log.memberId)?.name ?? log.memberName ?? '알 수 없는 회원',
                    delta: 0,
                    count: 0,
                };

                acc[log.memberId] = {
                    name: current.name,
                    delta: current.delta + log.pointDelta,
                    count: current.count + 1,
                };

                return acc;
            }, {}),
        )
            .map(([memberId, value]) => ({
                memberId,
                ...value,
            }))
            .sort((a, b) => b.delta - a.delta || b.count - a.count);

        const teamRows = Object.entries(
            scopeLogs.reduce<Record<string, { name: string; delta: number; count: number }>>((acc, log) => {
                const member = members.find((entry) => entry.id === log.memberId);
                const key = member?.teamName ?? '미지정';
                const current = acc[key] ?? {
                    name: key,
                    delta: 0,
                    count: 0,
                };

                acc[key] = {
                    name: current.name,
                    delta: current.delta + log.pointDelta,
                    count: current.count + 1,
                };

                return acc;
            }, {}),
        )
            .map(([teamName, value]) => ({
                teamName,
                ...value,
            }))
            .sort((a, b) => b.delta - a.delta || b.count - a.count);

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

        const attendanceLeader = Object.entries(
            scopeLogs.reduce<Record<string, { name: string; count: number }>>((acc, log) => {
                if (!attendancePattern.test(log.categoryName ?? log.reason ?? '')) {
                    return acc;
                }

                const current = acc[log.memberId] ?? {
                    name: members.find((member) => member.id === log.memberId)?.name ?? log.memberName ?? '알 수 없는 회원',
                    count: 0,
                };

                acc[log.memberId] = {
                    name: current.name,
                    count: current.count + 1,
                };

                return acc;
            }, {}),
        )
            .map(([memberId, value]) => ({
                memberId,
                ...value,
            }))
            .sort((a, b) => b.count - a.count)[0] ?? null;

        const badgeLeader = Object.entries(
            scopeBadges.reduce<Record<string, { name: string; count: number }>>((acc, badge) => {
                const current = acc[badge.memberId] ?? {
                    name: members.find((member) => member.id === badge.memberId)?.name ?? '알 수 없는 회원',
                    count: 0,
                };

                acc[badge.memberId] = {
                    name: current.name,
                    count: current.count + 1,
                };

                return acc;
            }, {}),
        )
            .map(([memberId, value]) => ({
                memberId,
                ...value,
            }))
            .sort((a, b) => b.count - a.count)[0] ?? null;

        const bestDayEntry = Object.entries(
            scopeLogs.reduce<Record<string, { delta: number; count: number }>>((acc, log) => {
                const dayKey = new Date(log.timestamp).toISOString().slice(0, 10);
                const current = acc[dayKey] ?? { delta: 0, count: 0 };
                acc[dayKey] = {
                    delta: current.delta + log.pointDelta,
                    count: current.count + 1,
                };
                return acc;
            }, {}),
        ).sort((a, b) => b[1].delta - a[1].delta || b[1].count - a[1].count)[0] ?? null;

        return {
            totalPoints,
            activityCount,
            uniqueMemberCount: uniqueMemberIds.size,
            mvp: memberDeltaRows[0] ?? null,
            topTeam: teamRows[0] ?? null,
            topCategory,
            attendanceLeader,
            badgeLeader,
            bestDay: bestDayEntry
                ? {
                    day: bestDayEntry[0],
                    delta: bestDayEntry[1].delta,
                    count: bestDayEntry[1].count,
                }
                : null,
        };
    }, [members, scopeBadges, scopeLogs]);

    const slides = useMemo(() => {
        if (scopeLogs.length === 0) {
            return [
                {
                    id: 'empty',
                    gradient: 'from-slate-950 via-indigo-950 to-slate-900',
                    kicker: scope.subtitle,
                    title: scope.title,
                    mascotUrl: didiMascotUrl,
                    body: (
                        <div className="space-y-4">
                            <p className="max-w-xl text-lg leading-8 text-white/85">
                                아직 이 구간에 집계할 활동이 없습니다. 활동이 누적되면 팀, MVP, 배지, 대표 규칙이 이 화면에 자동으로 정리됩니다.
                            </p>
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                                <Sparkles size={16} />
                                첫 기록이 전체 리캡의 시작 장면이 됩니다.
                            </div>
                        </div>
                    ),
                },
            ];
        }

        return [
            {
                id: 'cover',
                gradient: 'from-sky-500 via-indigo-700 to-slate-950',
                kicker: scope.subtitle,
                title: scope.title,
                mascotUrl: bandiMascotUrl,
                body: (
                    <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/55">총 활동</div>
                            <div className="mt-3 text-4xl font-black text-white">{recap.activityCount}건</div>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/55">참여 회원</div>
                            <div className="mt-3 text-4xl font-black text-white">{recap.uniqueMemberCount}명</div>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                            <div className="text-xs uppercase tracking-[0.16em] text-white/55">누적 총점</div>
                            <div className="mt-3 text-4xl font-black text-white">
                                {recap.totalPoints > 0 ? '+' : ''}
                                {recap.totalPoints}점
                            </div>
                        </div>
                    </div>
                ),
            },
            {
                id: 'leaders',
                gradient: 'from-amber-400 via-orange-500 to-rose-600',
                kicker: '리더보드',
                title: recap.mvp ? `${recap.mvp.name}님이 MVP 흐름을 만들었습니다` : 'MVP 집계 중',
                mascotUrl: bandiMascotUrl,
                body: (
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[24px] border border-white/15 bg-black/15 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                <Crown size={16} />
                                MVP
                            </div>
                            <div className="mt-3 text-3xl font-black text-white">{recap.mvp?.name ?? '-'}</div>
                            <div className="mt-2 text-base text-white/80">
                                {recap.mvp ? `${recap.mvp.delta > 0 ? '+' : ''}${recap.mvp.delta}점 · ${recap.mvp.count}건` : '아직 데이터가 없습니다.'}
                            </div>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-black/15 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                <Users size={16} />
                                팀 하이라이트
                            </div>
                            <div className="mt-3 text-3xl font-black text-white">{recap.topTeam?.teamName ?? '-'}</div>
                            <div className="mt-2 text-base text-white/80">
                                {recap.topTeam ? `${recap.topTeam.delta > 0 ? '+' : ''}${recap.topTeam.delta}점 · ${recap.topTeam.count}건` : '아직 팀 집계가 없습니다.'}
                            </div>
                        </div>
                    </div>
                ),
            },
            {
                id: 'activity',
                gradient: 'from-fuchsia-600 via-violet-700 to-indigo-950',
                kicker: '활동 믹스',
                title: recap.topCategory?.name ?? '대표 규칙 집계 중',
                mascotUrl: didiMascotUrl,
                body: (
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                <Layers3 size={16} />
                                최다 규칙
                            </div>
                            <div className="mt-3 text-3xl font-black text-white">{recap.topCategory?.name ?? '-'}</div>
                            <div className="mt-2 text-base text-white/80">
                                {recap.topCategory ? `${recap.topCategory.count}건 · ${recap.topCategory.delta > 0 ? '+' : ''}${recap.topCategory.delta}점` : '아직 데이터가 부족합니다.'}
                            </div>
                        </div>
                        <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                            <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                <CalendarDays size={16} />
                                출석 하이라이트
                            </div>
                            <div className="mt-3 text-3xl font-black text-white">{recap.attendanceLeader?.name ?? '-'}</div>
                            <div className="mt-2 text-base text-white/80">
                                {recap.attendanceLeader ? `출석 계열 ${recap.attendanceLeader.count}건` : '출석 계열 기록이 아직 부족합니다.'}
                            </div>
                        </div>
                    </div>
                ),
            },
            {
                id: 'badges',
                gradient: 'from-slate-950 via-indigo-950 to-sky-900',
                kicker: '배지 보드',
                title: scopeBadges.length > 0 ? `${scopeBadges.length}개의 배지가 열렸습니다` : '이번 구간 신규 배지는 아직 없습니다',
                mascotUrl: bandiMascotUrl,
                body: (
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                    <Trophy size={16} />
                                    최다 획득자
                                </div>
                                <div className="mt-3 text-3xl font-black text-white">{recap.badgeLeader?.name ?? '-'}</div>
                                <div className="mt-2 text-base text-white/80">
                                    {recap.badgeLeader ? `${recap.badgeLeader.count}개 획득` : '아직 신규 배지가 없습니다.'}
                                </div>
                            </div>
                            <div className="grid gap-3">
                                {scopeBadges.slice(0, 3).map((badge) => (
                                    <div key={badge.id} className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-3">
                                        <div className="flex items-center gap-2 text-sm font-semibold text-white">
                                            <Star size={15} className="text-yellow-300" />
                                            {badge.badgeName}
                                        </div>
                                        <div className="mt-2 text-sm text-white/75">{badge.badgeDescription}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ),
            },
            {
                id: 'closing',
                gradient: 'from-emerald-500 via-teal-700 to-slate-950',
                kicker: '클로징',
                title: recap.bestDay ? `${formatDate(recap.bestDay.day)}가 가장 뜨거웠습니다` : '이번 구간 마감',
                mascotUrl: didiMascotUrl,
                body: (
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white/90">
                            <TrendingUp size={16} />
                            {recap.bestDay
                                ? `하루 최고 ${recap.bestDay.delta > 0 ? '+' : ''}${recap.bestDay.delta}점 · ${recap.bestDay.count}건`
                                : '다음 활동을 기다리는 중'}
                        </div>
                        <p className="max-w-2xl text-lg leading-8 text-white/85">
                            이번 리캡은 운영진이 다음 시즌 운영 방향과 보상 기준을 읽는 기준선입니다. 다음 단계로는 이 화면을 공유 카드로 줄이는 작업이 자연스럽습니다.
                        </p>
                    </div>
                ),
            },
        ];
    }, [recap, scope.subtitle, scope.title, scopeBadges, scopeLogs.length]);

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-4 py-6 backdrop-blur-xl animate-in fade-in duration-300">
            <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
                <X size={22} />
            </button>

            <div className="relative flex h-[84vh] w-full max-w-[1080px] overflow-hidden rounded-[36px] border border-white/10 bg-slate-950 shadow-[0_40px_120px_rgba(15,23,42,0.45)]">
                <div className={`relative flex-1 overflow-hidden bg-gradient-to-br ${current.gradient}`}>
                    <img
                        src={banollimSchoolLogoUrl}
                        alt="반디스쿨 로고"
                        className="pointer-events-none absolute left-10 top-8 h-16 w-auto opacity-15 saturate-0"
                    />

                    <div className="absolute left-6 right-6 top-5 z-20 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex gap-1.5">
                            {slides.map((slide, index) => (
                                <div key={slide.id} className="h-1.5 w-10 overflow-hidden rounded-full bg-white/20 sm:w-14">
                                    <div className={`h-full rounded-full bg-white transition-all duration-500 ${index <= currentSlide ? 'w-full' : 'w-0'}`} />
                                </div>
                            ))}
                        </div>

                        <div className="inline-flex rounded-2xl border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriod('month');
                                    setCurrentSlide(0);
                                }}
                                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${period === 'month' ? 'bg-white text-slate-900' : 'text-white/75 hover:text-white'}`}
                            >
                                이번 달
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriod('season');
                                    setCurrentSlide(0);
                                }}
                                className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${period === 'season' ? 'bg-white text-slate-900' : 'text-white/75 hover:text-white'}`}
                            >
                                현재 시즌
                            </button>
                        </div>
                    </div>

                    <div className="relative grid h-full gap-10 px-7 pb-8 pt-24 text-white lg:grid-cols-[minmax(0,1.15fr)_280px] lg:px-10">
                        <div className="flex min-h-0 flex-col justify-between">
                            <div className="space-y-6">
                                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                                    <Sparkles size={14} />
                                    {current.kicker}
                                </div>
                                <div className="max-w-3xl text-[2.4rem] font-black leading-[1.03] tracking-tight lg:text-[3.15rem]">
                                    {current.title}
                                </div>
                                <div className="max-w-3xl text-base leading-7 text-white/90 lg:text-lg">
                                    {current.body}
                                </div>
                            </div>

                            <div className="flex items-end justify-between gap-4">
                                <div className="rounded-[28px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/75 backdrop-blur-sm">
                                    <div className="text-xs uppercase tracking-[0.16em] text-white/45">전체 리캡 / {currentSlide + 1}</div>
                                    <div className="mt-2 flex items-center gap-2 font-semibold text-white/90">
                                        <Zap size={15} />
                                        {scope.title}
                                    </div>
                                </div>

                                <div className="hidden lg:flex items-end justify-end">
                                    <img
                                        src={current.mascotUrl}
                                        alt="리캡 마스코트"
                                        className="h-36 w-auto drop-shadow-[0_26px_56px_rgba(15,23,42,0.35)]"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-col justify-end gap-4">
                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                    <Award size={16} />
                                    운영 요약
                                </div>
                                <div className="mt-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3 text-sm text-white/75">
                                        <span>활동</span>
                                        <span className="font-semibold text-white">{recap.activityCount}건</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 text-sm text-white/75">
                                        <span>참여 회원</span>
                                        <span className="font-semibold text-white">{recap.uniqueMemberCount}명</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 text-sm text-white/75">
                                        <span>배지 획득</span>
                                        <span className="font-semibold text-white">{scopeBadges.length}개</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 backdrop-blur-sm">
                                <div className="flex items-center gap-2 text-sm font-semibold text-white/90">
                                    <Flame size={16} />
                                    한 줄 메모
                                </div>
                                <div className="mt-4 text-sm leading-7 text-white/75">
                                    {recap.topTeam
                                        ? `${recap.topTeam.teamName}이 이번 구간의 흐름을 주도했고, ${recap.mvp?.name ?? '핵심 멤버'}가 점수 기준 MVP를 기록했습니다.`
                                        : '다음 활동 구간에서 팀 흐름이 집계됩니다.'}
                                </div>
                            </div>
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
        </div>
    );
};
