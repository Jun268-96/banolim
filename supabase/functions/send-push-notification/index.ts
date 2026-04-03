import { createClient } from 'npm:@supabase/supabase-js@2.99.0';
import webpush from 'npm:web-push@3.6.7';

type PushSubscriptionRow = {
    id: string;
    member_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
};

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? '';
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

Deno.serve(async (request) => {
    if (request.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { title, body, url } = (await request.json()) as {
            title: string;
            body: string;
            url?: string;
        };

        if (!title || !body) {
            return new Response(JSON.stringify({ error: 'title과 body는 필수입니다.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: subscriptions, error } = await adminClient
            .from('push_subscriptions')
            .select('id, member_id, endpoint, p256dh, auth');

        if (error) throw error;

        const rows = (subscriptions ?? []) as PushSubscriptionRow[];

        const payload = JSON.stringify({ title, body, url: url ?? '/' });
        const expiredIds: string[] = [];

        await Promise.allSettled(
            rows.map(async (row) => {
                try {
                    await webpush.sendNotification(
                        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
                        payload,
                    );
                } catch (err: unknown) {
                    const status = (err as { statusCode?: number }).statusCode;
                    if (status === 410 || status === 404) {
                        expiredIds.push(row.id);
                    }
                }
            }),
        );

        // 만료된 구독 정리
        if (expiredIds.length > 0) {
            await adminClient.from('push_subscriptions').delete().in('id', expiredIds);
        }

        return new Response(
            JSON.stringify({ sent: rows.length - expiredIds.length, removed: expiredIds.length }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (err) {
        const message = err instanceof Error ? err.message : '알 수 없는 오류';
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
