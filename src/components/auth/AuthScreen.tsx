import React, { useEffect, useState } from 'react';
import { Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './auth-context';

const EMAIL_OTP_COOLDOWN_KEY = 'banollim.email-otp.cooldown-until';
const EMAIL_OTP_PENDING_EMAIL_KEY = 'banollim.email-otp.pending-email';
const EMAIL_OTP_COOLDOWN_SECONDS = 60;
const EMAIL_OTP_MIN_LENGTH = 6;
const EMAIL_OTP_MAX_LENGTH = 10;

const getRemainingCooldownSeconds = () => {
    if (typeof window === 'undefined') {
        return 0;
    }

    const storedValue = window.localStorage.getItem(EMAIL_OTP_COOLDOWN_KEY);
    if (!storedValue) {
        return 0;
    }

    const cooldownUntil = Number(storedValue);
    if (!Number.isFinite(cooldownUntil)) {
        window.localStorage.removeItem(EMAIL_OTP_COOLDOWN_KEY);
        return 0;
    }

    const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
    if (remaining <= 0) {
        window.localStorage.removeItem(EMAIL_OTP_COOLDOWN_KEY);
        return 0;
    }

    return remaining;
};

const startCooldown = () => {
    if (typeof window === 'undefined') {
        return EMAIL_OTP_COOLDOWN_SECONDS;
    }

    const cooldownUntil = Date.now() + EMAIL_OTP_COOLDOWN_SECONDS * 1000;
    window.localStorage.setItem(EMAIL_OTP_COOLDOWN_KEY, String(cooldownUntil));
    return EMAIL_OTP_COOLDOWN_SECONDS;
};

const getPendingEmail = () => {
    if (typeof window === 'undefined') {
        return '';
    }

    return window.localStorage.getItem(EMAIL_OTP_PENDING_EMAIL_KEY) ?? '';
};

const setPendingEmailStorage = (email: string) => {
    if (typeof window === 'undefined') {
        return;
    }

    if (email) {
        window.localStorage.setItem(EMAIL_OTP_PENDING_EMAIL_KEY, email);
        return;
    }

    window.localStorage.removeItem(EMAIL_OTP_PENDING_EMAIL_KEY);
};

const normalizeOtpCode = (value: string) => value.replace(/\D/g, '').slice(0, EMAIL_OTP_MAX_LENGTH);

export const AuthScreen: React.FC = () => {
    const { authError, refreshProfile, session, signInWithEmailOtp, signOut, verifyEmailOtp } = useAuth();
    const [email, setEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [pendingEmail, setPendingEmail] = useState(() => getPendingEmail());
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cooldownSeconds, setCooldownSeconds] = useState(() => getRemainingCooldownSeconds());
    const hasPendingSession = Boolean(session?.user);
    const isCooldownActive = cooldownSeconds > 0;
    const isOtpStep = Boolean(pendingEmail) && !hasPendingSession;

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

    const handleRequestOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!email.trim() || isCooldownActive || hasPendingSession) return;

        const normalizedEmail = email.trim().toLowerCase();

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await signInWithEmailOtp(normalizedEmail);

        if (result.error) {
            setError(result.error);

            if (result.error.includes('요청이 너무 많습니다')) {
                setCooldownSeconds(startCooldown());
            }
        } else {
            setEmail(normalizedEmail);
            setPendingEmail(normalizedEmail);
            setPendingEmailStorage(normalizedEmail);
            setOtpCode('');
            setMessage('이메일로 인증 코드를 보냈습니다. 메일함에서 가장 최근에 받은 숫자 코드를 입력해 주세요.');
            setCooldownSeconds(startCooldown());
        }

        setIsSubmitting(false);
    };

    const handleVerifyOtp = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!pendingEmail || otpCode.length < EMAIL_OTP_MIN_LENGTH || hasPendingSession) return;

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await verifyEmailOtp(pendingEmail, otpCode);

        if (result.error) {
            setError(result.error);
        } else {
            setMessage('인증 코드를 확인했습니다. 권한 정보를 불러오는 중입니다.');
        }

        setIsSubmitting(false);
    };

    const handleResetEmail = () => {
        setPendingEmail('');
        setPendingEmailStorage('');
        setOtpCode('');
        setMessage(null);
        setError(null);
        setCooldownSeconds(getRemainingCooldownSeconds());
    };

    const handleResendOtp = async () => {
        if (!pendingEmail || isCooldownActive || hasPendingSession) return;

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await signInWithEmailOtp(pendingEmail);

        if (result.error) {
            setError(result.error);
            if (result.error.includes('요청이 너무 많습니다')) {
                setCooldownSeconds(startCooldown());
            }
        } else {
            setMessage('새 인증 코드를 보냈습니다. 가장 최근에 받은 숫자 코드를 입력해 주세요.');
            setCooldownSeconds(startCooldown());
        }

        setIsSubmitting(false);
    };

    const handleSignOut = async () => {
        setPendingEmail('');
        setPendingEmailStorage('');
        setOtpCode('');
        setMessage(null);
        setError(null);
        await signOut();
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
                        운영진이 미리 등록한 로그인 이메일로만 진입할 수 있습니다. 로그인 후에는 기존 회원 레코드와 자동 매칭됩니다.
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
                        등록된 이메일로 숫자 인증 코드를 보내드립니다. 인증 뒤 실제 접근 범위는 할당된 앱 권한에 따라 달라집니다.
                    </p>

                    {hasPendingSession && authError && (
                        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                            <div className="font-semibold">승인 또는 회원 매칭이 필요합니다.</div>
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
                                    onClick={() => void handleSignOut()}
                                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    로그아웃
                                </button>
                            </div>
                        </div>
                    )}

                    <form className="mt-8 space-y-4" onSubmit={isOtpStep ? handleVerifyOtp : handleRequestOtp}>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">이메일</span>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="email"
                                    value={isOtpStep ? pendingEmail : email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="이메일 주소를 입력해 주세요"
                                    disabled={hasPendingSession || isOtpStep}
                                    className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </label>

                        {isOtpStep && (
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">이메일 인증 코드</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={otpCode}
                                    onChange={(event) => setOtpCode(normalizeOtpCode(event.target.value))}
                                    placeholder="메일에서 받은 숫자 코드를 입력해 주세요"
                                    disabled={hasPendingSession}
                                    maxLength={EMAIL_OTP_MAX_LENGTH}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-lg tracking-[0.24em] text-slate-900 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>
                        )}

                        <button
                            type="submit"
                            disabled={
                                isOtpStep
                                    ? otpCode.length < EMAIL_OTP_MIN_LENGTH || isSubmitting || hasPendingSession
                                    : !email.trim() || isSubmitting || isCooldownActive || hasPendingSession
                            }
                            className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting
                                ? isOtpStep
                                    ? '인증 중...'
                                    : '코드를 보내는 중...'
                                : isOtpStep
                                    ? '인증 코드 확인'
                                    : isCooldownActive
                                        ? `다시 보내기까지 ${cooldownSeconds}초`
                                        : '인증 코드 보내기'}
                        </button>
                    </form>

                    {isOtpStep && (
                        <div className="mt-4 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => void handleResendOtp()}
                                disabled={isSubmitting || isCooldownActive || hasPendingSession}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                                {isCooldownActive ? `코드 재전송 ${cooldownSeconds}초` : '코드 다시 보내기'}
                            </button>
                            <button
                                type="button"
                                onClick={handleResetEmail}
                                disabled={isSubmitting || hasPendingSession}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                                다른 이메일 사용
                            </button>
                        </div>
                    )}

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
                </section>
            </div>
        </div>
    );
};
