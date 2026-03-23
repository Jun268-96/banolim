import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from '../../supabase';
import { getSupabaseClient } from '../shared/client';
import { localState } from '../shared/localState';
import { createLocalId, createTemporaryPassword, normalizeLoginEmail } from '../shared/localUtils';

export const isRegisteredLoginEmail = async (email: string): Promise<boolean> => {
    const normalizedEmail = normalizeLoginEmail(email);

    if (!normalizedEmail) {
        return false;
    }

    if (!isSupabaseConfigured) {
        return localState.members.some((member) => normalizeLoginEmail(member.loginEmail) === normalizedEmail);
    }

    try {
        const client = getSupabaseClient();
        const { data, error } = await client.rpc('is_registered_login_email', {
            p_email: normalizedEmail,
        });

        if (error) {
            throw error;
        }

        return Boolean(data);
    } catch (error) {
        console.warn('[data] isRegisteredLoginEmail failed.', error);
        throw new Error('로그인 이메일 확인에 실패했습니다. 운영진에게 인증 설정을 확인해 달라고 요청해 주세요.');
    }
};

export const completeMyPasswordSetup = async (): Promise<void> => {
    if (!isSupabaseConfigured) {
        return;
    }

    const client = getSupabaseClient();
    const { error } = await client.rpc('complete_my_password_setup');

    if (error) {
        throw error;
    }
};

export const provisionLocalPasswordAuth = async (memberId: string): Promise<{
    email: string;
    temporaryPassword: string;
    memberName: string;
    isExistingAccount: boolean;
}> => {
    const member = localState.members.find((entry) => entry.id === memberId) ?? null;

    if (!member?.loginEmail) {
        throw new Error('로그인 이메일이 등록된 멤버만 계정을 발급할 수 있습니다.');
    }

    const temporaryPassword = createTemporaryPassword();
    const provisionedAt = new Date().toISOString();

    localState.members = localState.members.map((entry) =>
        entry.id === memberId
            ? {
                ...entry,
                authUserId: entry.authUserId ?? createLocalId('auth'),
                authProvisionedAt: provisionedAt,
                passwordResetRequired: true,
                isApproved: true,
            }
            : entry,
    );

    return {
        email: member.loginEmail,
        temporaryPassword,
        memberName: member.name,
        isExistingAccount: Boolean(member.authUserId),
    };
};

export const getFunctionSessionHeaders = async () => {
    const client = getSupabaseClient();
    const {
        data: { session },
    } = await client.auth.getSession();

    if (!session?.access_token) {
        throw new Error('로그인 세션이 만료되었습니다. 다시 로그인한 뒤 다시 시도해 주세요.');
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase 함수 엔드포인트 설정이 비어 있습니다.');
    }

    return {
        url: supabaseUrl,
        anonKey: supabaseAnonKey,
        accessToken: session.access_token,
    };
};
