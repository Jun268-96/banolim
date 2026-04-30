# 반올림스쿨 (vanollim) — Claude 작업 가이드

학교/소모임 관리용 SPA + Supabase 백엔드. 회원·팀·점수·출석·활동기록·커뮤니티를 운영진이 관리.

## 프로젝트 메타

| 항목 | 값 |
|---|---|
| Production URL | https://vanollim.vercel.app |
| Repo | github.com/Jun268-96/banolim |
| Supabase project ID | `rmqngqehthovhcwnwjpj` |
| Supabase Studio | https://supabase.com/dashboard/project/rmqngqehthovhcwnwjpj |
| 호스팅 | Vercel (main push 시 자동 배포) |
| 빌드 | `npm run build` (`tsc -b && vite build`) |
| 스택 | React + Vite + TypeScript + Supabase (Postgres + Auth + Edge Functions) + PWA(SW) |

### 빌드 환경 노트
- macOS + cmux 환경에서 npx/npm 실행 시 `unset NODE_OPTIONS` 먼저 필요. 안 그러면 `cmux-claude-node-options/restore-node-options.cjs` 모듈 못 찾는 에러 남.
- TypeScript 타입체크는 `npx tsc -b --noEmit` 또는 빌드에 포함됨.

---

## 권한 체계 (2-layer 모델)

### Layer 1: 직책 — `public.roles`

운영팀이 회원에게 부여하는 직책. 이름은 자유롭게 추가 가능. 각 직책은 `permission_scope`로 시스템 권한과 매핑됨.

| 직책 | rank | `permission_scope` |
|---|---|---|
| 회장 | 10 | super_admin |
| 부회장 | 20 | operator |
| 기획팀장 | 30 | operator |
| 홍보팀장&총무 | 40 | operator |
| 운영팀장 | 50 | operator |
| 스터디장 | 60 | **team_lead (관리자 X)** |
| 일반회원 | 100 | member |
| 개발 관리자 | 110 | super_admin |

### Layer 2: 시스템 권한 — `public.user_profiles.app_role`

`super_admin` / `operator` / `team_lead` / `member` 4단. `roles.permission_scope`가 user_profiles로 sync됨(`sync_my_profile` RPC 등).

권한 매트릭스(`src/lib/permissions.ts:29-39`의 `buildPermissions`):

| 권한 | super_admin | operator | team_lead | member |
|---|---|---|---|---|
| canManageMembers | ✅ | ✅ | ❌ | ❌ |
| canManageSettings | ✅ | ✅ | ❌ | ❌ |
| canViewActivities | ✅ | ✅ | ✅ | ❌ |
| canViewStats | ✅ | ✅ | ✅ | ❌ |
| canModerateCommunity | ✅ | ✅ | ❌ | ❌ |

→ **스터디장(`team_lead`)은 멤버/설정/커뮤니티 관리 권한 없음.** 변경 시 두 layer 모두 일관성 유지 필요.

---

## 계정 발급 모델

### 분리된 두 테이블
- `public.members` — 운영진이 관리하는 회원 정보(이름, 팀, 직책, 점수, 활동, login_email)
- `auth.users` — Supabase 인증 객체 (비밀번호, 세션, 토큰)
- 연결: `members.auth_user_id` → `auth.users.id`

### 핵심 컬럼 (`members`)
| 컬럼 | 의미 |
|---|---|
| `login_email` | 운영진이 등록한 회원 이메일 |
| `auth_user_id` | 발급된 Supabase auth 계정 (NULL이면 미발급) |
| `auth_provisioned_at` | 발급 시각 |
| `password_reset_required` | 첫 로그인 시 비번 설정 강제 |
| `email_delivery_failed` | 직전 발급 메일 발송 실패 여부. true면 [계정 발급] 버튼 재노출 (관리자 다이얼로그) |

### 발급 흐름
1. 운영진이 회원 카드 → [계정 발급] 클릭
2. Edge Function `provision-member-auth` 호출 (`supabase/functions/provision-member-auth/`)
3. 신규: `inviteUserByEmail` (admin) → 메일 발송 + auth.users 생성
4. 기존: `resetPasswordForEmail` (regularClient, **flowType: 'implicit'**) → 메일 발송
5. 별개로 `admin.generateLink({ type: 'recovery' })`로 백업 actionLink 추출 → 다이얼로그 노출
6. members 업데이트: auth_user_id, password_reset_required=true, email_delivery_failed=!mailSent

