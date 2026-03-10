import React, { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, CalendarDays, Clock3, MessageSquareWarning, Send, ShieldCheck, Sparkles, TriangleAlert, UserRound } from 'lucide-react';
import type { ActivityLog, CorrectionRequest, CorrectionRequestStatus, Member, MemberStatus, SeasonSummary } from '../../types';
import { getCorrectionRequests, getCurrentSeason, getMyActivityLogs, getMyMemberOverview, submitCorrectionRequest } from '../../lib/db';
import { roleLabels } from '../../lib/permissions';
import { useAuth } from '../auth/auth-context';

const memberStatusLabels: Record<MemberStatus, string> = {
    active: '활동 중',
    dormant: '휴면',
    inactive: '비활성',
};

const memberStatusClasses: Record<MemberStatus, string> = {
    active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    dormant: 'border-sky-200 bg-sky-50 text-sky-700',
    inactive: 'border-slate-200 bg-slate-100 text-slate-700',
};

const correctionRequestStatusLabels: Record<CorrectionRequestStatus, string> = {
    pending: '접수됨',
    reviewing: '검토 중',
    resolved: '해결 완료',
    rejected: '반려',
};

const correctionRequestStatusClasses: Record<CorrectionRequestStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    reviewing: 'border-sky-200 bg-sky-50 text-sky-700',
    resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    rejected: 'border-rose-200 bg-rose-50 text-rose-700',
};

const formatDate = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value))
        : '-';

const formatDateTime = (value?: string | null) =>
    value
        ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
        : '-';

