import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, Mail, Medal, ShieldCheck, Sparkles, TrendingUp, Users, Zap } from 'lucide-react';
import type { ActivityLog, AnnouncementItem, Category, Member, ScheduleEventItem, SeasonSummary } from '../../types';
import { getAnnouncements, getCategories, getCurrentSeason, getLogs, getMembers, getScheduleEvents } from '../../lib/db';
import { useAuth } from '../auth/auth-context';
import type { TabType } from '../layout/Sidebar';
import { NoticeScheduleBoard } from '../shared/NoticeScheduleBoard';

interface HomeTabProps {
    onNavigate: (tab: TabType) => void;
}

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

const getApprovalTags = (member: Member) => {
    const tags: string[] = [];

    if (!member.loginEmail) tags.push('이메일 미등록');
    if (!member.isApproved) tags.push('승인 대기');
    if (member.status === 'dormant') tags.push('보류');
    if (member.status === 'inactive') tags.push('비활성');

    return tags;
};

const isAccessReady = (member: Member) => Boolean(member.loginEmail) && member.isApproved && member.status === 'active';

export const HomeTab: React.FC<HomeTabProps> = ({ onNavigate }) => {
    const { permissions } = useAuth();
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
    const [scheduleEvents, setScheduleEvents] = useState<ScheduleEventItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            const [seasonData, memberData, categoryData, logData, announcementData, scheduleData] = await Promise.all([
                getCurrentSeason(),
                getMembers(),
                getCategories(),
                getLogs(),
                getAnnouncements(),
                getScheduleEvents(),
            ]);
            setSeason(seasonData);
            setMembers(memberData);
            setCategories(categoryData);
            setLogs(logData);
            setAnnouncements(announcementData);
            setScheduleEvents(scheduleData);
            setIsLoading(false);
        };

        void loadData();
    }, []);

    const insights = useMemo(() => {
        const topMember = [...members].sort((a, b) => b.score - a.score)[0] ?? null;
        const recentLogs = logs.slice(0, 6);
        const effectiveLogs = logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed');

        const attendanceRuleIds = new Set(
            categories
                .filter((category) => /attendance|meeting|check-in|presence|출석|정기모임|참석/i.test(category.categoryName))
                .map((category) => category.id),
        );

        const attendanceCounts = effectiveLogs.reduce<Record<string, number>>((acc, log) => {
            if (!attendanceRuleIds.has(log.categoryId)) {
                return acc;
            }

            acc[log.memberId] = (acc[log.memberId] ?? 0) + 1;
            return acc;
        }, {});

        const mostConsistent = members
            .map((member) => ({
                member,
                count: attendanceCounts[member.id] ?? 0,
            }))
            .sort((a, b) => b.count - a.count)[0] ?? null;

        const hottestRule = categories
            .map((category) => ({
                category,
                count: effectiveLogs.filter((log) => log.categoryId === category.id).length,
            }))
                .sort((a, b) => b.count - a.count)[0] ?? null;

        const teamSummary = Object.entries(
            members.reduce<Record<string, { score: number; count: number }>>((acc, member) => {
                const key = member.teamName || '미지정';
                const current = acc[key] ?? { score: 0, count: 0 };
                acc[key] = { score: current.score + member.score, count: current.count + 1 };
                return acc;
            }, {}),
        )
            .map(([team, summary]) => ({ team, ...summary }))
            .sort((a, b) => b.score - a.score);

        const approvalQueue = members
            .filter((member) => !isAccessReady(member))
            .map((member) => ({
                member,
                tags: getApprovalTags(member),
            }))
            .slice(0, 4);

        return {
            topMember,
            recentLogs,
            mostConsistent,
            hottestRule,
            teamSummary,
            approvalQueue,
            blockedAccessCount: members.filter((member) => !isAccessReady(member)).length,
            effectiveLogsCount: effectiveLogs.length,
        };
    }, [categories, logs, members]);

    const quickActions = [
        permissions.canViewActivities
            ? {
                  id: 'activities' as const,
                  label: '정기모임 출석 입력',
                  description: '참석, 지각, 불참 상태를 한 번에 입력합니다.',
                  icon: Zap,
              }
            : null,
        permissions.canManagePoints
            ? {
                  id: 'points' as const,
                  label: '일괄 점수 반영',
                  description: '같은 규칙을 여러 회원에게 한 번에 반영합니다.',
                  icon: Users,
              }
            : null,
        permissions.canManageMembers
            ? {
                  id: 'dashboard' as const,
                  label: '승인 대기 검토',
                  description: '로그인 이메일과 승인 상태를 빠르게 처리합니다.',
                  icon: ShieldCheck,
              }
            : null,
        {
            id: 'stats' as const,
            label: '통계 보기',
            description: '팀 흐름, 규칙 사용량, 현재 상위권을 확인합니다.',
            icon: TrendingUp,
        },
    ].filter(Boolean);

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100"></div>
                    <div className="font-medium text-indigo-600">홈 대시보드를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 lg:p-8">
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
                    <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-sm font-medium text-sky-700">
                            <Sparkles size={15} />
                            반올림 운영 허브
                        </div>

                        <div className="space-y-3">
                            <h2 className="text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">
                                한 화면에서 시즌 운영 흐름을 이어가세요.
                            </h2>
                            <p className="max-w-3xl text-base text-slate-600 lg:text-lg">
                                현재 시즌 현황을 보고, 바로 다음 작업으로 이동하고, 회원 활동을 한곳에서 관리할 수 있습니다.
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {permissions.canViewActivities && (
                                <button
                                    type="button"
                                    onClick={() => onNavigate('activities')}
                                    className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
                                >
                                    정기모임 출석 입력
                                    <ArrowRight size={16} />
                                </button>
                            )}
                            {permissions.canManagePoints && (
                                <button
                                    type="button"
                                    onClick={() => onNavigate('points')}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                                >
                                    일괄 점수 열기
                                </button>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">현재 시즌</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{season?.name ?? '활성 시즌 없음'}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    {season ? `${formatDate(season.startDate)} - ${formatDate(season.endDate)}` : '추적을 시작하려면 시즌을 추가하세요.'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">표시 중인 멤버</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{members.length}</div>
                                <div className="mt-1 text-sm text-slate-500">
                                    활동 중 {members.filter((member) => member.status === 'active').length}명
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">활동 기록</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{insights.effectiveLogsCount}</div>
                                <div className="mt-1 text-sm text-slate-500">사용 가능한 규칙 {categories.length}개</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white lg:p-6">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <CalendarDays size={16} />
                            시즌 요약
                        </div>
                        <div>
                            <div className="text-sm text-slate-400">선두 멤버</div>
                            <div className="mt-1 text-2xl font-bold">{insights.topMember?.name ?? '데이터 없음'}</div>
                            <div className="mt-1 text-sky-300">{insights.topMember ? `${insights.topMember.score}점` : '-'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-wide text-slate-400">상위 팀</div>
                                <div className="mt-2 font-semibold text-white">{insights.teamSummary[0]?.team ?? '대기 중'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-wide text-slate-400">가장 많이 쓴 규칙</div>
                                <div className="mt-2 font-semibold text-white">{insights.hottestRule?.category.categoryName ?? '대기 중'}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <NoticeScheduleBoard
                announcements={announcements}
                scheduleEvents={scheduleEvents}
                manageLabel={permissions.canManageSettings ? '설정에서 관리' : undefined}
                onManage={permissions.canManageSettings ? () => onNavigate('settings') : undefined}
            />

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="space-y-6">
                    <div className={`grid gap-4 ${quickActions.length >= 4 ? 'md:grid-cols-2 xl:grid-cols-4' : quickActions.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                        {quickActions.map((action) => {
                            if (!action) {
                                return null;
                            }

                            const Icon = action.icon;

                            return (
                                <button
                                    key={action.id}
                                    type="button"
                                    onClick={() => onNavigate(action.id)}
                                    className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md"
                                >
                                    <Icon size={18} className="text-indigo-600" />
                                    <div className="mt-4 font-semibold text-slate-900">{action.label}</div>
                                    <div className="mt-1 text-sm text-slate-500">{action.description}</div>
                                </button>
                            );
                        })}
                    </div>

                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                                <div>
                                    <div className="font-semibold text-slate-900">최근 활동 피드</div>
                                    <div className="mt-1 text-sm text-slate-500">플랫폼에 기록된 최신 활동 내역입니다.</div>
                                </div>
                                {permissions.canViewActivities && (
                                    <button
                                        type="button"
                                        onClick={() => onNavigate('activities')}
                                        className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                    >
                                        활동 보기
                                    </button>
                                )}
                            </div>
                        <div className="divide-y divide-slate-100">
                            {insights.recentLogs.map((log) => (
                                <div key={log.id} className="flex flex-col gap-2 px-6 py-4 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="font-medium text-slate-900">
                                            {log.memberName ?? log.memberId}
                                            <span className="font-normal text-slate-400"> · </span>
                                            {log.categoryName ?? log.categoryId}
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{log.note || log.reason || '메모 없음'}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`font-semibold ${log.pointDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            {log.pointDelta > 0 ? '+' : ''}
                                            {log.pointDelta}점
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">{formatDateTime(log.timestamp)}</div>
                                    </div>
                                </div>
                            ))}
                            {insights.recentLogs.length === 0 && (
                                <div className="px-6 py-12 text-center text-slate-500">아직 활동 기록이 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {permissions.canManageMembers && (
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 font-semibold text-slate-900">
                                    <ShieldCheck size={18} className="text-indigo-600" />
                                    승인 대기
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onNavigate('dashboard')}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                >
                                    멤버 화면으로 이동
                                </button>
                            </div>
                            <div className="mt-2 text-sm text-slate-500">
                                로그인 이메일 누락, 승인 대기, 보류 상태를 홈에서도 바로 확인할 수 있습니다.
                            </div>

                            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                                    <Clock3 size={16} />
                                    처리 대상 {insights.blockedAccessCount}명
                                </div>
                                <div className="mt-2 text-sm text-amber-700">
                                    승인과 이메일 등록이 끝나야 실제 로그인 후 앱에 접근할 수 있습니다.
                                </div>
                            </div>

                            <div className="mt-5 space-y-3">
                                {insights.approvalQueue.map(({ member, tags }) => (
                                    <div key={member.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <div className="font-semibold text-slate-900">{member.name}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {member.loginEmail ?? '로그인 이메일이 아직 없습니다.'}
                                                </div>
                                            </div>
                                            {!member.loginEmail && <Mail size={16} className="mt-1 text-sky-600" />}
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <span
                                                    key={`${member.id}-${tag}`}
                                                    className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                                {insights.approvalQueue.length === 0 && (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm font-medium text-emerald-700">
                                        현재 승인 대기 멤버가 없습니다.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <Medal size={18} className="text-indigo-600" />
                            하이라이트
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">최고 점수</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">{insights.topMember?.name ?? '대기 중'}</div>
                                <div className="mt-1 text-sm text-indigo-600">
                                    {insights.topMember ? `이번 시즌 ${insights.topMember.score}점` : '점수 데이터가 없습니다'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">가장 꾸준한 출석</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">{insights.mostConsistent?.member.name ?? '대기 중'}</div>
                                <div className="mt-1 text-sm text-emerald-700">
                                    {insights.mostConsistent ? `출석 기록 ${insights.mostConsistent.count}건` : '출석 규칙이 감지되지 않았습니다'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="text-sm text-slate-500">가장 활발한 팀</div>
                                <div className="mt-2 text-lg font-semibold text-slate-900">{insights.teamSummary[0]?.team ?? '대기 중'}</div>
                                <div className="mt-1 text-sm text-sky-700">
                                    {insights.teamSummary[0] ? `총 ${insights.teamSummary[0].score}점` : '팀 데이터가 없습니다'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="font-semibold text-slate-900">상위 팀</div>
                        <div className="mt-1 text-sm text-slate-500">전체 통계 페이지를 열기 전에 빠르게 확인할 수 있습니다.</div>
                        <div className="mt-5 space-y-3">
                            {insights.teamSummary.slice(0, 4).map((team, index) => (
                                <div key={team.team} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                    <div>
                                        <div className="text-sm text-slate-500">#{index + 1}</div>
                                        <div className="font-medium text-slate-900">{team.team}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-semibold text-indigo-600">{team.score}점</div>
                                        <div className="text-sm text-slate-500">{team.count}명</div>
                                    </div>
                                </div>
                            ))}
                            {insights.teamSummary.length === 0 && (
                                <div className="text-sm text-slate-500">아직 팀 요약 데이터가 없습니다.</div>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
