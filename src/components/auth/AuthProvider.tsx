import React, { useEffect, useMemo, useState } from 'react';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import type { AppRole, UserProfile } from '../../types';
import { buildPermissions } from '../../lib/permissions';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { AuthContext, type AuthContextValue } from './auth-context';

const defaultDemoProfile: UserProfile = {
    id: 'demo-user',
    email: 'local-demo@banollim.app',
    memberId: null,
    appRole: 'operator',
    displayName: '로컬 데모',
    isActive: true,
};

const validRoles: AppRole[] = ['super_admin', 'operator', 'team_lead', 'member'];

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

const createProfileSeed = (user: User) => ({
    id: user.id,
    email: user.email ?? 'unknown@banollim.app',
    display_name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? '반올림 회원',
});

const ensureProfile = async (user: User): Promise<UserProfile | null> => {
    if (!supabase) {
        return defaultDemoProfile;
    }

    const seed = createProfileSeed(user);
    const { data, error } = await supabase
        .from('user_profiles')
        .upsert(seed, { onConflict: 'id' })
        .select('id, email, member_id, app_role, display_name, is_active')
        .single();

    if (error || !data) {
        return null;
    }

    return mapProfileRow(data);
};

const fetchProfile = async (user: User): Promise<UserProfile> => {
    if (!supabase) {
        return defaultDemoProfile;
    }

    const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, member_id, app_role, display_name, is_active')
        .eq('id', user.id)
        .maybeSingle();

    if (error) {
        throw new Error('권한 프로필을 조회하지 못했습니다.');
    }

    if (!data) {
        const createdProfile = await ensureProfile(user);
        if (!createdProfile) {
            throw new Error('권한 프로필이 없어서 새로 만들려고 했지만 실패했습니다.');
        }

        return createdProfile;
    }

    return mapProfileRow(data);
};

const getProfileErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message) {
        return `로그인은 되었지만 권한 프로필을 확인하지 못했습니다. ${error.message}`;
    }

    return '로그인은 되었지만 권한 프로필을 확인하지 못했습니다. 다시 로그인하거나 권한 다시 확인을 눌러 주세요.';
};

const getMagicLinkErrorMessage = (error: unknown) => {
    const status =
        typeof error === 'object' && error !== null && 'status' in error
            ? Number((error as { status?: number }).status)
            : null;

    if (status === 429) {
        return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return '로그인 링크를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.';
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(isSupabaseConfigured ? null : defaultDemoProfile);
    const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        const client = supabase;

        if (!isSupabaseConfigured || !client) {
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
                    setAuthError(null);
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

    const role: AppRole = profile?.appRole ?? (isSupabaseConfigured ? 'member' : 'operator');
    const permissions = useMemo(() => buildPermissions(role), [role]);

    const value = useMemo<AuthContextValue>(
        () => ({
            isLoading,
            isAuthenticated: Boolean(profile && profile.isActive),
            authError,
            user,
            session,
            profile,
            role,
            permissions,
            signInWithMagicLink: async (email: string) => {
                if (!supabase) {
                    return {};
                }

                setAuthError(null);

                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: window.location.origin,
                    },
                });

                return error ? { error: getMagicLinkErrorMessage(error) } : {};
            },
            refreshProfile: async () => {
                if (!supabase || !user) return;

                setIsLoading(true);

                try {
                    const resolvedProfile = await fetchProfile(user);
                    setProfile(resolvedProfile);
                    setAuthError(null);
                } catch (error) {
                    console.error('[auth] failed to refresh user profile', error);
                    setProfile(null);
                    setAuthError(getProfileErrorMessage(error));
                } finally {
                    setIsLoading(false);
                }
            },
            signOut: async () => {
                if (!supabase) return;
                setAuthError(null);
                await supabase.auth.signOut();
            },
        }),
        [authError, isLoading, permissions, profile, role, session, user],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
