# 반올림 프로젝트 종합 분석 보고서

> 작성일: 2026-04-22
> 대상: 반올림 연구회 운영 웹앱 (Vite + React 19 + TS + Supabase + PWA)
> 분석 방식: Claude Code의 Explore 에이전트 3종 병렬 + `sc:analyze` skill 기반 정적 분석

---

## Executive Summary

반올림은 React 19 + Vite 7 + Supabase + PWA 기반의 연구회 운영 웹앱으로, 컴포넌트 계층화·API 경계 분리·PWA 푸시 등 **현대 프런트엔드의 좋은 관행을 대부분 적용**한 완성도 높은 프로젝트다. 다만 다음과 같은 핵심 리스크가 있다:

- RLS 정책에서 `anon` 읽기 허용 범위가 과해 민감 뷰(`member_score_summary`, `activity_log_feed`) 잠재 노출 가능
- 낙관적 업데이트의 snapshot 클로저 패턴에 rollback 실패 리스크
- `src/lib/db.ts` 4168줄이 여전히 거대 (리팩토링 진행 중)
- 테스트 커버리지 약 2%(413줄/19913줄)
- `alert()/confirm()` 15곳 사용으로 UX·접근성 부채

`any` 직접 사용은 0건으로 타입 안정성은 우수한 편이다.

---

## 1. 아키텍처 평가

### 강점

- **엔트리 간결성** (`src/App.tsx:31-61`): 권한으로 탭 필터 → 허용된 것 중 첫 탭 자동 선택 → `React.lazy`+`Suspense`로 탭별 청크 분리. 71줄 안에 라우팅·권한·코드 분할이 단정하게 들어있다.
- **관심사 분리 4계층**: `components/`(UI) / `hooks/`(도메인 상태) / `lib/api/`(서버 통신) / `lib/domain/`(순수 로직). 특히 `lib/api/{admin,activities,auth,member,stats}`로 도메인 경계가 명확하고 `shared/{client,errors,fallbackState,localState}`로 횡단 관심사 분리.
- **권한 2중 방어**: 프런트 `buildPermissions()` (`src/lib/permissions.ts:26-33`)와 DB `can_manage_admin_tables()`/`can_manage_activities()` (`supabase/policies.sql`). 클라이언트 우회해도 DB가 막는다.
- **낙관적 업데이트 도입**: `useSettingsResources.ts:124-181`에서 `removeAnnouncement`/`removeScheduleEvent`/`removeSiteBanner`/`removeBadge`/`moveSiteBannerLocally` 모두 rollback 함수 반환 패턴으로 통일.
- **PWA Workbox 통합**: `vite-plugin-pwa` injectManifest + `src/sw.ts` 커스텀 로직으로 Supabase API `NetworkFirst` 캐싱 + push 알림.

### 약점

- **`src/lib/db.ts` 4168줄·69개 export**가 여전히 단일 파일. `refactoring.md`에 "facade 축소 중"으로 기재되어 있으나 현시점 가장 큰 기술 부채. `lib/api/*`로 이관된 부분과 공존하여 **"어디서 import해야 하는가"가 모호**.
- **대형 컴포넌트 잔존**: `DashboardTab.tsx` 1124줄, `SettingsTab.tsx` 667줄, `MembersTableSection.tsx` 609줄. 섹션 분리는 되었지만 여전히 단일 파일 책임이 크다.
- **권한 플래그 누락**: `AppPermissions`에 `canManageActivities`/`canManageMembers` 등은 있지만 **team_lead 전용 권한 플래그가 없어**, `canViewActivities`만으로 UI에서 "조회 vs 기록 생성"을 구분하기 어렵다. 기록 생성은 DB가 막아주지만 버튼 노출 여부가 일관되지 않을 가능성.

---

## 2. 보안 이슈

### 🔴 High — RLS `anon` 읽기 허용 범위 과다

`supabase/policies.sql:3-18` + `:75, :84, :91, :121, :135, :142` 라인에서 아래 오브젝트가 **`anon`(비로그인)에 select 허용**된다:

| 객체 | 파급 |
|------|------|
| `member_score_summary` (뷰) | **회원별 점수 요약 추정 노출** (이름·점수 포함 시 심각) |
| `activity_log_feed` (뷰) | **활동 피드 공개** — 누가 언제 뭘 했는지 |
| `point_rule_catalog` | 내부 점수 규칙 — 운영 전략 노출 |
| `roles`, `teams`, `seasons`, `activity_groups`, `activity_types`, `point_rules` | 조직 구조 탐색 가능 |

`members` 본체는 `authenticated` + `can_access_member(id)`로 올바르게 막혀있지만, **뷰의 `grant` 만으로 본체 RLS 우회 가능**한 것이 포인트. 두 뷰의 실제 컬럼을 확인하고, 필요하면 `security_invoker=on` 뷰로 바꾸거나 `anon` 권한을 회수해야 한다.

### 🟠 Medium — `activity_records` INSERT/UPDATE 정책 DROP만

`supabase/policies.sql:150-156` — `activity_records_insert_all`/`_update_all` 정책을 `drop`만 하고 `create`하지 않는다. RLS는 enabled 상태이므로 **authenticated라도 직접 insert/update 불가**, RPC(`create_activity_entry` 등)로만 변경 가능한 구조. **설계 의도면 OK**이나, 주석이 없어 향후 기여자가 오해할 여지가 크다 → `comment on policy` 또는 마이그레이션에 설계 의도 명시 권장.

### 🟠 Medium — `VITE_BYPASS_AUTH` 프로덕션 빌드 리스크

`src/lib/supabase.ts:6-10`: `VITE_BYPASS_AUTH=true`로 빌드되면 `isSupabaseConfigured = false` → **Supabase 클라이언트 자체가 `null`**, 앱이 로컬 mock 데이터로 동작하고 고정 super_admin으로 로그인됨 (`AuthProvider.tsx:20-28`). `.env`는 `.gitignore`에 포함되어 있으나 **CI/CD에 이 값이 검증되지 않으면 사고**. Netlify/Vercel 환경변수에 `VITE_BYPASS_AUTH=false` 강제와 빌드 시 `tsc`가 아닌 **런타임 가드**로 `import.meta.env.PROD && isAuthBypassed` 시 `throw`를 권장한다.

### 🟡 Low — 푸시 전송 fire-and-forget 모니터링 없음

`src/lib/db.ts:51-62` — `sendPushNotification` 실패 시 `.catch(() => {})`. 의도적 fire-and-forget이지만 **실패율을 모니터링할 훅이 없다**. 프로덕션에서 알림이 누락되어도 감지 불가.

### 🟡 Low — Service Worker `NetworkFirst` 캐시 잔존

`src/sw.ts:14-17` — Supabase API 전체가 NetworkFirst 캐싱. 로그아웃 후 다른 계정이 같은 기기에서 첫 요청을 할 때 **오프라인이면 이전 사용자의 응답이 제공될 수 있다**. `/auth/v1/*`는 캐시 제외 규칙 추가 권장.

---

## 3. 품질 이슈

### 🔴 낙관적 업데이트 snapshot 클로저 — rollback 실패 가능성

`src/components/settings/hooks/useSettingsResources.ts:124-165` 패턴:

```ts
const removeAnnouncement = useCallback((id: string) => {
  let snapshot: AnnouncementItem[] = [];
  setResources((prev) => {
    snapshot = prev.announcements;      // ← setter 내부에서 캡처
    return { ...prev, announcements: prev.announcements.filter(...) };
  });
  return () => setResources((prev) => ({ ...prev, announcements: snapshot }));
}, []);
```

**문제**: React StrictMode(dev)는 setter를 2회 호출한다. 두 번째 호출에서 `prev.announcements`는 **이미 필터된 결과**이므로 `snapshot`에 **필터된 값이 덮어써짐**. 그 후 rollback이 실행되면 **이미 제거된 상태 그대로 복구되어 복구가 무용지물**이 된다. 프로덕션(non-strict)에서도 React 동시성 기능으로 인해 동일 setter가 여러 번 invoke될 가능성이 있다.