### 응답 구조 (`provisionMemberPasswordAuth` in `src/lib/db.ts:984-`)
```ts
{
  email, memberName, isExistingAccount: boolean,
  inviteSent: boolean,            // 메일 발송 성공
  emailDeliveryFailed: boolean,   // = !inviteSent
  actionLink?: string,            // 백업 링크 (카톡 직접 전달용)
  linkExpiresInHours?: number,
}
```

---

## 인증 진입점 3가지

회원이 비밀번호를 설정하기 위해 사이트에 도달하는 경로:

### 1. 메일 본문 링크 클릭 (implicit hash) — **권장 경로**
- supabase.ts `flowType: 'implicit'` + `detectSessionInUrl: true`
- URL 형식: `https://vanollim.vercel.app/#access_token=...&type=recovery|invite`
- AuthProvider가 hash 자동 감지 → 세션 생성 + `requiresPasswordSetup=true`
- AuthScreen이 비번 설정 폼 자동 표시
- **주의**: 메일 보안 스캐너(M365 등)에 토큰 소진되면 `#error=access_denied&error_code=otp_expired`로 떨어짐 → OTP 폼으로 fallback. Gmail/네이버 개인 메일은 prefetch 안 해서 거의 영향 없음

### 2. 다이얼로그 백업 링크 (admin.generateLink) — **선제적 운영 가이드**
- 운영진이 `ProvisionedAccountDialog`에서 actionLink를 카톡 등으로 직접 전달
- admin 호출이라 항상 hash 포맷 → cross-device 안전
- 메일이 안 도착하거나 메일 스캐너로 망가졌을 때 사용
- **`@goedu.kr` / 학교·회사 메일(M365 의심) 회원은 발급 즉시 백업 링크 카톡 선제 전달 권장** — 메일 링크가 죽을 가능성 높음
- **닫으면 같은 링크 재조회 불가** (보안 이유로 DB 미저장)

### 3. OTP 6자리 입력 — **fallback 전용, 권장 X**
- 메일 본문에 `{{ .Token }}` 6자리 코드도 포함됨
- AuthScreen은 `#error=otp_expired` 감지 시에만 자동으로 OTP 입력 폼 노출 (정상 링크 hash는 가로채지 않음)
- 또는 일반 로그인 폼 하단의 "메일 코드로 인증하기" 버튼으로 수동 진입
- **현재 알 수 없는 문제로 verifyOtp가 403을 반환함**. URL token과 OTP가 같은 토큰을 공유하므로 스캐너 prefetch에도 함께 무효화됨. burst 후 디버깅 예정
- OTP 폼에는 노란 안내 박스로 "안 되면 메일 링크 또는 운영진 카톡 백업 사용" 가이드 노출됨

---

## 이메일 템플릿

### 위치
Supabase Studio → Authentication → Email Templates

### 필수 필드
- **Invite User** + **Reset Password** 둘 다 본문에 `{{ .Token }}` (OTP) + `{{ .ConfirmationURL }}` (링크) 포함
- `{{ .Token }}` 누락 시 회원이 OTP 입력 모드로 가도 메일에 코드가 없어서 막힘

### 디자인
보라 그라디언트(`#667eea → #764ba2`) + 600px 컨테이너 + OTP 박스(letter-spacing 10px). 변경 시 일관성 유지.

---

## 메일 보안 스캐너 이슈 (운영 노트)

### 현상
일부 메일 시스템(주로 기업/학교 M365 Defender)이 사용자 클릭 **전에** invite/recovery 링크를 자동 fetch함. 그 fetch가 Supabase 입장에선 "첫 클릭"으로 처리되어 1회용 토큰 소진 → 사람이 클릭하면 `otp_expired`.

### 메일 도메인별 prefetch 매트릭스 (2026-04 운영 데이터 기준)
| 도메인 | prefetch | 비고 |
|---|---|---|
| Gmail (개인) | 🟢 안 함 | 링크 정상 작동 |
| 네이버 (개인) | 🟢 안 함 | 링크 정상 작동 |
| 다음 (개인) | 🟡 약 | 거의 영향 없음 |
| **`@goedu.kr`** | 🔴 매우 강함 | M365 Defender 추정. **링크 100% 죽음** |
| 기업/학교 메일 (M365·Outlook 365) | 🔴 강함 | 선제적 카톡 백업 필요 |

