import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/api/shared/client';
import { isSupabaseConfigured } from '../lib/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const DISMISSED_KEY = 'push_notification_dismissed';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const buffer = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        buffer[i] = rawData.charCodeAt(i);
    }
    return buffer.buffer;
}

async function getMemberId(): Promise<string | null> {
    if (!isSupabaseConfigured) return null;
    const client = getSupabaseClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return null;
    const { data } = await client
        .from('members')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();
    return data?.id ?? null;
}

async function getCurrentSubscription(): Promise<PushSubscription | null> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
}

// push_subscriptions 테이블은 자동생성 타입에 없으므로 any 클라이언트로 접근
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPushClient() {
    return getSupabaseClient() as unknown as { from: (table: string) => any };
}

export type PushStatus = 'subscribed' | 'denied' | 'default' | 'unsupported';

export function usePushNotification() {
    const [status, setStatus] = useState<PushStatus>('default');

    useEffect(() => {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) {
            setStatus('unsupported');
            return;
        }
        if (Notification.permission === 'denied') {
            setStatus('denied');
            return;
        }
        void getCurrentSubscription().then((sub) => {
            if (sub) setStatus('subscribed');
        });
    }, []);

    const isDismissed = typeof localStorage !== 'undefined'
        && localStorage.getItem(DISMISSED_KEY) === '1';

    const showBanner =
        status === 'default' &&
        !isDismissed &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        Boolean(VAPID_PUBLIC_KEY);

    const subscribe = async () => {
        if (!VAPID_PUBLIC_KEY) return;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                setStatus('denied');
                return;
            }
            // 허용 즉시 배너를 숨김 — 구독 저장은 백그라운드에서 계속
            setStatus('subscribed');
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            const json = sub.toJSON();
            const memberId = await getMemberId();
            if (memberId && isSupabaseConfigured) {
                await getPushClient().from('push_subscriptions').upsert({
                    member_id: memberId,
                    endpoint: json.endpoint ?? '',
                    p256dh: json.keys?.p256dh ?? '',
                    auth: json.keys?.auth ?? '',
                });
            }
        } catch {
            setStatus('denied');
        }
    };

    const unsubscribe = async () => {
        const sub = await getCurrentSubscription();
        if (!sub) return;
        await sub.unsubscribe();
        if (isSupabaseConfigured) {
            await getPushClient().from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        }
        setStatus('default');
    };

    const dismiss = () => {
        localStorage.setItem(DISMISSED_KEY, '1');
        setStatus('denied');
    };

    return { status, showBanner, subscribe, unsubscribe, dismiss };
}