**수정**: setter 바깥에서 snapshot 캡처하거나 `functional snapshot` 보장:

```ts
const removeAnnouncement = useCallback((id: string) => {
  let snapshot: AnnouncementItem[] | null = null;
  setResources((prev) => {
    if (snapshot === null) snapshot = prev.announcements;  // 최초 한 번만
    return { ...prev, announcements: prev.announcements.filter(...) };
  });
  return () => setResources((prev) => ({
    ...prev,
    announcements: snapshot ?? prev.announcements,
  }));
}, []);
```

혹은 외부 `useRef`로 스냅샷 저장 → 더 안전. 동일 패턴이 5곳(announcement/schedule/banner/badge/banner 이동)에 반복된다.

### 🟠 `alert()/confirm()` 15회 — UX·접근성 부채

- `SettingsTab.tsx`: 7회 (공지·일정·배너·배지·초기화 플로우 전반)
- `DashboardTab.tsx`: 2회 (멤버 관리)
- `PointRulesManager.tsx`: 2회, `RoleSettingsDialog.tsx`: 1회

브라우저 네이티브 다이얼로그는 **iOS PWA에서 포커스 빼앗김**, 스크린 리더 레이블 없음, 스타일링 불가, 테스트 어려움. 이미 `AppDialog` 공용 컴포넌트가 있으므로 `useConfirm()` 훅 + Toast 알림 라이브러리(간단한 `src/components/shared/`) 도입 권장.

### 🟠 테스트 커버리지 약 2.07% (413/19913줄)

존재하는 5개 테스트:

- `src/lib/permissions.test.ts` (37줄)
- `src/lib/badges.test.ts` (156줄)
- `src/lib/domain/activityLogs.test.ts` (55줄)
- `src/lib/domain/attendance.test.ts` (42줄)
- `src/lib/api/mappers/results.test.ts` (123줄)

**모두 순수 함수 테스트만 있고 훅·컴포넌트·API 호출 테스트 전무**. 우선 보강 대상:

1. `useSettingsResources` — rollback 경로 (위 P0 버그 회귀 방지)
2. `AuthProvider` — BYPASS/정상/미등록 이메일 3경로
3. `lib/api/mappers/*` — DB row → 도메인 타입 변환 (이미 1개 있음, 확장)
4. `lib/permissions.test.ts` — team_lead 경계 케이스 보강 (현재 37줄)

### 🟡 `as X` 캐스팅 29회

대부분 `event.target.value as EnumType` 형태로 HTML select 값을 TS enum으로 강제. React 일반 패턴이나, **runtime validation이 없어 HTML이 조작되면 `undefined` 전파**. `zod` 또는 얇은 guard 함수 도입 시 안전.

### 🟡 대형 파일 잔존

| 파일 | 라인 | 비고 |
|------|-----|-----|
| `src/lib/db.ts` | 4168 | **69 export, 최우선 분해 대상** |
| `src/types/database.ts` | 983 | Supabase gen-types. 자동 생성이면 OK |
| `src/components/dashboard/DashboardTab.tsx` | 1124 | 섹션/다이얼로그 분리됐으나 본체 큼 |
| `src/components/settings/SettingsTab.tsx` | 667 | alert/confirm 7회 집중 |
| `src/components/activities/AttendanceSessionManager.tsx` | 606 | 분리 여지 |

---

## 4. 성능 리스크