export const MemberHomeTab: React.FC = () => {
    const { profile } = useAuth();
    const [season, setSeason] = useState<SeasonSummary | null>(null);
    const [member, setMember] = useState<Member | null>(null);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
    const [selectedRequestLog, setSelectedRequestLog] = useState<ActivityLog | null>(null);
    const [requestReason, setRequestReason] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadData = async () => {
            setIsLoading(true);
            const [seasonData, memberData, logData, correctionRequestData] = await Promise.all([
                getCurrentSeason(),
                getMyMemberOverview(profile?.memberId ?? null),
                getMyActivityLogs(profile?.memberId ?? null),
                getCorrectionRequests({ requesterMemberId: profile?.memberId ?? null }),
            ]);

            if (!isMounted) {
                return;
            }

            setSeason(seasonData);
            setMember(memberData);
            setLogs(logData);
            setCorrectionRequests(correctionRequestData);
            setIsLoading(false);
        };

        void loadData();

        return () => {
            isMounted = false;
        };
    }, [profile?.memberId]);

    const effectiveLogs = useMemo(
        () => logs.filter((log) => !log.isReversal && log.recordStatus !== 'reversed'),
        [logs],
    );

    const openCorrectionRequestsByRecordId = useMemo(
        () =>
            correctionRequests.reduce<Record<string, CorrectionRequest>>((acc, request) => {
                if (!request.activityRecordId || (request.status !== 'pending' && request.status !== 'reviewing')) {
                    return acc;
                }

                acc[request.activityRecordId] = request;
                return acc;
            }, {}),
        [correctionRequests],
    );

    const topCategories = useMemo(
        () =>
            Object.values(
                effectiveLogs.reduce<Record<string, { name: string; count: number; totalDelta: number }>>((acc, log) => {
                    const key = log.categoryId;
                    const current = acc[key] ?? {
                        name: log.categoryName ?? '알 수 없는 규칙',
                        count: 0,
                        totalDelta: 0,
                    };

                    acc[key] = {
                        name: current.name,
                        count: current.count + 1,
                        totalDelta: current.totalDelta + log.pointDelta,
                    };

                    return acc;
                }, {}),
            ).sort((a, b) => b.count - a.count || b.totalDelta - a.totalDelta).slice(0, 3),
        [effectiveLogs],
    );

    const latestLog = effectiveLogs[0] ?? null;
    const approvedLabel = member?.isApproved ? '승인 완료' : '승인 대기';
    const status = member?.status ?? 'active';
    const statusClass = member ? memberStatusClasses[status] : memberStatusClasses.active;

    const handleSubmitCorrectionRequest = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedRequestLog?.recordId || !requestReason.trim()) {
            return;
        }

        setIsSubmittingRequest(true);
        setRequestError(null);

        try {
            await submitCorrectionRequest(selectedRequestLog.recordId, requestReason);
            const nextRequests = await getCorrectionRequests({ requesterMemberId: profile?.memberId ?? null });
            setCorrectionRequests(nextRequests);
            setRequestReason('');
            setSelectedRequestLog(null);
        } catch (error) {
            setRequestError(error instanceof Error ? error.message : '정정 요청을 저장하지 못했습니다.');
        } finally {
            setIsSubmittingRequest(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100" />
                    <div className="font-medium text-indigo-600">내 활동 현황을 불러오는 중...</div>
                </div>
            </div>
        );
    }

    if (!member) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <section className="overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-sm">
                    <div className="border-b border-amber-100 bg-gradient-to-br from-amber-50 via-white to-orange-50 p-6">
                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white/90 px-3 py-1 text-xs font-semibold text-amber-800">
                            <TriangleAlert size={14} />
                            회원 매칭 필요
                        </div>
                        <h2 className="mt-4 text-2xl font-bold text-slate-950">내 상태를 불러올 수 없습니다.</h2>
                        <p className="mt-2 max-w-2xl text-sm text-slate-600">
                            현재 로그인 이메일과 일치하는 회원 레코드를 찾지 못했습니다. 운영진이 멤버 관리 화면에서 본인 회원 레코드에 로그인 이메일을 등록하면
                            이 화면에서 본인 점수와 활동만 확인할 수 있습니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">로그인 이메일</div>
                            <div className="mt-2 font-semibold text-slate-900">{profile?.email ?? '알 수 없음'}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">현재 권한</div>
                            <div className="mt-2 font-semibold text-slate-900">{roleLabels[profile?.appRole ?? 'member']}</div>
                        </div>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-6 lg:p-8">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.25fr)_340px]">
                    <div className="space-y-5">
                        <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/90 px-3 py-1 text-sm font-medium text-sky-700">
                            <Sparkles size={15} />
                            내 활동 현황
                        </div>

                        <div>
                            <h2 className="text-3xl font-bold tracking-tight text-slate-950 lg:text-4xl">{member.name}님의 현재 상태</h2>
                            <p className="mt-3 max-w-3xl text-base text-slate-600 lg:text-lg">
                                일반 회원 화면에서는 본인 점수와 최근 활동만 표시됩니다. 다른 회원 정보와 운영 화면은 노출하지 않습니다.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">현재 시즌</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{season?.name ?? '활성 시즌 없음'}</div>
                                <div className="mt-1 text-sm text-slate-500">{season ? `${formatDate(season.startDate)} - ${formatDate(season.endDate)}` : '운영진이 시즌을 설정하면 표시됩니다.'}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">누적 점수</div>
                                <div className="mt-2 text-xl font-bold text-indigo-600">{member.score}점</div>
                                <div className="mt-1 text-sm text-slate-500">{approvedLabel}</div>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                                <div className="text-sm text-slate-500">최근 활동</div>
                                <div className="mt-2 text-xl font-bold text-slate-900">{effectiveLogs.length}건</div>
                                <div className="mt-1 text-sm text-slate-500">{latestLog ? formatDateTime(latestLog.timestamp) : '아직 기록이 없습니다.'}</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white lg:p-6">
                        <div className="flex items-center gap-2 text-sm text-slate-300">
                            <UserRound size={16} />
                            내 프로필
                        </div>
                        <div className="space-y-3">
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">역할</div>
                                <div className="mt-2 font-semibold text-white">{member.roleName ?? roleLabels[profile?.appRole ?? 'member']}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">소속 팀</div>
                                <div className="mt-2 font-semibold text-white">{member.teamName ?? '미지정'}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-400">가입일</div>
                                <div className="mt-2 font-semibold text-white">{formatDate(member.joinedAt)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="border-b border-slate-100 px-6 py-4">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <Clock3 size={18} className="text-indigo-600" />
                            최근 내 활동
                        </div>
                        <div className="mt-1 text-sm text-slate-500">최근 저장된 활동 기록과 정정 요청 버튼을 함께 보여줍니다.</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {effectiveLogs.slice(0, 8).map((log) => (
                            <div key={log.id} className="flex flex-col gap-4 px-6 py-4">
                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <div className="font-medium text-slate-900">{log.categoryName ?? '알 수 없는 규칙'}</div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            {log.reason ?? '기록 사유 없음'}
                                            {log.note ? <span className="text-slate-300"> · {log.note}</span> : null}
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${log.pointDelta >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                                            {log.pointDelta > 0 ? '+' : ''}
                                            {log.pointDelta}점
                                        </span>
                                        <span className="text-sm text-slate-500">{formatDateTime(log.timestamp)}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="text-sm text-slate-600">
                                        {openCorrectionRequestsByRecordId[log.recordId ?? ''] ? '이미 정정 요청이 접수되어 운영진이 확인 중입니다.' : '기록이 잘못 반영되었다면 바로 정정 요청을 남길 수 있습니다.'}
                                    </div>
                                    {openCorrectionRequestsByRecordId[log.recordId ?? ''] ? (
                                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[openCorrectionRequestsByRecordId[log.recordId ?? ''].status]}`}>
                                            {correctionRequestStatusLabels[openCorrectionRequestsByRecordId[log.recordId ?? ''].status]}
                                        </span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedRequestLog(log);
                                                setRequestReason(`${log.categoryName ?? '활동'} 기록에 대한 정정 요청입니다. `);
                                                setRequestError(null);
                                            }}
                                            disabled={!log.recordId}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                                        >
                                            <MessageSquareWarning size={16} />
                                            정정 요청
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}

                        {effectiveLogs.length === 0 && (
                            <div className="px-6 py-12 text-center text-slate-500">
                                아직 본인 활동 기록이 없습니다.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <ShieldCheck size={18} className="text-indigo-600" />
                            계정 상태
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">회원 상태</span>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass}`}>
                                    {memberStatusLabels[status]}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">승인 여부</span>
                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${member.isApproved ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                                    {approvedLabel}
                                </span>
                            </div>
                            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <span className="text-sm text-slate-500">로그인 이메일</span>
                                <span className="text-sm font-medium text-slate-900">{profile?.email ?? '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <MessageSquareWarning size={18} className="text-indigo-600" />
                            정정 요청
                        </div>
                        <div className="mt-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <div className="text-sm font-medium text-slate-700">최근 요청 내역</div>
                                <div className="mt-3 space-y-3">
                                    {correctionRequests.slice(0, 4).map((request) => (
                                        <div key={request.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium text-slate-900">{request.activitySummary ?? '활동 기록'}</div>
                                                    <div className="mt-1 text-sm text-slate-500">{formatDateTime(request.createdAt)}</div>
                                                </div>
                                                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${correctionRequestStatusClasses[request.status]}`}>
                                                    {correctionRequestStatusLabels[request.status]}
                                                </span>
                                            </div>
                                            <div className="mt-3 text-sm leading-6 text-slate-600">{request.reason}</div>
                                            {request.reviewNote && (
                                                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                                                    운영진 답변: {request.reviewNote}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {correctionRequests.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                                            아직 제출한 정정 요청이 없습니다.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {selectedRequestLog && (
                                <form onSubmit={handleSubmitCorrectionRequest} className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                                        <Send size={16} className="text-indigo-600" />
                                        {selectedRequestLog.categoryName ?? '활동 기록'} 정정 요청 작성
                                    </div>
                                    <div className="mt-2 text-sm text-slate-600">
                                        {formatDateTime(selectedRequestLog.timestamp)} 기록에 대해 운영진에게 검토를 요청합니다.
                                    </div>
                                    <textarea
                                        value={requestReason}
                                        onChange={(event) => setRequestReason(event.target.value)}
                                        rows={4}
                                        placeholder="어떤 부분이 잘못되었는지 구체적으로 남겨 주세요."
                                        className="mt-4 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                    {requestError && (
                                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                                            {requestError}
                                        </div>
                                    )}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="submit"
                                            disabled={!requestReason.trim() || isSubmittingRequest}
                                            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {isSubmittingRequest ? '제출 중...' : '정정 요청 제출'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedRequestLog(null);
                                                setRequestReason('');
                                                setRequestError(null);
                                            }}
                                            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                        >
                                            닫기
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <BadgeCheck size={18} className="text-indigo-600" />
                            자주 기록된 활동
                        </div>
                        <div className="mt-5 space-y-3">
                            {topCategories.map((category) => (
                                <div key={category.name} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div>
                                        <div className="font-medium text-slate-900">{category.name}</div>
                                        <div className="mt-1 text-sm text-slate-500">{category.count}회 기록</div>
                                    </div>
                                    <div className={`text-sm font-bold ${category.totalDelta >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
                                        {category.totalDelta > 0 ? '+' : ''}
                                        {category.totalDelta}점
                                    </div>
                                </div>
                            ))}

                            {topCategories.length === 0 && (
                                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                                    아직 누적된 활동 유형이 없습니다.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-900 shadow-sm">
                        <div className="flex items-center gap-2 font-semibold">
                            <CalendarDays size={16} />
                            안내
                        </div>
                        <div className="mt-2 leading-6">
                            기록이 잘못 반영되었다면 최근 활동 카드에서 정정 요청을 바로 제출할 수 있습니다.
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};
