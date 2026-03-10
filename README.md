# 반올림

반올림 연구회 운영을 위한 웹 애플리케이션입니다.  
프런트엔드는 `Vite + React + TypeScript`, 백엔드는 `Supabase`를 사용합니다.

## 주요 기능

- 회원/팀/역할 관리
- 활동 기록 및 점수 반영
- 정기모임 출석 일괄 입력
- 활동 취소 및 운영 감사 로그
- 일반 회원 전용 `내 상태` 화면
- 사전 등록 이메일 기반 OTP 로그인

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

정적 검사:

```bash
npm run lint
```

## 환경 변수

`.env`에 아래 값을 넣으면 Supabase 모드로 동작합니다.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_BYPASS_AUTH=false
VITE_BYPASS_AUTH_EMAIL=admin@banollim.app
VITE_BYPASS_AUTH_NAME=개발 최고 관리자
```

값이 비어 있으면 로컬 mock 데이터로 동작합니다.

개발 중 로그인 없이 바로 최고 관리자로 진입하려면:

```env
VITE_BYPASS_AUTH=true
```

이 경우 로그인 화면을 건너뛰고 로컬 mock 데이터 기준 최고 관리자로 바로 진입합니다.

## 인증 구조

- 로그인 방식은 `이메일 OTP 6자리 코드`입니다.
- 로그인 후에는 `sync_my_profile()` RPC가 실행됩니다.
- 이 RPC는 `members.login_email`과 실제 로그인 이메일을 대조해 `user_profiles.member_id`를 자동 연결합니다.
- 미리 등록되지 않은 이메일은 로그인 자체는 될 수 있어도 앱 접근은 차단됩니다.

초기 운영자 연결은 `members.login_email`을 먼저 등록한 뒤 로그인해야 합니다.

## 운영 문서

- 제품 요구사항: [init.md](/Users/hhj/Documents/My%20Project/반올림/init.md)
- 커스텀 SMTP 설정: [docs/custom-smtp-resend.md](/Users/hhj/Documents/My%20Project/반올림/docs/custom-smtp-resend.md)
- Supabase 마이그레이션:
  - [20260310_audit_logs_and_attendance.sql](/Users/hhj/Documents/My%20Project/반올림/supabase/migrations/20260310_audit_logs_and_attendance.sql)
  - [20260310_member_scope_and_self_view.sql](/Users/hhj/Documents/My%20Project/반올림/supabase/migrations/20260310_member_scope_and_self_view.sql)
  - [20260310_registered_email_identity.sql](/Users/hhj/Documents/My%20Project/반올림/supabase/migrations/20260310_registered_email_identity.sql)