### 핵심 발견: OTP도 함께 죽음
**`{{ .Token }}` (OTP)와 `{{ .ConfirmationURL }}` (링크)는 같은 backend confirmation_token을 공유**. 스캐너가 링크 GET 한 번 하면 OTP도 같이 무효화됨. POST 검증이라도 백엔드 토큰이 죽어있어 `verifyOtp`가 403 반환. **"POST면 안전" 가정은 틀렸음.**

### 회피책
- **카톡 백업 링크 (1차 권장)**: `admin.generateLink` 응답을 `ProvisionedAccountDialog`에 노출 → 운영진이 카톡으로 직접 전달. 메일 시스템 안 거침. 100% 작동.
- **OTP 6자리 입력 (보조)**: 만료된 링크 hash 도달 시 fallback으로 노출되지만, 같은 토큰 소진 문제로 학교/M365 메일에서는 함께 실패. Gmail/네이버 회원은 어차피 링크가 작동하므로 OTP 폼까지 안 옴.
- AuthScreen은 `#error=otp_expired` hash만 OTP 모드로 가로챔. 정상 링크 hash(`#access_token=...&type=recovery`)는 AuthProvider가 처리해 비번 폼으로 직진. 이전 race condition은 `fix(auth): route valid email links straight to password setup`(3f7edb7)에서 수정됨.

### 운영 가이드
1. 발급 시 **회원 메일 도메인 확인**:
   - Gmail/네이버/다음: 메일 발송만으로 OK
   - **`@goedu.kr` / 학교·회사 메일**: 발급 즉시 ProvisionedAccountDialog의 백업 링크 카톡 직접 전달
2. 회원이 "링크 안 먹혀요" 보고 시 → [재발급] 후 무조건 카톡 백업 동선
3. 회원이 "OTP 입력해도 안 돼요" 보고 시 → 메일 본문 링크 시도 안내 → 안 되면 카톡 백업

---

## Custom SMTP 설정

### 현재 상태 (2026-04~)
| 항목 | 값 |
|---|---|
| Provider | Gmail SMTP (단발성, 한 달 임시) |
| Sender | `반올림스쿨 <hhj96916@gmail.com>` |
| Host / Port | `smtp.gmail.com` / 587 |
| Auth | Gmail 계정 + 앱 비밀번호 (`myaccount.google.com/apppasswords`) |
| 한도 | Gmail 일일 500건 / Supabase rate-limit 시간당 30건 설정 |

### 도입 배경
- Built-in SMTP 시간당 2건은 발급 burst(이틀 내 30명) 대응 불가
- 도메인 없어 Resend/SES/SendGrid 등 transactional 서비스 사용 불가
- Brevo도 2024-02부터 Gmail/Yahoo/MS 정책으로 개인 메일 sender 인증 사실상 막힘
- Gmail SMTP가 도메인 없이 즉시 가능한 유일한 옵션
- 단발성 burst라 "personal email for transactional" ToS 위반 리스크 무시 가능

### 한 달 후 정리
1. Burst 종료 시점에 운영 데이터(메일 도착률, OTP 사용률, 카톡 백업 빈도) 평가
2. 장기 사용 결정되면: 도메인 구매(`vanollim.kr`/`.com`) → Resend 전환 → 무료 3,000/월
3. 폐기 결정되면: Supabase Studio → SMTP 끄기 → built-in 복귀 + Gmail 앱 비밀번호 삭제

### Supabase Auth 설정 주의사항
- **OTP 길이는 반드시 6**. UI(`AuthScreen.tsx:143` `^\d{6}$`, line 338 `maxLength={6}`)가 6자리 전제로 작성됨. Studio의 Auth Providers → Email OTP Length를 8로 바꾸면 메일에 8자리 OTP가 와도 입력칸에 안 들어감
- Custom SMTP rate limit: Authentication → Rate Limits → "Rate limit for sending emails"

---

## 데이터 정리 안전 패턴

