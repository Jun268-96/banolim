import { createClient } from 'npm:@supabase/supabase-js@2.99.0';

type MemberRow = {
    id: string;
    name: string;
    login_email: string | null;
    auth_user_id: string | null;
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const authorization = request.headers.get('Authorization');
        if (!authorization) {
            return new Response(JSON.stringify({ error: '인증 헤더가 없습니다.' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

        // verify_jwt: true로 게이트웨이에서 이미 검증됨 — JWT payload에서 직접 user ID 추출
        const token = authorization.replace(/^Bearer\s+/i, '').trim();
        const payloadBase64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadBase64)) as { sub?: string };
        const callerUserId = payload.sub;

        if (!callerUserId) {
            return new Response(JSON.stringify({ error: '인증 정보를 확인하지 못했습니다.' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }
        const { data: profile, error: profileError } = await adminClient
            .from('user_profiles')
            .select('id, app_role')
            .eq('id', callerUserId)
            .maybeSingle();

        if (profileError || !profile || !['super_admin', 'operator'].includes(profile.app_role)) {
            return new Response(JSON.stringify({ error: '계정 발급 권한이 없습니다.' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { memberId, redirectTo } = await request.json();
        if (typeof memberId !== 'string' || memberId.length === 0) {
            return new Response(JSON.stringify({ error: 'memberId가 필요합니다.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: member, error: memberError } = await adminClient
            .from('members')
            .select('id, name, login_email, auth_user_id')
            .eq('id', memberId)
            .maybeSingle<MemberRow>();

        if (memberError || !member) {
            return new Response(JSON.stringify({ error: '멤버 정보를 찾지 못했습니다.' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!member.login_email) {
            return new Response(JSON.stringify({ error: '로그인 이메일이 등록된 멤버만 계정을 발급할 수 있습니다.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const normalizedEmail = member.login_email.trim().toLowerCase();
        const inviteRedirectTo = typeof redirectTo === 'string' && redirectTo.length > 0 ? redirectTo : undefined;

        let authUserId = member.auth_user_id;
        let isExistingAccount = false;

        if (!authUserId) {
            // auth_user_id가 없어도 auth.users에 이미 존재할 수 있으므로 이메일로 직접 검색
            const searchUrl = `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=10&filter=${encodeURIComponent(normalizedEmail)}`;
            const searchRes = await fetch(searchUrl, {
                headers: {
                    apikey: supabaseServiceRoleKey,
                    Authorization: `Bearer ${supabaseServiceRoleKey}`,
                },
            });

            if (!searchRes.ok) {
                throw new Error('사용자 조회에 실패했습니다.');
            }

            const { users } = (await searchRes.json()) as { users: Array<{ id: string; email?: string }> };
            const existingUser = users.find((u) => u.email?.toLowerCase() === normalizedEmail);
            if (existingUser) {
                authUserId = existingUser.id;
                isExistingAccount = true;
            }
        } else {
            isExistingAccount = true;
        }

        let actionLink = '';
        let linkExpiresInHours = 24;

        if (isExistingAccount && authUserId) {
            // 기존 계정: 비밀번호 재설정 링크 생성 (Supabase가 메일도 자동 발송)
            const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
                type: 'recovery',
                email: normalizedEmail,
                options: {
                    redirectTo: inviteRedirectTo,
                },
            });

            if (linkError || !linkData?.properties?.action_link) {
                throw linkError ?? new Error('비밀번호 재설정 링크를 생성하지 못했습니다.');
            }

            actionLink = linkData.properties.action_link;
            linkExpiresInHours = 1;
        } else {
            // 신규 계정: 초대 링크 생성 (Supabase가 사용자 생성 + 메일도 자동 발송)
            const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
                type: 'invite',
                email: normalizedEmail,
                options: {
                    redirectTo: inviteRedirectTo,
                    data: { full_name: member.name },
                },
            });

            if (linkError || !linkData?.user || !linkData?.properties?.action_link) {
                throw linkError ?? new Error('초대 링크를 생성하지 못했습니다.');
            }

            actionLink = linkData.properties.action_link;
            authUserId = linkData.user.id;
            linkExpiresInHours = 24;
        }

        const { error: updateMemberError } = await adminClient
            .from('members')
            .update({
                auth_user_id: authUserId,
                auth_provisioned_at: new Date().toISOString(),
                password_reset_required: true,
                is_approved: true,
            })
            .eq('id', member.id);

        if (updateMemberError) {
            throw updateMemberError;
        }

        return new Response(
            JSON.stringify({
                memberId: member.id,
                memberName: member.name,
                email: normalizedEmail,
                authUserId,
                inviteSent: true,
                isExistingAccount,
                actionLink,
                linkExpiresInHours,
            }),
            {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : '계정을 발급하지 못했습니다.';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
