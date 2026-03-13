import { createClient } from 'npm:@supabase/supabase-js@2.99.0';

type MemberRow = {
    id: string;
    name: string;
    auth_user_id: string | null;
    is_visible: boolean;
};

type UserProfileRow = {
    id: string;
    app_role: string;
    member_id: string | null;
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const jsonResponse = (status: number, payload: Record<string, unknown>) =>
    new Response(JSON.stringify(payload), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : '회원을 영구 삭제하지 못했습니다.';

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return jsonResponse(500, { error: 'Supabase 환경 변수가 설정되지 않았습니다.' });
        }

        const authorization = request.headers.get('Authorization');
        if (!authorization) {
            return jsonResponse(401, { error: '인증 헤더가 없습니다.' });
        }

        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
        const token = authorization.replace(/^Bearer\s+/i, '').trim();
        const { data: authData, error: authError } = await adminClient.auth.getUser(token);

        if (authError || !authData.user) {
            return jsonResponse(401, { error: '로그인 세션을 확인하지 못했습니다.' });
        }

        const callerUserId = authData.user.id;
        const { data: callerProfile, error: callerProfileError } = await adminClient
            .from('user_profiles')
            .select('id, app_role, member_id')
            .eq('id', callerUserId)
            .maybeSingle<UserProfileRow>();

        if (callerProfileError || !callerProfile || !['super_admin', 'operator'].includes(callerProfile.app_role)) {
            return jsonResponse(403, { error: '회원 영구 삭제 권한이 없습니다.' });
        }

        const body = await request.json().catch(() => ({}));
        const memberId = typeof body?.memberId === 'string' ? body.memberId.trim() : '';

        if (!memberId) {
            return jsonResponse(400, { error: 'memberId가 필요합니다.' });
        }

        const { data: member, error: memberError } = await adminClient
            .from('members')
            .select('id, name, auth_user_id, is_visible')
            .eq('id', memberId)
            .maybeSingle<MemberRow>();

        if (memberError || !member) {
            return jsonResponse(404, { error: '멤버 정보를 찾지 못했습니다.' });
        }

        if (member.is_visible !== false) {
            return jsonResponse(400, { error: '숨김 처리된 멤버만 영구 삭제할 수 있습니다.' });
        }

        const { count: activityCount, error: activityCountError } = await adminClient
            .from('activity_records')
            .select('id', { head: true, count: 'exact' })
            .eq('member_id', member.id);

        if (activityCountError) {
            throw activityCountError;
        }

        if ((activityCount ?? 0) > 0) {
            return jsonResponse(409, { error: '활동 기록이 남아 있는 회원은 영구 삭제할 수 없습니다.' });
        }

        const [
            badgeCountResult,
            teamLinkCountResult,
            recapCountResult,
            profileCountResult,
            attendanceEntryCountResult,
            attendanceCheckinCountResult,
        ] = await Promise.all([
            adminClient.from('member_badges').select('id', { head: true, count: 'exact' }).eq('member_id', member.id),
            adminClient.from('member_team_links').select('id', { head: true, count: 'exact' }).eq('member_id', member.id),
            adminClient.from('recap_snapshots').select('id', { head: true, count: 'exact' }).eq('member_id', member.id),
            adminClient.from('user_profiles').select('id', { head: true, count: 'exact' }).eq('member_id', member.id),
            adminClient.from('attendance_session_members').select('id', { head: true, count: 'exact' }).eq('member_id', member.id),
            adminClient.from('attendance_checkins').select('id', { head: true, count: 'exact' }).eq('member_id', member.id),
        ]);

        const countErrors = [
            badgeCountResult.error,
            teamLinkCountResult.error,
            recapCountResult.error,
            profileCountResult.error,
            attendanceEntryCountResult.error,
            attendanceCheckinCountResult.error,
        ].filter(Boolean);

        if (countErrors.length > 0) {
            throw countErrors[0];
        }

        const [
            deleteRecapsResult,
            deleteBadgesResult,
            deleteTeamLinksResult,
            deleteProfilesByMemberResult,
        ] = await Promise.all([
            adminClient.from('recap_snapshots').delete().eq('member_id', member.id),
            adminClient.from('member_badges').delete().eq('member_id', member.id),
            adminClient.from('member_team_links').delete().eq('member_id', member.id),
            adminClient.from('user_profiles').delete().eq('member_id', member.id),
        ]);

        const deleteErrors = [
            deleteRecapsResult.error,
            deleteBadgesResult.error,
            deleteTeamLinksResult.error,
            deleteProfilesByMemberResult.error,
        ].filter(Boolean);

        if (deleteErrors.length > 0) {
            throw deleteErrors[0];
        }

        let deletedAuthUser = false;

        if (member.auth_user_id) {
            const { error: deleteProfileByAuthIdError } = await adminClient
                .from('user_profiles')
                .delete()
                .eq('id', member.auth_user_id);

            if (deleteProfileByAuthIdError) {
                throw deleteProfileByAuthIdError;
            }

            const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(member.auth_user_id);
            if (deleteAuthError) {
                const message = getErrorMessage(deleteAuthError).toLowerCase();
                if (!message.includes('not found')) {
                    throw deleteAuthError;
                }
            } else {
                deletedAuthUser = true;
            }
        }

        const { error: deleteMemberError } = await adminClient
            .from('members')
            .delete()
            .eq('id', member.id);

        if (deleteMemberError) {
            throw deleteMemberError;
        }

        const { error: auditError } = await adminClient.from('audit_logs').insert({
            actor_id: callerProfile.member_id,
            entity_type: 'member',
            entity_id: member.id,
            action: 'hard_deleted',
            diff_json: {
                summary: `${member.name} 멤버 영구 삭제`,
                memberName: member.name,
                deletedAuthUser,
                relatedDeletes: {
                    memberBadges: badgeCountResult.count ?? 0,
                    memberTeamLinks: teamLinkCountResult.count ?? 0,
                    recapSnapshots: recapCountResult.count ?? 0,
                    userProfiles: profileCountResult.count ?? 0,
                    attendanceSessionMembers: attendanceEntryCountResult.count ?? 0,
                    attendanceCheckins: attendanceCheckinCountResult.count ?? 0,
                },
            },
        });

        if (auditError) {
            throw auditError;
        }

        return jsonResponse(200, {
            memberId: member.id,
            memberName: member.name,
            deletedAuthUser,
            deletedCounts: {
                memberBadges: badgeCountResult.count ?? 0,
                memberTeamLinks: teamLinkCountResult.count ?? 0,
                recapSnapshots: recapCountResult.count ?? 0,
                userProfiles: profileCountResult.count ?? 0,
                attendanceSessionMembers: attendanceEntryCountResult.count ?? 0,
                attendanceCheckins: attendanceCheckinCountResult.count ?? 0,
            },
        });
    } catch (error) {
        return jsonResponse(500, { error: getErrorMessage(error) });
    }
});