`auth.users` 미사용 레코드(메일 미확인 + 로그인 흔적 0) 정리 시 표준 절차:

```sql
-- 1) 후보 SELECT (read-only, 데이터 변경 X)
SELECT m.id, m.name, m.login_email, m.auth_user_id,
       u.email_confirmed_at, u.last_sign_in_at, u.created_at
FROM public.members m
JOIN auth.users u ON u.id = m.auth_user_id
WHERE u.email_confirmed_at IS NULL
  AND u.last_sign_in_at IS NULL
  AND <시간 조건>
ORDER BY m.auth_provisioned_at DESC;

-- 2) 명단 확인 → 사용자 컨펌

-- 3) members 컬럼 풀기
UPDATE public.members
SET auth_user_id = NULL, auth_provisioned_at = NULL,
    password_reset_required = false, email_delivery_failed = false
WHERE id IN (...);

-- 4) auth.users 삭제 (sessions/refresh_tokens/identities CASCADE 자동)
DELETE FROM auth.users
WHERE id IN (...)
  AND id NOT IN (SELECT auth_user_id FROM public.members WHERE auth_user_id IS NOT NULL);

-- 5) 검증 SELECT (members 보존, auth 잔존 0)
```

추가 확인: `auth.audit_log_entries`, `auth.sessions`, `auth.refresh_tokens`로 실제 로그인 흔적 0 확인 후 진행.

---

## Edge Functions

| 이름 | verify_jwt | 역할 |
|---|---|---|
| `provision-member-auth` | true | 회원 [계정 발급]/[재발급] — invite/recovery 메일 + 백업 링크 발급 |
| `hard-delete-member` | true | 회원 영구 삭제 (soft delete 우회) |
| `send-push-notification` | true | 웹푸시 발송 — 운영진(super_admin/operator)만 발송 가능 |

배포: `mcp__claude_ai_Supabase__deploy_edge_function` (files 배열로 단일 파일 업로드).

### Edge Function 빌드 사각지대 ⚠️

`tsconfig.app.json`의 `include: ["src"]`가 `supabase/functions/`를 **검증 제외**한다. 이 때문에:

- 변수 shadowing (`const x` 두 번 선언), 타입 불일치, import 오타 같은 기본 SyntaxError가 `npx tsc -b`에서 통과됨
- 실제로는 Deno cold start 시점에 함수 전체가 죽음 → 사용자 영향 발생 후 발견
- 배포 전 수동 리뷰 또는 `deno check supabase/functions/<name>/index.ts` 별도 실행 권장
- `mcp__claude_ai_Supabase__deploy_edge_function`은 syntax 검증 없이 그대로 업로드함

### 신규 Edge Function 권한 검증 체크리스트

`verify_jwt: true`는 **게이트웨이 인증**만 보장(토큰 유효성). **권한 검증은 함수 내에서 별도**로 해야 한다. send-push-notification v1이 이 단계를 통째로 빠뜨려 일반 회원도 호출 가능했던 사례가 있음 (v2에서 패치).

신규 Edge Function 작성 시 다음 패턴 필수:

```typescript
// 1. Authorization 헤더 확인
const authorization = request.headers.get('Authorization');
if (!authorization) return 401;

// 2. JWT sub 추출 (게이트웨이 검증 후라 디코딩만)
const token = authorization.replace(/^Bearer\s+/i, '').trim();
const jwtPayload = JSON.parse(atob(token.split('.')[1])) as { sub?: string };
const callerUserId = jwtPayload.sub;
if (!callerUserId) return 401;

// 3. user_profiles.app_role 화이트리스트
const { data: profile } = await adminClient
  .from('user_profiles').select('app_role').eq('id', callerUserId).maybeSingle();
if (!profile || !['super_admin', 'operator'].includes(profile.app_role)) return 403;
```

레퍼런스 구현: `provision-member-auth/index.ts:25-58`, `hard-delete-member/index.ts`, `send-push-notification/index.ts:31-68` (v2). 모두 동일 패턴.

---

## PKCE vs Implicit Flow 결정 (WHY)

**현재**: 클라이언트 supabase.ts와 Edge Function `regularClient` 둘 다 `flowType: 'implicit'`.

