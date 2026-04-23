import React, { useEffect, useState } from 'react';
import { KeyRound, Loader2, Trash2, TriangleAlert } from 'lucide-react';
import type { Member } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface MemberAccountDialogProps {
    member: Member | null;
    isOpen: boolean;
    isSaving: boolean;
    isProvisioning: boolean;
    onClose: () => void;
    normalizeLoginEmail: (value: string) => string | null;
    formatDate: (value?: string | null) => string;
    formatDateTime: (value?: string | null) => string;
    onUpdateLoginEmail: (memberId: string, loginEmail: string | null) => void;
    onProvisionAccount: (member: Member) => void;
    onDelete: (memberId: string) => void;
}

const getAccountProvisionInfo = (member: Member) => {
    if (!member.loginEmail) {
        return {
            label: '이메일 필요',
            description: '계정을 발급하려면 먼저 로그인 이메일을 입력하고 저장하세요.',
            className: 'bg-slate-100 text-slate-600 border-slate-200',
        };
    }
    if (!member.authUserId) {
        return {
            label: '계정 미발급',
            description: '이메일은 저장되어 있지만 아직 Supabase 계정이 발급되지 않았습니다.',
            className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }
    if (member.passwordResetRequired) {
        return {
            label: '첫 로그인 대기',
            description: '계정이 발급되었고, 해당 사용자가 첫 로그인으로 비밀번호를 설정할 예정입니다.',
            className: 'bg-sky-50 text-sky-700 border-sky-200',
        };
    }
    return {
        label: '계정 활성',
        description: '사용자가 정상적으로 로그인할 수 있는 상태입니다.',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
};

export const MemberAccountDialog: React.FC<MemberAccountDialogProps> = ({
    member,
    isOpen,
    isSaving,
    isProvisioning,
    onClose,
    normalizeLoginEmail,
    formatDate,
    formatDateTime,
    onUpdateLoginEmail,
    onProvisionAccount,
    onDelete,
}) => {
    const [emailDraft, setEmailDraft] = useState('');
    const [hasEmailChange, setHasEmailChange] = useState(false);

    useEffect(() => {
        if (isOpen && member) {
            setEmailDraft(member.loginEmail ?? '');
            setHasEmailChange(false);
        }
    }, [isOpen, member]);

    if (!member) return null;

    const provisionInfo = getAccountProvisionInfo(member);
    const normalizedDraft = normalizeLoginEmail(emailDraft);
    const currentEmail = member.loginEmail ?? null;
    const saveDisabled = !hasEmailChange || isSaving || normalizedDraft === currentEmail;
    const provisionDisabled = !member.loginEmail || isProvisioning;
    const provisionLabel = member.authUserId ? '비밀번호 재발급' : '계정 발급';

    const handleSaveEmail = () => {
        if (saveDisabled) return;
        onUpdateLoginEmail(member.id, normalizedDraft);
        setHasEmailChange(false);
    };

    const handleDelete = () => {
        onDelete(member.id);
        onClose();
    };

    return (
        <AppDialog
            isOpen={isOpen}
            onClose={onClose}
            title={`${member.name} 계정 관리`}
            description="로그인 이메일·계정 발급·멤버 숨김 같은 관리 작업을 한 곳에서 수행합니다."
            size="md"
        >
            <div className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>가입일 {formatDate(member.joinedAt)}</span>
                        {member.authProvisionedAt && (
                            <span>계정 발급 {formatDateTime(member.authProvisionedAt)}</span>
                        )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${provisionInfo.className}`}>
                            {provisionInfo.label}
                        </span>
                        <span className="text-xs text-slate-600">{provisionInfo.description}</span>
                    </div>
                </section>

                <div>
                    <label htmlFor={`member-login-email-${member.id}`} className="mb-1.5 block text-sm font-medium text-slate-700">
                        로그인 이메일
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <input
                            id={`member-login-email-${member.id}`}
                            type="email"
                            value={emailDraft}
                            placeholder="example@school.kr"
                            disabled={isSaving}
                            onChange={(event) => {
                                setEmailDraft(event.target.value);
                                setHasEmailChange(true);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleSaveEmail();
                                }
                            }}
                            className="min-w-[220px] flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={handleSaveEmail}
                            disabled={saveDisabled}
                            className="inline-flex items-center gap-1.5 rounded-2xl border border-indigo-200 bg-white px-4 py-3 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-400"
                        >
                            {isSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                            이메일 저장
                        </button>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">
                        이메일을 저장한 뒤 아래 계정 발급 버튼으로 Supabase 계정을 생성하거나 비밀번호를 재발급할 수 있습니다.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
                    <button
                        type="button"
                        onClick={() => onProvisionAccount(member)}
                        disabled={provisionDisabled}
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                        title={member.authUserId ? '비밀번호 재설정 발송' : '계정 발급'}
                    >
                        {isProvisioning ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                발급 중
                            </>
                        ) : (
                            <>
                                <KeyRound size={14} />
                                {provisionLabel}
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        className="inline-flex items-center gap-1.5 rounded-2xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                        title="멤버 숨기기"
                    >
                        <Trash2 size={14} />
                        멤버 숨기기
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="ml-auto rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        닫기
                    </button>
                </div>

                {!member.loginEmail && (
                    <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                        <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                        <span>로그인 이메일이 없어 계정을 발급할 수 없습니다. 먼저 이메일을 입력하고 저장하세요.</span>
                    </div>
                )}
            </div>
        </AppDialog>
    );
};
