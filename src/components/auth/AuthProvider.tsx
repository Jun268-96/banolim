import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AppRole, UserProfile } from '../../types';
import { buildPermissions, type AppPermissions } from '../../lib/permissions';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

interface AuthContextValue {
    isLoading: boolean;
    isAuthenticated: boolean;
    user: User | null;
    session: Session | null;
    profile: UserProfile | null;
    role: AppRole;
    permissions: AppPermissions;
    signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const defaultDemoProfile: UserProfile = {
    id: 'demo-user',
    email: 'local-demo@banollim.app',
    memberId: null,
    appRole: 'operator',
    displayName: 'Local Demo',
    isActive: true,
};

const inferProfileFromUser = (user: User): UserProfile => ({
    id: user.id,
    email: user.email ?? 'unknown@banollim.app',
    memberId: null,
    appRole: 'member',
    displayName: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? 'Banollim Member',
    isActive: true,
});

const mapProfileRow = (data: {
    id: string;
    email: string;
    member_id: string | null;
    app_role: string;
    display_name: string | null;
    is_active: boolean;
}): UserProfile => ({
    id: data.id,
    email: data.email,
    memberId: data.member_id,
    appRole: (data.app_role as AppRole) ?? 'member',
    displayName: data.display_name,
    isActive: data.is_active,
});

const ensureProfile = async (user: User): Promise<UserProfile | null> => {
    if (!supabase) {
        return defaultDemoProfile;
    }

    const inferredProfile = inferProfileFromUser(user);
    const { data, error } = await supabase
        .from('user_profiles')
        .insert({
            id: inferredProfile.id,
            email: inferredProfile.email,
            app_role: inferredProfile.appRole,
            display_name: inferredProfile.displayName ?? inferredProfile.email,
            is_active: true,
        })
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
        return inferProfileFromUser(user);
    }

    if (!data) {
        const createdProfile = await ensureProfile(user);
        return createdProfile ?? inferProfileFromUser(user);
    }

    return mapProfileRow(data);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(isSupabaseConfigured ? null : defaultDemoProfile);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const client = supabase;

        if (!isSupabaseConfigured || !client) {
            setSession(null);
            setUser(null);
            setProfile(defaultDemoProfile);
            setIsLoading(false);
            return;
        }

        let isMounted = true;

        const initialize = async () => {
            setIsLoading(true);
            const {
                data: { session: currentSession },
            } = await client.auth.getSession();

            if (!isMounted) return;

            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            if (currentSession?.user) {
                const resolvedProfile = await fetchProfile(currentSession.user);
                if (isMounted) {
                    setProfile(resolvedProfile);
                }
            } else {
                setProfile(null);
            }

            if (isMounted) {
                setIsLoading(false);
            }
        };

        void initialize();

        const {
            data: { subscription },
        } = client.auth.onAuthStateChange((_event, nextSession) => {
            setSession(nextSession);
            setUser(nextSession?.user ?? null);

            if (nextSession?.user) {
                fetchProfile(nextSession.user).then((resolvedProfile) => {
                    if (isMounted) {
                        setProfile(resolvedProfile);
                    }
                });
            } else {
                setProfile(null);
            }

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

    const value = useMemo<AuthContextValue>(
        () => ({
            isLoading,
            isAuthenticated: Boolean(profile && profile.isActive),
            user,
            session,
            profile,
            role,
            permissions: buildPermissions(role),
            signInWithMagicLink: async (email: string) => {
                if (!supabase) {
                    return {};
                }

                const { error } = await supabase.auth.signInWithOtp({
                    email,
                    options: {
                        emailRedirectTo: window.location.origin,
                    },
                });

                return error ? { error: error.message } : {};
            },
            signOut: async () => {
                if (!supabase) return;
                await supabase.auth.signOut();
            },
        }),
        [isLoading, profile, role, session, user],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const value = useContext(AuthContext);
    if (!value) {
        throw new Error('useAuth must be used within AuthProvider.');
    }

    return value;
};
