import React, { useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { AppRole, UserProfile } from '../../types';
import { buildPermissions } from '../../lib/permissions';
import { isAuthBypassed, isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Database } from '../../types/database';
import { AuthContext, type AuthContextValue } from './auth-context';

const defaultDemoProfile: UserProfile = {
    id: 'demo-user',
    email: 'local-demo@banollim.app',
    memberId: 'demo-member',
    appRole: 'operator',
    displayName: '로컬 데모',
    isActive: true,
};

const defaultBypassProfile: UserProfile = {
    id: 'bypass-super-admin',
    email: import.meta.env.VITE_BYPASS_AUTH_EMAIL?.trim() || 'admin@banollim.app',
    memberId: 'bypass-super-admin-member',
    appRole: 'super_admin',
    displayName: import.meta.env.VITE_BYPASS_AUTH_NAME?.trim() || '개발 최고 관리자',
    isActive: true,
};

const validRoles: AppRole[] = ['super_admin', 'operator', 'team_lead', 'member'];
type SyncedProfileRow = Database['public']['Functions']['sync_my_profile']['Returns'][number];

const normalizeAppRole = (value: string | null | undefined): AppRole | null =>
    validRoles.includes(value as AppRole) ? (value as AppRole) : null;

const mapProfileRow = (data: {
    id: string;
    email: string;
    member_id: string | null;
    app_role: string;
    display_name: string | null;
    is_active: boolean;
}): UserProfile => {
    const appRole = normalizeAppRole(data.app_role);

    if (!appRole) {
        throw new Error(`지원하지 않는 앱 권한입니다: ${data.app_role}`);
    }

    return {
        id: data.id,
        email: data.email,
        memberId: data.member_id,
        appRole,
        displayName: data.display_name,
        isActive: data.is_active,
    };
};

const fetchProfile = async (user: User): Promise<UserProfile> => {
    if (!supabase) {
        return defaultDemoProfile;
    }

    const { data, error } = await supabase.rpc('sync_my_profile');

    if (error) {
        throw new Error('권한 프로필을 동기화하지 못했습니다.');
    }

    const rows = (data ?? []) as SyncedProfileRow[];
    const profileRow = rows[0];
    if (!profileRow) {
        throw new Error(`권한 프로필을 찾지 못했습니다. (${user.id})`);
    }

    return mapProfileRow(profileRow);
};

const getProfileErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return `로그인은 되었지만 권한 프로필을 확인하지 못했습니다. ${error.message}`;
    }

    return '로그인은 되었지만 권한 프로필을 확인하지 못했습니다. 다시 로그인하거나 권한 다시 확인을 눌러 주세요.';
};

const getProfileAccessMessage = (profile: UserProfile) => {
    if (!profile.memberId) {
        return '등록된 로그인 이메일과 일치하는 회원 정보를 찾지 못했습니다. 운영진에게 본인 회원 레코드에 로그인 이메일을 등록해 달라고 요청해 주세요.';
    }

    if (!profile.isActive) {
        return '회원 정보는 확인되었지만 아직 승인되지 않았거나 비활성화되어 있습니다. 운영진에게 승인 상태를 확인해 주세요.';
    }

    return null;
};

const getEmailOtpRequestErrorMessage = (error: unknown) => {
    const status =
        typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: number }).status)
            : null;

    if (status === 429) {
        return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }

    if (error instanceof Error && error.message) {
        const normalizedMessage = error.message.toLowerCase();
        if (
            normalizedMessage.includes('signups not allowed for otp')
            || normalizedMessage.includes('user not found')
            || normalizedMessage.includes('email not found')
            || normalizedMessage.includes('for security purposes')
        ) {
            return '등록되지 않은 이메일입니다. 운영진에게 로그인 이메일 등록을 요청해 주세요.';
        }

        return error.message;
    }

    return '인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

const getEmailOtpVerifyErrorMessage = (error: unknown) => {
    const status =
        typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: number }).status)
            : null;

    if (status === 429) {
        return '인증 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }

    if (error instanceof Error && error.message) {
        const normalizedMessage = error.message.toLowerCase();
        if (normalizedMessage.includes('expired') || normalizedMessage.includes('invalid')) {
            return '인증 코드가 올바르지 않거나 만료되었습니다. 새 코드를 받아 다시 시도해 주세요.';
        }

        return error.message;
    }

    return '인증 코드를 확인하지 못했습니다. 새 코드를 받아 다시 시도해 주세요.';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(
        isAuthBypassed ? defaultBypassProfile : isSupabaseConfigured ? null : defaultDemoProfile,
    );
    const [isLoading, setIsLoading] = useState(isSupabaseConfigured && !isAuthBypassed);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const client = supabase;

        if (isAuthBypassed || !isSupabaseConfigured || !client) {
            return;
        }

        let isMounted = true;

        const resolveProfile = async (nextUser: User | null) => {
            if (!nextUser) {
                if (isMounted) {
                    setProfile(null);
                    setAuthError(null);
                }
                return;
            }

            try {
                const resolvedProfile = await fetchProfile(nextUser);
                if (isMounted) {
                    setProfile(resolvedProfile);
                    setAuthError(getProfileAccessMessage(resolvedProfile));
                }
            } catch (error) {
                console.error('[auth] failed to resolve user profile', error);

                if (isMounted) {
                    setProfile(null);
                    setAuthError(getProfileErrorMessage(error));
                }
            }
        };

        const initialize = async () => {
            const {
                data: { session: currentSession },
            } = await client.auth.getSession();

            if (!isMounted) return;

            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            await resolveProfile(currentSession?.user ?? null);

            if (isMounted) {
                setIsLoading(false);
            }
        };

        void initialize();

        const {
            data: { subscription },
        } = client.auth.onAuthStateChange((_event: AuthChangeEvent, nextSession: Session | null) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);

            void resolveProfile(nextSession?.user ?? null);

            if (isMounted) {
                setIsLoading(false);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const role: AppRole = profile?.appRole ?? (isSupabaseConfigured && !isAuthBypassed ? 'member' : 'operator');
    const permissions = useMemo(() => buildPermissions(role), [role]);

    const value = useMemo<AuthContextValue>(
        () => ({
            isLoading,
            isAuthenticated: Boolean(profile && profile.isActive && profile.memberId),
            authError,
            user,
            session,
            profile,
            role,
            permissions,
            signInWithEmailOtp: async (email: string) => {
                if (!supabase) {
                    return {};
                }

                setAuthError(null);

                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        shouldCreateUser: false,
                    },
                });

                return error ? { error: getEmailOtpRequestErrorMessage(error) } : {};
            },
            verifyEmailOtp: async (email: string, token: string) => {
                if (!supabase) {
                    return {};
                }

                setAuthError(null);

                const { error } = await supabase.auth.verifyOtp({
                    email,
                    token,
                    type: 'email',
                });

                return error ? { error: getEmailOtpVerifyErrorMessage(error) } : {};
            },
            refreshProfile: async () => {
                if (!supabase || !user) return;

                setIsLoading(true);

                try {
                    const resolvedProfile = await fetchProfile(user);
                    setProfile(resolvedProfile);
                    setAuthError(getProfileAccessMessage(resolvedProfile));
                } catch (error) {
                    console.error('[auth] failed to refresh user profile', error);
                    setProfile(null);
                    setAuthError(getProfileErrorMessage(error));
                } finally {
                    setIsLoading(false);
                }
            },
            signOut: async () => {
                if (isAuthBypassed || !supabase) return;
                setAuthError(null);
                await supabase.auth.signOut();
            },
        }),
        [authError, isLoading, permissions, profile, role, session, user],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