- **Chart.js `ChartJS.register(...)` 중복 호출** 여지 — `StatsTab.tsx:6` + 각 차트 컴포넌트. 단일 모듈 top-level에서 한 번만 등록되도록 이미 되어 있으면 OK (추가 확인 필요).
- **`useSettingsResources` 초기 로드 + `refreshData`가 동일 Promise.all을 2벌 코드로 유지** (`useSettingsResources.ts:47-68, 70-103`). 내부 `initialize`가 `refreshData`를 호출하지 않고 중복 구현. 유지보수 리스크 + 두 경로의 `setIsLoading` 타이밍 차이 발생 가능.
- **`DashboardTab.tsx:1124`줄 단일 컴포넌트** — React 19 컴파일러가 돕지만 섹션별 `memo`가 없으면 필터 변경 시 전체 재렌더.
- **`src/sw.ts:14-17`의 Supabase 전 URL NetworkFirst 캐싱** — `/auth/v1/*`, `/functions/v1/send-push-notification` 등도 포함. 인증·쓰기 요청이 캐시되지 않도록 URL 필터 세분화 필요.

---

## 5. 우선순위 권고

### 🔴 P0 — 이번 주 내

1. **RLS `anon` 권한 축소** (`supabase/policies.sql:3-18`): `member_score_summary`, `activity_log_feed`, `point_rule_catalog`의 `anon` 권한을 `authenticated`로 이전. 필요한 뷰는 `security_invoker=on`으로 설정해 본체 RLS 상속. ← **가장 큰 보안 개선**
2. **낙관적 업데이트 snapshot 클로저 버그 수정** (`useSettingsResources.ts:124-181` 5곳): 위에 제시한 `if (snapshot === null)` 가드 또는 `useRef` 기반으로 리팩토링. 동시에 rollback 경로 vitest 추가.
3. **`VITE_BYPASS_AUTH` 프로덕션 런타임 가드**: `src/lib/supabase.ts`에 `if (import.meta.env.PROD && isAuthBypassed) throw new Error(...)` 추가.

### 🟠 P1 — 2~4주

4. **`src/lib/db.ts` 4168줄 분해 마무리**: `refactoring.md`에 이미 계획 존재. 남은 69 export를 `lib/api/{domain}/{action}.ts`로 이관 후 `db.ts`는 얇은 re-export만.
5. **alert/confirm → 공용 Confirm 다이얼로그 + Toast**: `src/components/shared/AppDialog`를 확장해 `useConfirm()` 훅 도입 후 15곳 치환.
6. **핵심 훅 테스트 추가**: `useSettingsResources`, `AuthProvider`, `useAuth` — 최소 rollback·권한 전환·BYPASS 분기 커버.
7. **권한 플래그 세분화**: `AppPermissions`에 `canRecordActivity`(team_lead 포함) 추가, UI에서 "조회 vs 기록 생성" 구분.

### 🟡 P2 — 분기

8. **접근성 기반 작업**: `aria-label` 14개 / `role` 속성 0개. 테이블 `role="table"`, 다이얼로그 `aria-labelledby`, 폼 오류 `aria-invalid`+`aria-describedby` 도입.
9. **Service Worker 캐시 URL 필터**: `NetworkFirst` 매처에 `/rest/v1/*` 범위 한정, `/auth/v1/*`·`/functions/*` 제외.
10. **대형 컴포넌트 추가 분해**: `DashboardTab.tsx`, `SettingsTab.tsx`를 섹션 단위 파일로 완전 분리.

### ⚪ P3 — 장기

11. **런타임 타입 검증 도입** (zod): `as X` 캐스팅 29곳을 guard로 대체.
12. **푸시 실패 모니터링**: Sentry/`performance.mark` 등 간단 텔레메트리.
13. **`activity_records` RLS 설계 의도 주석화**.

---

## 맺음말

반올림은 **PRD(`init.md`) → 구현 → 리팩토링 로그(`refactoring.md`) → DB 계약(`docs/db-contracts.md`) 문서화 순환**이 잘 잡혀있고, PWA·낙관적 업데이트·권한 이중화 등 **운영 품질을 의식한 설계 판단**이 곳곳에 보인다. 가장 먼저 다뤄야 할 것은 **RLS `anon` 범위 축소**와 **낙관적 업데이트 snapshot 버그 수정** 두 가지이며, 이후 테스트·`db.ts` 분해로 리팩토링 속도를 회복하는 것이 합리적인 다음 단계다.
