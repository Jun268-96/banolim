import React, { useEffect, useState } from 'react';
import { KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from './auth-context';

type AuthMode = 'login' | 'forgot' | 'otp';

const detectOtpHintFromUrl = (): { type: 'recovery' | 'invite'; reason: 'expired' | null; email?: string } => {
    if (typeof window === 'undefined') {
        return { type: 'recovery', reason: null };
    }

    const hash = window.location.hash;

    // 만료/오류 hash가 있을 때만 OTP 모드로 안내 (메일 스캐너에 토큰이 소진된 케이스).
    // 정상 링크(#access_token=...&type=recovery)는 AuthProvider가 세션을 만들어 비번 폼으로 직진시키므로
    // 여기서 OTP 모드로 가로채면 안 된다.
    if (hash.includes('error=') && hash.includes('otp_expired')) {
        const hashTypeMatch = hash.match(/type=(recovery|invite)/);
        return {
            type: (hashTypeMatch?.[1] as 'recovery' | 'invite') ?? 'recovery',
            reason: 'expired',
        };
    }

    return { type: 'recovery', reason: null };
};

export const AuthScreen: React.FC = () => {
    const {
        authError,
        profile,
        refreshProfile,
        requiresPasswordSetup,
        requestPasswordReset,
        session,
        signInWithPassword,
        signOut,
        updatePassword,
        verifyEmailOtp,
    } = useAuth();
    const [mode, setMode] = useState<AuthMode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [resetEmail, setResetEmail] = useState('');
    const [nextPassword, setNextPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otpEmail, setOtpEmail] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [otpType, setOtpType] = useState<'recovery' | 'invite'>('recovery');
    const [otpHintReason, setOtpHintReason] = useState<'expired' | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const hasSession = Boolean(session?.user);
    const requiresPasswordReset = Boolean(hasSession && (profile?.mustResetPassword || requiresPasswordSetup));
    const isBlockedState = Boolean(hasSession && authError && !requiresPasswordReset);

    useEffect(() => {
        if (hasSession) {
            return;
        }

        const hint = detectOtpHintFromUrl();
        if (hint.reason) {
            setMode('otp');
            setOtpType(hint.type);
            setOtpHintReason(hint.reason);
            if (hint.email) {
                setOtpEmail(hint.email);
            }

            // 오류 hash는 URL에서 정리해 새로고침 시 헷갈리지 않게 한다.
            if (hint.reason === 'expired' && typeof window !== 'undefined' && window.location.hash) {
                const cleanUrl = `${window.location.pathname}${window.location.search}`;
                window.history.replaceState({}, '', cleanUrl);
            }
        }
    }, [hasSession]);

    const handleLogin = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!email.trim() || !password) return;

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await signInWithPassword(email.trim().toLowerCase(), password);

        if (result.error) {
            setError(result.error);
        } else {
            setMessage('로그인 정보를 확인했습니다. 권한 정보를 불러오는 중입니다.');
        }

        setIsSubmitting(false);
    };

    const handlePasswordResetRequest = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!resetEmail.trim()) return;

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await requestPasswordReset(resetEmail.trim().toLowerCase());

        if (result.error) {
            setError(result.error);
        } else {
            setMessage('비밀번호 재설정 메일을 보냈습니다. 메일의 링크로 들어와 새 비밀번호를 설정해 주세요.');
        }

        setIsSubmitting(false);
    };

    const handleVerifyOtp = async (event: React.FormEvent) => {
        event.preventDefault();

        const trimmedEmail = otpEmail.trim().toLowerCase();
        const trimmedToken = otpCode.replace(/\s+/g, '');

        if (!trimmedEmail) {
            setError('이메일을 입력해 주세요.');
            return;
        }

        if (!/^\d{6}$/.test(trimmedToken)) {
            setError('메일에서 받은 6자리 숫자 코드를 입력해 주세요.');
            return;
        }

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await verifyEmailOtp(trimmedEmail, trimmedToken, otpType);

        if (result.error) {
            setError(result.error);
        } else {
            setMessage('인증되었습니다. 새 비밀번호를 설정해 주세요.');
            setOtpCode('');
        }

        setIsSubmitting(false);
    };

    const handleCompletePasswordSetup = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!nextPassword || nextPassword.length < 8) {
            setError('새 비밀번호는 8자 이상이어야 합니다.');
            return;
        }

        if (nextPassword !== confirmPassword) {
            setError('새 비밀번호와 확인 입력이 일치하지 않습니다.');
            return;
        }

        setIsSubmitting(true);
        setMessage(null);
        setError(null);

        const result = await updatePassword(nextPassword);

        if (result.error) {
            setError(result.error);
        } else {
            setMessage('비밀번호를 변경했습니다. 이제 새 비밀번호로 계속 사용할 수 있습니다.');
            setNextPassword('');
            setConfirmPassword('');
        }

        setIsSubmitting(false);
    };

    const handleSignOut = async () => {
        setMessage(null);
        setError(null);
        setPassword('');
        setNextPassword('');
        setConfirmPassword('');
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
                        등록된 이메일과 비밀번호로 로그인하세요.
                    </h1>
                    <p className="mt-4 max-w-2xl text-slate-600 text-lg">
                        운영진이 미리 등록한 회원만 접근할 수 있습니다. 계정은 운영진이 발급하고, 첫 로그인 뒤에는 본인 비밀번호로 계속 이용합니다.
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
                    <h2 className="mt-5 text-2xl font-bold text-slate-950">
                        {requiresPasswordReset
                            ? '새 비밀번호 설정'
                            : mode === 'otp'
                            ? '메일 코드 인증'
                            : '이메일로 로그인'}
                    </h2>
                    <p className="mt-2 text-slate-500">
                        {requiresPasswordReset
                            ? '운영진이 계정을 발급했습니다. 계속 사용하려면 새 비밀번호를 먼저 설정해 주세요.'
                            : mode === 'otp'
                            ? otpHintReason === 'expired'
                                ? '메일 링크는 보안 검사 도중 한 번 사용된 상태입니다. 메일 본문의 6자리 코드를 입력해 주세요.'
                                : '메일 본문에 안내된 6자리 코드를 입력하면 비밀번호를 설정할 수 있습니다.'
                            : '등록된 이메일과 비밀번호로 로그인합니다. 비밀번호를 잊었다면 재설정 메일을 요청할 수 있습니다.'}
                    </p>

                    {isBlockedState && authError && (
                        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                            <div className="font-semibold">회원 상태 또는 매칭 확인이 필요합니다.</div>
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

                    {requiresPasswordReset ? (
                        <form className="mt-8 space-y-4" onSubmit={handleCompletePasswordSetup}>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">새 비밀번호</span>
                                <input
                                    type="password"
                                    value={nextPassword}
                                    onChange={(event) => setNextPassword(event.target.value)}
                                    placeholder="8자 이상 입력"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">새 비밀번호 확인</span>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) => setConfirmPassword(event.target.value)}
                                    placeholder="비밀번호를 다시 입력"
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </label>
                            <p className="rounded-2xl bg-indigo-50/60 px-4 py-3 text-xs text-slate-700">
                                비밀번호를 저장한 뒤 다음 단계에서{' '}
                                <a
                                    href="/privacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-indigo-600 underline hover:text-indigo-700"
                                >
                                    개인정보 처리방침
                                </a>
                                에 동의해야 서비스를 이용할 수 있습니다.
                            </p>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            >
                                <KeyRound size={16} />
                                {isSubmitting ? '비밀번호 저장 중...' : '새 비밀번호 저장'}
                            </button>
                            <button
                                type="button"
                                onClick={() => void handleSignOut()}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                로그아웃
                            </button>
                        </form>
                    ) : mode === 'otp' ? (
                        <form className="mt-8 space-y-4" onSubmit={handleVerifyOtp}>
                            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                <div className="font-semibold">코드가 작동하지 않으면</div>
                                <div className="mt-1 leading-relaxed">
                                    메일 본문의 <strong>바로 가기 링크</strong>를 클릭해 보시거나, 운영진에게
                                    카톡으로 <strong>백업 링크</strong>를 요청해 주세요.
                                </div>
                            </div>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">이메일</span>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={otpEmail}
                                        onChange={(event) => setOtpEmail(event.target.value)}
                                        placeholder="등록된 이메일 주소"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">메일에서 받은 6자리 코드</span>
                                <div className="relative">
                                    <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        maxLength={6}
                                        value={otpCode}
                                        onChange={(event) => setOtpCode(event.target.value.replace(/[^0-9]/g, ''))}
                                        placeholder="123456"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-base font-mono tracking-widest outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </label>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            >
                                <ShieldCheck size={16} />
                                {isSubmitting ? '인증 중...' : '코드 확인하고 비밀번호 설정'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('login');
                                    setOtpHintReason(null);
                                    setMessage(null);
                                    setError(null);
                                }}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                비밀번호로 로그인하기
                            </button>
                        </form>
                    ) : mode === 'forgot' ? (
                        <form className="mt-8 space-y-4" onSubmit={handlePasswordResetRequest}>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">이메일</span>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={resetEmail}
                                        onChange={(event) => setResetEmail(event.target.value)}
                                        placeholder="등록된 이메일 주소"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </label>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            >
                                <Mail size={16} />
                                {isSubmitting ? '메일 전송 중...' : '비밀번호 재설정 메일 보내기'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('login');
                                    setMessage(null);
                                    setError(null);
                                }}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                로그인으로 돌아가기
                            </button>
                        </form>
                    ) : (
                        <form className="mt-8 space-y-4" onSubmit={handleLogin}>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">이메일</span>
                                <div className="relative">
                                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="등록된 이메일 주소"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </label>
                            <label className="block space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">비밀번호</span>
                                <div className="relative">
                                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        placeholder="비밀번호를 입력해 주세요"
                                        className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </label>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                            >
                                <ShieldCheck size={16} />
                                {isSubmitting ? '로그인 중...' : '로그인'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('forgot');
                                    setResetEmail(email);
                                    setMessage(null);
                                    setError(null);
                                }}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                            >
                                비밀번호를 잊었어요
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('otp');
                                    setOtpEmail(email);
                                    setOtpType('recovery');
                                    setOtpHintReason(null);
                                    setMessage(null);
                                    setError(null);
                                }}
                                className="w-full rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                            >
                                메일 코드로 인증하기
                            </button>
                        </form>
                    )}

                    {(message || error || authError) && (
                        <div className="mt-4 space-y-2">
                            {message && (
                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                    {message}
                                </div>
                            )}
                            {error && (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </div>
                            )}
                            {!error && !requiresPasswordReset && authError && !isBlockedState && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                                    {authError}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