**이유**:
- PKCE는 verifier가 발급 기기 localStorage에만 있어, 카톡 등으로 다른 기기에 링크 전달 시 토큰 교환 실패 → 일반 로그인 화면 떠버림
- 이은주 사례에서 발견된 실제 운영 문제
- OAuth/SSO 미사용(`signInWithPassword` only)이라 PKCE 보안 이점 거의 없음
- implicit으로 hash 토큰 직접 전달 → 어떤 기기에서 열어도 작동

**바꿀 때 주의**: PKCE로 되돌리면 cross-device 시나리오 다시 깨짐. 변경 전에 OTP fallback이 충분히 작동하는지 검증 필요.

---

## 코드 패턴 (반복 적용 룰)

### 후속 게이트는 setter에서 명시 평가

`supabase.auth.updateUser({ password })`처럼 인증 상태를 바꾸는 호출은 `USER_UPDATED` 이벤트를 발화시켜 `onAuthStateChange` 리스너의 `resolveProfile`을 백그라운드로 다시 돌린다. 동시에 호출자(예: `updatePassword`)가 직접 `setRequiresPasswordSetup(false)` 같은 게이트 해제를 commit하면 두 경로가 race를 만들어, `requiresConsent` 같은 후속 게이트가 늦게 set되는 사이 `isAuthenticated=true`로 잠깐 평가됨 → dashboard 깜빡임 발생.

**룰**: 인증 상태를 바꾸는 함수는 그 함수 안에서 후속 게이트(consent, role, profile)도 **명시적으로 await + setState** 후 마지막에 본 게이트 해제. 백그라운드 `onAuthStateChange`에 의존 X. 레퍼런스: `AuthProvider.tsx:374-385` `updatePassword` (커밋 efc60e7).

### 버전 관리 catalog enrich는 archived 별도 조회로 보충

`point_rule_catalog`처럼 새 버전 만들면 이전 버전을 `is_active=false`로 마킹하는 catalog는 active-only fetch(`getCategories`)로만 enrich하면 ledger·log·history가 가리키는 archived ID가 누락 → "알 수 없는 규칙" 같은 fallback 노출.

**룰**: catalog enrich 시 (1) 1차로 active만 모아 Map 구성 (2) 데이터 행에서 가리키는 ID 중 Map에 없는 것만 `Set`으로 모음 (3) inactive 포함 별도 조회로 이름만 보충. 레퍼런스: `db.ts:1389-1404` `getLogs` (커밋 55a39ad).

---

## 자주 보는 파일

| 영역 | 파일 |
|---|---|
| Supabase 클라이언트 | `src/lib/supabase.ts` |
| 인증 컨텍스트 | `src/components/auth/AuthProvider.tsx`, `auth-context.ts` |
| 인증 화면 (로그인/비번설정/OTP) | `src/components/auth/AuthScreen.tsx` |
| 권한 정의 | `src/lib/permissions.ts` |
| 회원 도메인 타입 | `src/types/index.ts` (Member 인터페이스) |
| DB 타입 | `src/types/database.ts` (Supabase 자동생성 + 수동 동기화) |
| 회원 fetch/매핑 | `src/lib/db.ts` (`getMembers`, `provisionMemberPasswordAuth`) |
| 회원 관리 UI | `src/components/dashboard/DashboardTab.tsx`, `dialogs/MemberAccountDialog.tsx`, `dialogs/ProvisionedAccountDialog.tsx` |
| Edge Functions | `supabase/functions/<name>/index.ts` |
| 마이그레이션 | `supabase/migrations/<timestamp>_<name>.sql` |

---

## 개인정보 동의 시스템 (PIPA 준수, 2026-04-26 도입)

### 운영 조건 (사용자 확정)
- 회원은 모두 **만 14세 이상** → 제22조의2 법정대리인 동의 절차 없음
- **학생·회원 자율 운영 사적 모임** → 제15조 1항 3호(공공기관 면제) 적용 불가, 처리방침·CPO 의무 운영진 직접 부담

