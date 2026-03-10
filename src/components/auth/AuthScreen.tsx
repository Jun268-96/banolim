import React, { useEffect, useState } from 'react';
import { Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './auth-context';

const MAGIC_LINK_COOLDOWN_KEY = 'banollim.magic-link.cooldown-until';
const MAGIC_LINK_COOLDOWN_SECONDS = 60;

const getRemainingCooldownSeconds = () => {
    if (typeof window === 'undefined') {
        return 0;
    }

    const storedValue = window.localStorage.getItem(MAGIC_LINK_COOLDOWN_KEY);
    if (!storedValue) {
        return 0;
    }

    const cooldownUntil = Number(storedValue);
    if (!Number.isFinite(cooldownUntil)) {
        window.localStorage.removeItem(MAGIC_LINK_COOLDOWN_KEY);
        return 0;
    }

    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (remaining <= 0) {
        window.localStorage.removeItem(MAGIC_LINK_COOLDOWN_KEY);
        return 0;
    }

    return remaining;
};

const startCooldown = () => {
    if (typeof window === 'undefined') {
        return MAGIC_LINK_COOLDOWN_SECONDS;
    }

    const cooldownUntil = Date.now() + MAGIC_LINK_COOLDOWN_SECONDS * 1000;
    window.localStorage.setItem(MAGIC_LINK_COOLDOWN_KEY, String(cooldownUntil));
    return MAGIC_LINK_COOLDOWN_SECONDS;
};

export const AuthScreen: React.FC = () => {
    const { authError, refreshProfile, session, signInWithMagicLink, signOut } = useAuth();
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(() => getRemainingCooldownSeconds());
    const hasPendingSession = Boolean(session?.user);
    const isCooldownActive = cooldownSeconds > 0;

    useEffect(() => {
        if (!isCooldownActive) {
            return;
        }

        const timer = window.setInterval(() => {
            setCooldownSeconds(getRemainingCooldownSeconds());
        }, 1000);

        return () => {
            window.clearInterval(timer);
        };
    }, [isCooldownActive]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!email.trim() || isCooldownActive) return;

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await signInWithMagicLink(email.trim());

        if (result.error) {
            setError(result.error);

            if (result.error.includes('요청이 너무 많습니다')) {
                setCooldownSeconds(startCooldown());
            }
        } else {
            setMessage('매직 링크를 보냈습니다. 메일함에서 로그인한 뒤 이 앱으로 다시 돌아와 주세요.');
            setCooldownSeconds(startCooldown());
        }

        setIsSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10 flex items-center justify-center">
            <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
                <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-sky-50 via-white to-indigo-50 p-8 lg:p-10 shadow-sm">
                    <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-sm font-medium text-sky-700">
                        <Sparkles size={15} />
                        반올림 보안 로그인
                    </div>
                    <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-950">
                        반올림 연구회 운영을 위해 로그인하세요.
                    </h1>
                    <p className="mt-4 max-w-2xl text-slate-600 text-lg">
                        승인된 이메일로 로그인하면 회원 관리, 활동 기록, 점수 관리, 시즌 통계를 사용할 수 있습니다.
                    </p>

                    <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                            <div className="text-sm font-medium text-slate-500">회원 권한</div>
                            <div className="mt-2 text-slate-900 font-semibold">내 상태와 내 활동 확인</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                            <div className="text-sm font-medium text-slate-500">팀장 권한</div>
                            <div className="mt-2 text-slate-900 font-semibold">소속 팀 활동 기록 입력</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white/90 p-4">
                            <div className="text-sm font-medium text-slate-500">운영진 권한</div>
                            <div className="mt-2 text-slate-900 font-semibold">점수 및 설정 관리</div>
                        </div>
                    </div>
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                        <ShieldCheck size={22} />
                    </div>
                    <h2 className="mt-5 text-2xl font-bold text-slate-950">이메일로 로그인</h2>
                    <p className="mt-2 text-slate-500">
                        Supabase Auth를 통해 매직 링크를 보내드립니다. 실제 접근 범위는 할당된 앱 권한에 따라 달라집니다.
                    </p>

                    {hasPendingSession && authError && (
                        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                            <div className="font-semibold">권한 프로필 확인이 필요합니다.</div>
                            <div className="mt-1">{authError}</div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => void refreshProfile()}
                                    className="rounded-xl border border-amber-300 bg-white px-3 py-2 font-medium text-amber-900 transition-colors hover:bg-amber-100"
                                >
                                    권한 다시 확인
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void signOut()}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    로그아웃
                                </button>
                            </div>
                        </div>
                    )}

                    <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">이메일</span>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="이메일 주소를 입력해 주세요"
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </label>

                        <button
                            type="submit"
                            disabled={!email.trim() || isSubmitting || isCooldownActive}
                            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting
                                ? '링크를 보내는 중...'
                                : isCooldownActive
                                    ? `다시 보내기까지 ${cooldownSeconds}초`
                                    : '매직 링크 보내기'}
                        </button>
                    </form>

                    {message && (
                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            {message}
                        </div>
                    )}

                    {!error && authError && !hasPendingSession && (
                        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            {authError}
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    {isCooldownActive && (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            연속 요청으로 인한 제한을 피하기 위해 잠시 재전송을 막고 있습니다.
                        </div>
                    )}

                    <div className="mt-6 text-xs text-slate-400">
                        로컬 mock 모드에서는 로그인 없이 바로 진입합니다. Supabase 모드에서는 인증 가능한 이메일이 필요합니다.
                    </div>
                </section>
            </div>
        </div>
    );
};
