import React, { useEffect, useState } from 'react';
import { Check, Copy, ShieldAlert } from 'lucide-react';
import { AppDialog } from '../../shared/AppDialog';

interface ProvisionedAccount {
  memberName: string;
  email: string;
  isExistingAccount: boolean;
  inviteSent: boolean;
  actionLink?: string;
  linkExpiresInHours?: number;
}

interface ProvisionedAccountDialogProps {
  provisionedAccount: ProvisionedAccount | null;
  onClose: () => void;
}

const maskLink = (link: string): string => {
  if (link.length <= 64) {
    return link;
  }
  return `${link.slice(0, 48)}…${link.slice(-12)}`;
};

export const ProvisionedAccountDialog: React.FC<ProvisionedAccountDialogProps> = ({
  provisionedAccount,
  onClose,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (!provisionedAccount) {
      setCopyState('idle');
      return;
    }
  }, [provisionedAccount]);

  useEffect(() => {
    if (copyState === 'idle') {
      return undefined;
    }
    const timer = window.setTimeout(() => setCopyState('idle'), 2200);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleCopy = async () => {
    if (!provisionedAccount?.actionLink) {
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(provisionedAccount.actionLink);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = provisionedAccount.actionLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error('execCommand copy failed');
        }
      }
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const expiresHours = provisionedAccount?.linkExpiresInHours;
  const expiryLabel =
    typeof expiresHours === 'number'
      ? expiresHours >= 1
        ? `${expiresHours}시간 후 만료`
        : `${Math.round(expiresHours * 60)}분 후 만료`
      : null;

  const description = provisionedAccount?.inviteSent
    ? '초대 링크가 회원 이메일로 발송됐습니다. 메일이 도착하지 않으면 아래 링크를 직접 전달하세요.'
    : '메일 발송에 실패해 회원에게 초대 메일이 가지 않았습니다. 아래 링크를 카톡 등으로 직접 전달해 주세요.';

  return (
    <AppDialog
      isOpen={Boolean(provisionedAccount)}
      title="계정 발급 완료"
      description={description}
      size="md"
      onClose={onClose}
    >
      {provisionedAccount && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">회원</div>
            <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.memberName}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">대상 이메일</div>
            <div className="mt-1 font-semibold text-slate-900">{provisionedAccount.email}</div>
          </div>
          {provisionedAccount.inviteSent ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-900">
              {provisionedAccount.isExistingAccount
                ? '✓ 기존 계정으로 비밀번호 재설정 메일을 발송했습니다.'
                : '✓ 새 계정을 만들고 초대 메일을 발송했습니다.'}
            </div>
          ) : (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-900">
              ⚠ 메일 발송에 실패했습니다 (시간당 발송 한도 초과 또는 네트워크 오류). 잠시 후 다시 시도하거나, 아래 링크를 직접 회원에게 전달해 주세요.
            </div>
          )}

          {provisionedAccount.actionLink && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-amber-900">백업: 초대 링크 직접 전달</div>
                  {expiryLabel && (
                    <div className="mt-0.5 text-xs text-amber-700">이 링크는 {expiryLabel}됩니다.</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    copyState === 'copied'
                      ? 'bg-emerald-600 text-white'
                      : copyState === 'failed'
                      ? 'bg-rose-600 text-white'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                  aria-label="초대 링크 복사"
                >
                  {copyState === 'copied' ? (
                    <>
                      <Check size={14} />
                      복사됨
                    </>
                  ) : copyState === 'failed' ? (
                    <>
                      <ShieldAlert size={14} />
                      복사 실패
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      링크 복사
                    </>
                  )}
                </button>
              </div>
              <div className="mt-3 break-all rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-xs text-slate-700">
                {maskLink(provisionedAccount.actionLink)}
              </div>
              <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-900">
                <ShieldAlert size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  이 링크는 본인에게만 1:1 채널(개인 카톡, SMS 등)로 전달하세요. 단톡방·공개 채널에 공유하면 다른 사람이 이 계정의 비밀번호를 설정할 수 있습니다.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </AppDialog>
  );
};