### 동의 항목 (`public.member_consents.consent_type`)
| type | version | 분류 | 동작 |
|---|---|---|---|
| `required_v1` | 1 | **필수** | 미체크 시 가입 불가 |
| `overseas_transfer_v1` | 1 | **필수** | 미체크 시 가입 불가 (Supabase·Vercel·Google 모두 미국 서버라 거부 시 운영 불가) |
| `push_token_v1` | 1 | 선택 | 미체크해도 가입 가능, 푸시 알림만 미발송 |
| `marketing_v1` | (미사용) | 선택 | 향후 도입 대비 — 현재 호출 코드 없음 |

`REQUIRED_CONSENTS` 배열(`src/lib/db.ts`)에 정의된 모든 항목이 `agreed=true`여야 통과. 추가/제거 시 이 배열만 갱신하면 자동 반영됨.

### DB
- 테이블: `public.member_consents` — 같은 `(member_id, consent_type, consent_version)`은 행 1개로 갱신(감사 로그)
- RLS: 본인 또는 super_admin/operator만 SELECT. INSERT/UPDATE/DELETE 정책 없음 → RPC 통해서만 변경
- RPC: `record_my_consent(p_consent_type, p_consent_version, p_agreed)`, `get_my_consent_status()` (security definer)

### 게이트 흐름
1. 회원이 비번 설정(`AuthScreen` requiresPasswordReset) 후 → `AuthProvider.evaluateConsentStatus()`가 `get_my_consent_status` 호출
2. 필수 동의 미완료면 `requiresConsent=true` → `isAuthenticated=false`로 떨어져 dashboard 차단
3. `AuthShell`이 `requiresConsent && !requiresPasswordSetup && session` 분기에서 풀스크린 `ConsentForm` 강제 노출
4. 동의 후 `refreshConsentStatus()` 호출로 상태 갱신 → dashboard 진입

### 처리방침
- 페이지: `src/components/legal/PrivacyPolicy.tsx` — 11개 섹션(목적·항목·기간·국외이전·CPO 등 제30조)
- 라우팅: `/privacy` SPA 경로 (`vercel.json`에 SPA fallback rewrites)
- 버전 상수: `PRIVACY_POLICY_VERSION` (현재 v1, 시행일 2026-04-26)
- **CPO**: "사이트 관리자" / `hhj96916@gmail.com` (9번 섹션) — 책임자 변경 시 이 파일 수정
- AuthScreen 비번 설정 폼에서 `target="_blank"`로 새 탭 링크
- ConsentForm에서 `usePrivacyOverlay`로 same-origin overlay 노출

### 처리방침 변경 시 재동의 받는 패턴
처리방침 수정 → `PRIVACY_POLICY_VERSION` 올림 → `REQUIRED_CONSENTS`에 새 버전(`required_v2` 등) 추가 → `record_my_consent`로 새 행 INSERT. 회원이 다음 로그인 시 ConsentForm 다시 노출됨(이전 버전 v1 동의는 더 이상 필수 충족 못 시킴).

---

## 운영 노트: Supabase 마이그레이션 적용

### 히스토리 불일치 (현재 상태)
- 로컬 파일명: 8자리 `20260426_*.sql`
- 원격 `supabase_migrations` 테이블: 14자리 `20260422221714` 형식 9개가 따로 등록됨 (이전 운영자가 Studio에서 직접 적용한 흔적)
- → `supabase db push`는 모든 로컬 마이그레이션을 재적용하려 시도해 충돌. **사용 금지**.

### 표준 적용 경로 — Studio SQL Editor
1. SQL을 클립보드에 복사: `pbcopy < supabase/migrations/<file>.sql`
2. Studio 열기: `open -a "Google Chrome" "https://supabase.com/dashboard/project/rmqngqehthovhcwnwjpj/sql/new"`
3. 사용자가 ⌘V → [Run] 클릭
4. 모든 마이그레이션은 **idempotent** 작성 (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `DROP ... IF EXISTS` 후 재생성) — 실수로 재실행돼도 안전

### MCP/CLI 자동 적용 시도가 막힌 이유 (확인됨)
- `mcp__claude_ai_Supabase__*` 도구는 일부 세션에서만 deferred로 노출됨. 항상 ToolSearch로 사전 확인 필요
- macOS keychain `Supabase CLI` 항목의 토큰은 78자 — Personal Access Token(`sbp_…`) 형식 아님, Management API 401
- `psql` 미설치
- 자동 경로가 막히면 위 Studio 직접 적용이 가장 빠름
