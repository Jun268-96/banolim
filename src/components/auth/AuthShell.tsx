import React, { useCallback, useState } from 'react';
import { useAuth } from './auth-context';
import { AuthScreen } from './AuthScreen';
import { ConsentForm } from './ConsentForm';
import { PrivacyPolicy } from '../legal/PrivacyPolicy';

const usePrivacyOverlay = () => {
    const [isOpen, setIsOpen] = useState(
        typeof window !== 'undefined' && window.location.pathname === '/privacy',
    );

    const open = useCallback(() => {
        if (typeof window !== 'undefined' && window.location.pathname !== '/privacy') {
            window.history.pushState({}, '', '/privacy');
        }
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        if (typeof window !== 'undefined' && window.location.pathname === '/privacy') {
            window.history.replaceState({}, '', '/');
        }
        setIsOpen(false);
    }, []);

    return { isOpen, open, close };
};

export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoading, isAuthenticated, session, requiresPasswordSetup, requiresConsent, refreshConsentStatus, profile } =
        useAuth();
    const privacy = usePrivacyOverlay();

    if (privacy.isOpen) {
        return <PrivacyPolicy onBack={privacy.close} />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100" />
                    <div className="text-indigo-600 font-medium">접속 권한을 확인하고 있습니다...</div>
                </div>
            </div>
        );
    }

    const hasUsableSession = Boolean(session?.user);
    const passwordSetupBlocking = requiresPasswordSetup || Boolean(profile?.mustResetPassword);

    // 비번 설정 완료 + 활성 회원 + 동의만 미완료인 상태에서만 ConsentForm 노출
    if (!isAuthenticated && hasUsableSession && !passwordSetupBlocking && requiresConsent) {
        return (
            <ConsentForm
                onCompleted={() => {
                    void refreshConsentStatus();
                }}
                onOpenPrivacy={privacy.open}
            />
        );
    }

    if (!isAuthenticated) {
        return <AuthScreen />;
    }

    return <>{children}</>;
};
