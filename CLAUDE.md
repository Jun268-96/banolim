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

### 1. 메일 본문 링크 클릭 (implicit hash)
- supabase.ts `flowType: 'implicit'` + `detectSessionInUrl: true`
- URL 형식: `https://vanollim.vercel.app/#access_token=...&type=recovery|invite`
- AuthProvider가 hash 자동 감지 → 세션 생성 + `requiresPasswordSetup=true`
- AuthScreen이 비번 설정 폼 자동 표시
- **주의**: 메일 보안 스캐너에 토큰 소진되면 `#error=access_denied&error_code=otp_expired`로 떨어짐 → OTP 폼으로 자동 fallback

### 2. 다이얼로그 백업 링크 (admin.generateLink)
- 운영진이 `ProvisionedAccountDialog`에서 actionLink를 카톡 등으로 직접 전달
- admin 호출이라 항상 hash 포맷 → cross-device 안전
- 메일이 안 도착하거나 메일 스캐너로 망가졌을 때 사용
- **닫으면 같은 링크 재조회 불가** (보안 이유로 DB 미저장)

### 3. OTP 6자리 입력
- 메일 본문에 `{{ .Token }}` 6자리 코드도 포함됨
- AuthScreen에서 `?type=recovery|invite` 또는 `#error=otp_expired` 감지 시 자동으로 OTP 입력 폼 노출
- 또는 일반 로그인 폼 하단의 "메일 코드로 인증하기" 버튼으로 진입
- 회원이 이메일 + 6자리 입력 → `supabase.auth.verifyOtp` POST → 세션 생성 → 비번 설정 폼
- POST라 메일 스캐너 GET fetch 영향 없음

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
네이버, Gmail, M365 Defender 등 주요 메일 시스템이 사용자 클릭 **전에** invite/recovery 링크를 자동 fetch함. 그 fetch가 Supabase 입장에선 "첫 클릭"으로 처리되어 1회용 토큰 소진 → 사람이 클릭하면 `otp_expired`.

### 회피책 (이미 구현됨)
- **OTP 6자리 입력**: POST라 GET-only 스캐너 영향 없음. 1차 권장.
- **카톡 백업 링크**: admin.generateLink 응답을 다이얼로그에 노출 → 운영진이 카톡으로 직접 전달. 메일 시스템 안 거침.

### 운영 가이드
회원이 메일 링크 안 먹힌다고 하면:
1. 메일에 6자리 코드 보이는지 확인 → 있으면 OTP 입력 모드로 안내
2. 코드 없으면 운영진이 [계정 발급] 다시 → 백업 링크 카톡으로

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
| `send-push-notification` | false | 웹푸시 발송 |

배포: `mcp__claude_ai_Supabase__deploy_edge_function` (files 배열로 단일 파일 업로드).

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
