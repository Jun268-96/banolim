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
