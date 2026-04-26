import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AppRole, UserProfile } from '../../types';
import type { AppPermissions } from '../../lib/permissions';

export interface AuthContextValue {
    isLoading: boolean;
    isAuthenticated: boolean;
    authError: string | null;
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    requiresPasswordSetup: boolean;
    requiresConsent: boolean;
    role: AppRole;
    permissions: AppPermissions;
    signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
    updatePassword: (password: string) => Promise<{ error?: string }>;
    requestPasswordReset: (email: string) => Promise<{ error?: string }>;
    verifyEmailOtp: (
        email: string,
        token: string,
        type: 'recovery' | 'invite' | 'email',
    ) => Promise<{ error?: string }>;
    refreshProfile: () => Promise<void>;
    refreshConsentStatus: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
    const value = useContext(AuthContext);

    if (!value) {
        throw new Error('useAuth must be used within AuthProvider.');
    }

    return value;
};
