# Supabase Custom SMTP 설정

이 프로젝트는 현재 `이메일 OTP`로 로그인합니다.  
실서비스에서는 Supabase 기본 메일 발송 대신 `Custom SMTP`를 붙이는 것을 전제로 운영하는 편이 안전합니다.

## 추천 조합

- Auth: Supabase
- SMTP 제공자: Resend
- 발신 주소 예시: `auth@your-domain.com`

## 사전 준비

1. 배포 도메인과 발신 도메인을 정합니다.
2. Resend 계정을 만듭니다.
3. DNS를 수정할 수 있는 권한을 준비합니다.

## 1. Resend에서 발신 도메인 인증

1. Resend 대시보드에서 도메인을 추가합니다.
2. 안내되는 DNS 레코드를 도메인 관리자에 등록합니다.
3. 도메인 상태가 `Verified`가 될 때까지 기다립니다.
4. SMTP 또는 API 사용이 가능한 상태인지 확인합니다.

## 2. Resend SMTP 정보 준비

Resend SMTP 정보는 아래 기준으로 입력합니다.

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: Resend API key

보통 발신 주소는 인증된 도메인 하위 메일이어야 합니다.

예:

- Sender email: `auth@your-domain.com`
- Sender name: `반올림`

## 3. Supabase에 Custom SMTP 연결

Supabase Dashboard에서 아래 순서로 이동합니다.

`Authentication -> Email`

여기서 기본 이메일 발송 대신 Custom SMTP를 활성화하고 다음 값을 넣습니다.

- SMTP host: `smtp.resend.com`
- SMTP port: `465`
- SMTP user: `resend`
- SMTP pass: Resend API key
- Sender email: `auth@your-domain.com`
- Sender name: `반올림`

저장 후 테스트 메일을 보내 봅니다.

## 4. Redirect URL 확인

이 프로젝트는 OTP 로그인 뒤 현재 앱 주소로 돌아오므로, Supabase URL 설정도 함께 맞춰야 합니다.

권장값:

- Site URL: 배포 주소
- Redirect URLs:
  - 배포 주소
  - 로컬 개발 주소가 필요하면 `http://localhost:5173`
  - 필요 시 `http://127.0.0.1:5173`

## 5. 운영 전 확인

1. 운영진 계정의 `members.login_email`이 실제 이메일과 일치하는지 확인합니다.
2. 미등록 이메일로 로그인 시도 시 앱 접근이 차단되는지 확인합니다.
3. 등록된 이메일로 OTP를 받았을 때 `회원/운영진` 권한이 정상 반영되는지 확인합니다.
4. 메일이 스팸함으로 빠지지 않는지 확인합니다.

## 첫 관리자 부트스트랩 예시

```sql
update public.members
set login_email = 'hhj96916@goedu.kr'
where name = '황현준';
```

이후 해당 이메일로 로그인하면 `sync_my_profile()`가 자동으로 회원 레코드를 연결합니다.

## 현재 프로젝트 기준 체크 포인트

- 로그인 UI는 이미 `이메일 OTP 6자리 코드` 기준으로 구현되어 있습니다.
- 커스텀 SMTP는 앱 코드 수정이 아니라 Supabase/Resend 설정 작업입니다.
- SMTP를 붙여도 `members.login_email` 사전 등록 구조는 그대로 유지해야 합니다.

## 참고 링크

- Supabase Passwordless Email: https://supabase.com/docs/guides/auth/auth-email-passwordless
- Supabase + Resend integration: https://supabase.com/partners/integrations/resend
- Resend SMTP: https://resend.com/docs/knowledge-base/smtp-credentials
