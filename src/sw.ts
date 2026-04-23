/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Workbox precaching (injected by vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Supabase REST 읽기만 런타임 캐시. /auth/v1/* (토큰·로그인), /functions/* (Edge),
// /storage/* 는 오프라인 캐시 대상이 아니다 — 예전 사용자의 응답이 새 세션에 제공되는
// 보안 리스크(ANALYSIS.md §2)를 피하고, 간헐 502 응답이 캐시 오염을 만드는 것도 막는다.
registerRoute(
  /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/i,
  new NetworkFirst({ cacheName: 'supabase-rest' }),
);

// Activate immediately
self.skipWaiting();
clientsClaim();

// --- Push notification handling ---
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const payload = event.data.json() as { title?: string; body?: string; url?: string };
  const title = payload.title ?? '반올림스쿨';
  const body = payload.body ?? '';
  const url = payload.url ?? '/';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string })?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
