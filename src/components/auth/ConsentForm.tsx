import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, ShieldCheck } from 'lucide-react';
import { recordMyConsent, type MemberConsentType } from '../../lib/db';
import { useAuth } from './auth-context';

interface ConsentFormProps {
    onCompleted: () => void;
    onOpenPrivacy: () => void;
}

interface ConsentItem {
    type: MemberConsentType;
    version: number;
    label: string;
    description: React.ReactNode;
}

const REQUIRED_ITEMS: ConsentItem[] = [
    {
        type: 'required_v1',
        version: 1,
        label: '[필수] 개인정보 수집·이용 동의',
        description: (
            <>
                항목: 이름, 이메일, 비밀번호(암호화), 팀·직책·점수·활동기록, 접속 로그(IP·UA·시각)
                <br />
                목적: 회원 식별, 활동 기록 관리, 알림 발송, 보안 로그
                <br />
                보유 기간: 회원 탈퇴 또는 단체 해체 시까지
                <br />
                <span className="text-rose-600">※ 거부 시 서비스 이용이 제한됩니다.</span>
            </>
        ),
    },
    {
        type: 'overseas_transfer_v1',
        version: 1,
        label: '[필수] 개인정보의 국외 이전 동의',
        description: (
            <>
                이전 받는 자: Supabase Inc.(미국), Vercel Inc.(미국), Google LLC(미국)
                <br />
                이전 항목: 위 [필수] 수집 항목 전체
                <br />
                이전 목적: 데이터베이스·인증·호스팅·메일 발송
                <br />
                보유 기간: 위탁 계약 종료 시까지
                <br />
                <span className="text-rose-600">
                    ※ 본 단체는 미국 호스팅 서비스를 사용하므로 거부 시 서비스 이용이 불가합니다.
                </span>
            </>
        ),
    },
];

const OPTIONAL_ITEMS: ConsentItem[] = [
    {
        type: 'push_token_v1',
        version: 1,
        label: '[선택] 푸시 알림용 디바이스 토큰 처리 동의',
        description:
            '브라우저·디바이스에 활동 알림을 보내기 위해 토큰(endpoint, 암호화 키)을 처리합니다. 미동의 시 푸시 알림이 발송되지 않습니다.',
    },
];

export const ConsentForm: React.FC<ConsentFormProps> = ({ onCompleted, onOpenPrivacy }) => {
    const { signOut, profile } = useAuth();
    const [requiredAgreed, setRequiredAgreed] = useState<Record<string, boolean>>({});
    const [optionalAgreed, setOptionalAgreed] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const toggleRequired = (key: string) => {
        setRequiredAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleOptional = (key: string) => {
        setOptionalAgreed((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const allRequiredChecked = REQUIRED_ITEMS.every(
        (item) => requiredAgreed[`${item.type}:${item.version}`],
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();

        if (!allRequiredChecked) {
            setError('필수 동의 항목 모두에 체크해야 서비스를 이용할 수 있습니다.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            for (const item of REQUIRED_ITEMS) {
                await recordMyConsent(item.type, item.version, true);
            }

            for (const item of OPTIONAL_ITEMS) {
                const key = `${item.type}:${item.version}`;
                await recordMyConsent(item.type, item.version, Boolean(optionalAgreed[key]));
            }

            onCompleted();
        } catch (err) {
            const message = err instanceof Error ? err.message : '동의 저장 중 문제가 발생했습니다.';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10 flex items-center justify-center">
            <div className="w-full max-w-2xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white">
                    <ShieldCheck size={22} />
                </div>
                <h1 className="mt-5 text-2xl font-bold text-slate-950">개인정보 처리 동의</h1>
                <p className="mt-2 text-slate-600">
                    {profile?.displayName ? `${profile.displayName} 회원님, ` : ''}서비스를 계속 이용하려면 「개인정보
                    보호법」 제15조에 따른 수집·이용 동의가 필요합니다. 처리 항목·목적·보유 기간은 처리방침에서
                    확인하실 수 있습니다.
                </p>

                <button
                    type="button"
                    onClick={onOpenPrivacy}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
                >
                    <ExternalLink size={12} />
                    개인정보 처리방침 보기
                </button>

                <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
                    {REQUIRED_ITEMS.map((item) => {
                        const key = `${item.type}:${item.version}`;
                        return (
                            <label
                                key={key}
                                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 transition-colors hover:bg-indigo-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={Boolean(requiredAgreed[key])}
                                    onChange={() => toggleRequired(key)}
                                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="flex-1 text-sm">
                                    <span className="block font-semibold text-indigo-900">{item.label}</span>
                                    <span className="mt-1 block text-slate-700">{item.description}</span>
                                </span>
                            </label>
                        );
                    })}

                    {OPTIONAL_ITEMS.map((item) => {
                        const key = `${item.type}:${item.version}`;
                        return (
                            <label
                                key={key}
                                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50"
                            >
                                <input
                                    type="checkbox"
                                    checked={Boolean(optionalAgreed[key])}
                                    onChange={() => toggleOptional(key)}
                                    className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="flex-1 text-sm">
                                    <span className="block font-semibold text-slate-900">{item.label}</span>
                                    <span className="mt-1 block text-slate-600">{item.description}</span>
                                </span>
                            </label>
                        );
                    })}

                    {error && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !allRequiredChecked}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
                    >
                        <CheckCircle2 size={16} />
                        {isSubmitting ? '저장 중...' : '동의하고 계속 이용'}
                    </button>
                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        동의하지 않고 로그아웃
                    </button>
                </form>
            </div>
        </div>
    );
};
