# Refactoring Plan

작성일: 2026-03-14  
대상 프로젝트: 반올림 운영 플랫폼

## 1. 문서 목적

이 문서는 현재 프로젝트의 구조적 문제를 기준으로, 실제 실행 가능한 리팩토링 계획을 정리한 문서다.  
목표는 코드 정리를 위한 정리가 아니라 아래 4가지를 동시에 달성하는 것이다.

- 기능 추가 속도 회복
- 파괴적 기능 변경 시 회귀 위험 감소
- SQL/타입/프론트 계약 불일치 방지
- 탭 단위 대형 컴포넌트와 단일 데이터 계층 병목 해소

이 문서는 다음 내용을 포함한다.

- 현재 구조 진단
- 세부 리스크 분석
- 선행 결정 사항
- 목표 구조
- 브랜치 전략
- 브랜치별 작업 범위와 산출물
- 실행 순서
- 검증 및 완료 기준

## Progress

- [x] 리팩토링 계획 문서 작성
- [x] 테스트 기반 도입
- [x] DB 계약 관리 규칙 정리
- [x] `db.ts` 분해 기반 생성
- [x] `SettingsTab` 분해
- [x] `DashboardTab` 분해
- [x] 관리자 도메인 API 분리
- [x] `MemberHomeTab` 분해
- [x] 활동/통계 도메인 규칙 공통화
- [x] `ActivitiesTab` 섹션/다이얼로그 분해
- [x] `StatsTab` 섹션 분해
- [x] 탭 lazy loading 적용
- [x] `db.ts` 공통 상태/헬퍼 분리
- [x] destructive flow 테스트 확대
- [ ] 읽기 전용 API wrapper 독립 구현 확대
- [ ] mutating API wrapper 독립 구현 확대
- [ ] `db.ts` facade 얇은 re-export 수준으로 축소

## Current Focus

- 현재 진행 상태: UI 분해와 공통 도메인 정리 완료
- 현재 진행 중: `lib/api`의 `db.ts` 직접 재수출 제거와 facade 축소

## Recent Progress Notes

- Vitest, jsdom, RTL 기반 테스트 러너 추가
- `npm run test` 스크립트 추가
- `badges.ts`, `permissions.ts` 기본 테스트 추가
- DB 계약 운영 문서 `docs/db-contracts.md` 추가
- `src/lib/api/shared/*`, `src/lib/api/mappers/*` 기반 폴더 생성
- `db.ts`에서 공통 error/record helper와 badge/result mapper 일부 분리
- `SettingsTab`에서 공통 섹션 프리미티브와 `BadgeSection` 분리 시작
- `SettingsTab`에서 `AnnouncementSection`, `ScheduleSection`, `SeasonSection`, `DataResetSection` 분리
- `useSettingsResources` hook으로 설정 탭 데이터 로딩/새로고침 책임 분리
- `BadgeDeleteDialog`, `DataResetDialog` 분리로 destructive 다이얼로그를 탭 본체에서 분리
- `SeasonCreateDialog`, `AnnouncementCreateDialog`, `ScheduleCreateDialog`, `BannerManagementDialog`, `BadgeEditorDialog` 분리
- `SettingsTab` 본문 라인 수를 1653 → 632 수준으로 축소
- `SettingsTab`은 섹션/모달/데이터 로딩이 모두 분리되어 체크리스트 완료 처리
- `useDashboardResources` hook으로 멤버/역할/팀/감사로그 로딩 분리
- `HistorySection`, `HiddenMembersSection` 분리로 `DashboardTab` 하단 아코디언 영역 분해 시작
- `AddTeamDialog`, `EditTeamDialog`, `TeamAssignmentDialog`, `TeamDeleteDialog` 분리
- `AddMemberDialog`, `OnboardingGuideDialog`, `ProvisionedAccountDialog`, `HiddenMemberDeleteDialog` 분리
- `BulkImportDialog`, `AccessQueueDialog` 분리로 대량 등록/접근 준비 큐를 본체에서 제거
- `TeamsSection`, `OrganizationSection`, `MembersTableSection`, `DashboardHeaderSection` 분리
- `DashboardTab` 본문 라인 수를 2717 → 1201 수준으로 축소
- `DashboardTab`은 표시 섹션/모달/데이터 로딩이 분리되어 체크리스트 완료 처리
- `src/lib/api/admin/{members,roles,teams,settings}.ts` 생성으로 관리자 API 경계 파일 추가
- `DashboardTab`, `RoleSettingsDialog`, `useDashboardResources`, `SettingsTab`, `useSettingsResources`에서 `lib/db` 직접 import 제거
- 관리자/회원/홈/활동/통계/레이아웃/인증 화면 모두 `lib/db` 직접 import를 제거하고 도메인 API 경계 파일을 통해 연결되도록 정리
- `MemberBadgeSection`, `MemberAccountSection` 분리로 `MemberHomeTab` 하단 섹션 분해 시작
- `MemberHomeOverviewSection`, `MemberActivitySection`, `MemberRecapSection`, `useMemberHomeResources` 추가
- `src/lib/api/member/self.ts` 생성으로 회원 화면 API 경계 파일 추가
- `MemberHomeTab` 본문 라인 수를 1078 → 493 수준으로 축소
- `App.tsx`에서 탭 컴포넌트를 `React.lazy` + `Suspense`로 전환해 탭 단위 청크 분리 적용
- 빌드 결과 메인 청크는 약 480kB 수준으로 감소했고, `DashboardTab`, `SettingsTab`, `MemberHomeTab`, `ActivitiesTab`, `StatsTab`이 별도 청크로 분리됨
- `src/lib/domain/attendance.ts` 추가로 출석 규칙 매칭, 대상 필터, 대상 라벨 계산을 공통 도메인 유틸로 추출
- `db.ts`와 `AttendanceSessionManager.tsx`가 동일한 출석 판정 유틸을 사용하도록 정리
- `src/lib/domain/activityLogs.ts` 추가로 유효 활동 로그 필터링, 날짜 키 계산, 범위 필터링을 공통화
- `useActivitiesResources`, `useStatsResources`를 추가해 활동/통계 탭의 데이터 로딩과 새로고침 책임을 hook으로 분리
- `HomeTab`, `MemberHomeTab`, `StatsTab`, `RecapViewer`, `badges.ts`, `recapSnapshots.ts`, `db.ts`가 동일한 활동 로그 도메인 유틸을 사용하도록 정리
- `ActivityFeedSection`, `ActivityRecordDialog` 분리로 `ActivitiesTab`의 피드/정정 검토/운영 이력/기록 모달을 본문에서 제거
- `SnapshotCardList`, `StatsRecapSection`, `StatsCompareSection`, `StatsArchivesSection` 분리로 `StatsTab`의 보기별 렌더 블록을 본문에서 제거
- `ActivitiesTab` 본문 라인 수를 1057 → 549 수준으로 축소
- `StatsTab` 본문 라인 수를 602 → 407 수준으로 축소
- `src/lib/api/shared/client.ts`, `src/lib/api/shared/fallbackState.ts` 분리로 Supabase 클라이언트/데이터 fallback 상태를 `db.ts` 밖으로 이동
- `src/lib/api/shared/localState.ts` 추가로 로컬 fallback 시드/상태를 `db.ts` 밖으로 이동
- `src/lib/api/shared/publicData.ts`, `src/lib/api/shared/fallback.ts`, `src/lib/api/shared/localUtils.ts` 추가로 공지/시즌/일정/배지/배너/로컬 유틸 read path를 별도 모듈로 이동
- `src/lib/api/admin/roles.ts`, `src/lib/api/auth/account.ts`, `src/lib/api/layout/site.ts`는 이제 `db.ts` 재수출이 아니라 직접 구현 또는 shared module import를 사용
- `src/lib/api/home/public.ts`, `src/lib/api/admin/settings.ts`, `src/lib/api/member/self.ts`, `src/lib/api/stats/overview.ts`는 일부 읽기 경로를 shared module로 전환
- 현재 `src/lib/api/*`에서 `db.ts`를 직접 참조하는 파일 수는 10개 → 7개 수준으로 감소
- `db.ts` 본문 라인 수를 5038 → 4385 수준으로 축소
- `results.test.ts`, `activityLogs.test.ts`, `attendance.test.ts` 확장으로 destructive 결과 파서와 공통 도메인 유틸 회귀 테스트를 보강
- 현재 테스트 스위트는 5 files / 23 tests 기준으로 `lint`, `test`, `build`를 모두 통과

---

## 2. 현재 구조 진단

### 2.1 핵심 병목 파일

현재 가장 큰 문제는 특정 파일에 도메인과 상태가 과도하게 몰려 있다는 점이다.

| 파일 | 대략 크기 | 주요 문제 |
| --- | ---: | --- |
| `src/lib/db.ts` | 5038 lines | 원격 API, 로컬 fallback, mapper, 도메인 규칙, side effect가 한 파일에 혼재 |
| `src/components/dashboard/DashboardTab.tsx` | 2717 lines | 멤버/팀/숨김 멤버/역할/모달 상태가 한 컴포넌트에 결합 |
| `src/components/settings/SettingsTab.tsx` | 1653 lines | 시즌/공지/일정/배너/배지/초기화가 한 화면에 결합 |
| `src/components/home/MemberHomeTab.tsx` | 1078 lines | 홈/활동/리캡/배지/계정이 한 컴포넌트 |
| `src/components/activities/ActivitiesTab.tsx` | 1057 lines | 활동 입력/이력/정정/출석/규칙 관련 컨텍스트 혼합 |
| `supabase/schema.sql` | 2547 lines | 전체 스키마 snapshot과 함수 정의가 누적되어 관리 난이도 상승 |

### 2.2 상태 복잡도

주요 탭의 hook 사용량은 이미 컴포넌트가 과도하게 커졌다는 신호다.

| 파일 | `useState` | `useEffect` | `useMemo` |
| --- | ---: | ---: | ---: |
| `DashboardTab.tsx` | 24 | 3 | 26 |
| `SettingsTab.tsx` | 24 | 1 | 0 |
| `MemberHomeTab.tsx` | 3 | 1 | 8 |
| `ActivitiesTab.tsx` | 10 | 1 | 12 |

`DashboardTab`과 `SettingsTab`은 UI 분할이 우선 필요한 상태다.

### 2.3 데이터 계층 결합도

`src/components` 아래에서 `lib/db`를 직접 import하는 파일이 12개다.

- `Layout.tsx`
- `HeaderBannerCarousel.tsx`
- `AuthProvider.tsx`
- `StatsTab.tsx`
- `ActivitiesTab.tsx`
- `DashboardTab.tsx`
- `RoleSettingsDialog.tsx`
- `PointRulesManager.tsx`
- `AttendanceSessionManager.tsx`
- `HomeTab.tsx`
- `SettingsTab.tsx`
- `MemberHomeTab.tsx`

즉, `db.ts`를 건드리면 거의 전체 UI가 영향을 받는다.

### 2.4 테스트 부재

프로젝트에는 현재 실질적인 테스트 스위트가 없다.

- `package.json`에 `test` 스크립트가 없음
- component/unit/integration 테스트 부재
- destructive 기능도 `lint/build`만으로 검증 중

이 상태에서는 큰 리팩토링이 사실상 수동 QA 의존 작업이 된다.

### 2.5 SQL 계약 관리 방식 문제

현재 DB 관련 산출물이 분산돼 있다.

- `supabase/migrations/*`
- `supabase/schema.sql`
- `src/types/database.ts`

이 세 곳을 동시에 맞춰야 하고, 실제로 함수 반환 타입 변경 시 `DROP FUNCTION` 누락 문제를 이미 경험했다.  
즉, 소스 오브 트루스가 명확하지 않다.

---

## 3. 리팩토링 목표

### 3.1 1차 목표

- `db.ts`를 도메인별 API 계층으로 분리
- 관리자 대형 탭(`DashboardTab`, `SettingsTab`)을 섹션/모달 단위로 해체
- SQL 계약 변경 시 사고가 나지 않는 작업 규칙 수립
- destructive flow에 최소 테스트 추가

### 3.2 2차 목표

- 회원 화면과 활동/통계 화면의 파생 계산 분리
- 공통 도메인 규칙 중복 제거
- 탭 lazy loading 도입
- 번들 크기와 초기 로드 부담 완화

### 3.3 비목표

다음 항목은 이번 리팩토링의 직접 목표가 아니다.

- 디자인 전면 개편
- 상태관리 라이브러리 도입을 전제로 한 아키텍처 재작성
- SSR 도입
- Vite/React/Tailwind 메이저 교체

---

## 4. 리팩토링 원칙

### 4.1 큰 브랜치 금지

한 브랜치에서 아키텍처, UI, SQL, 타입을 모두 바꾸지 않는다.  
반드시 작은 브랜치로 나누고 순차 병합한다.

### 4.2 시그니처 호환 우선

`db.ts` 분해 초기에는 기존 함수 이름과 반환 형태를 유지한다.  
내부 구현만 새 파일로 이동시키고, 외부 컴포넌트 import는 한동안 건드리지 않는다.

### 4.3 destructive flow는 테스트 없는 변경 금지

다음 기능은 테스트 또는 최소한의 검증 harness 없이 리팩토링하지 않는다.

- 팀 삭제
- 팀원 일괄 저장
- 데이터 초기화
- 숨김 멤버 영구 삭제
- 배지 재계산

### 4.4 SQL 계약 변경은 `drop/create` 원칙 명시

`RETURNS TABLE` 변경, `OUT` 파라미터 변경, 함수 반환 row type 변경 시에는 `create or replace function`에 의존하지 않는다.

### 4.5 UI와 규칙을 분리

컴포넌트는 표시와 이벤트 orchestration만 담당하고, 규칙 계산은 `domain/*` 또는 `lib/*`로 이동한다.

---

## 5. 세부 리스크 분석

아래 리스크는 리팩토링 중 실제로 사고가 날 가능성이 높은 항목들이다.

### 5.1 `db.ts` 단일 병목 리스크

#### 현상

`src/lib/db.ts` 하나에 아래 내용이 모두 섞여 있다.

- Supabase RPC/table query
- 로컬 mock fallback
- JSON 파싱/row mapper
- 활동/배지/출석/리캡 계산 로직
- audit 로그 보조 로직
- retry/sleep/error fallback

#### 왜 위험한가

- 하나의 export를 옮기다 import 순환이 생길 수 있다
- 팀 도메인을 만지다가 배지 fallback이 깨질 수 있다
- 원격 경로와 로컬 경로 중 하나만 수정되는 드리프트가 발생한다
- 테스트 없이 분해하면 변경 범위를 통제하기 어렵다

#### 구체적 사고 시나리오

- `replaceTeamMembers()` 분리 후 fallback 구현만 남아 실제 Supabase RPC 호출 누락
- `getMyMemberBadges()` mapper 이동 중 `criteria_json` 파싱이 빠져 회원 화면 배지 카드가 빈 상태로 노출
- `reverseActivityEntry()` 정리 중 badge refresh 후처리 누락

#### 완화 방안

- 1차는 “분리”만 하고 외부 시그니처 유지
- `remote`, `local`, `mappers`, `shared`를 먼저 분리
- 도메인 단위로 export를 이전하고 매 단계마다 `lint/build/test`

### 5.2 로컬 fallback/실DB 이중 구현 드리프트 리스크

#### 현상

로컬 메모리 상태가 거의 전체 도메인에 대해 구현되어 있다.

- `localMembers`
- `localCategories`
- `localLogs`
- `localBadges`
- `localMemberBadges`
- `localRoles`
- `localTeams`
- `localSeasons`
- `localAnnouncements`
- `localScheduleEvents`
- `localSiteBanners`
- `localRecapSnapshots`
- `localAttendanceSessions`
- `localAttendanceSessionMembers`

#### 왜 위험한가

- 실DB에서만 보이는 제약 조건을 로컬에서 재현하지 못함
- 로컬 fallback이 커질수록 유지보수 비용이 실질적으로 2배가 됨
- 리팩토링 중 어느 구현을 기준으로 고쳤는지 혼동됨

#### 구체적 사고 시나리오

- 팀 삭제는 로컬에서 동작하지만 Supabase에서는 FK/정책/RPC 구조 때문에 다르게 동작
- badge refresh는 실DB에선 함수 호출, 로컬에선 직접 mutate라 결과가 달라짐
- hard delete가 로컬에선 단순 splice인데 실환경에선 auth user 삭제까지 필요

#### 완화 방안

- fallback을 장기적으로 “최소 demo/mock” 수준으로 축소
- production-critical 도메인은 fallback보다 fake adapter/test fixture로 대체
- 최소한 remote/local 구현을 파일 수준에서 분리

### 5.3 대형 탭 상태 폭증 리스크

#### 현상

한 탭이 여러 역할을 동시에 수행한다.

- 데이터 로딩
- 파생 값 계산
- 리스트 렌더
- 모달 상태
- draft 상태
- destructive confirm 상태
- 서버 호출
- 에러 처리

#### 왜 위험한가

- 모달 간 상태가 꼬이기 쉽다
- 하나의 핸들러가 너무 많은 상태를 동시에 만진다
- 새 기능 하나 넣을 때 기존 흐름을 실수로 건드린다

#### 구체적 사고 시나리오

- `SettingsTab`에서 배지 모달 열고 닫는 과정이 reset dialog 상태를 잘못 건드림
- `DashboardTab`에서 팀 수정 모달과 팀원 지정 모달의 선택 팀 상태가 섞임
- 숨김 멤버 영구 삭제 후 목록 refresh와 확장 패널 상태가 엇갈림

#### 완화 방안

- 탭은 orchestration만 담당
- 섹션별 컴포넌트 + dialog별 컴포넌트 분리
- `useXxxData`, `useXxxDialogs` 같은 hook으로 상태 역할 분리

### 5.4 UI 규칙과 도메인 규칙 중복 리스크

#### 현상

같은 규칙이 여러 위치에 흩어져 있다.

- 출석 규칙 matcher 중복
- 배지 수치 계산이 프론트 helper와 SQL 함수 양쪽에 존재
- 리캡 집계 로직이 viewer/helper/UI에 분산

#### 왜 위험한가

- 한쪽만 바꿔도 결과가 엇갈린다
- 설명 문구는 바뀌었는데 계산식은 예전 로직일 수 있다
- 관리자 수치와 회원 수치가 서로 다르게 보일 수 있다

#### 구체적 사고 시나리오

- 프론트 badge progress는 시즌 기준인데 서버 award는 lifetime 기준으로 남음
- attendance 관련 regex 업데이트가 `AttendanceSessionManager`에만 반영됨
- recap 대상자 계산과 저장본 생성 기준이 어긋남

#### 완화 방안

- `src/lib/domain/attendance.ts`
- `src/lib/domain/badges.ts`
- `src/lib/domain/recaps.ts`
- 공통 규칙을 여기에 두고 UI는 소비만 하게 변경

### 5.5 SQL 계약 드리프트 리스크

#### 현상

다음 3개가 동시에 진실처럼 취급된다.

- migration
- `schema.sql`
- `database.ts`

#### 왜 위험한가

- migration만 최신이고 snapshot은 구버전일 수 있다
- 타입은 구버전인데 runtime은 신버전이라 compile과 production이 따로 움직인다
- 함수 반환 타입 변경 시 `drop/create` 누락 가능

#### 구체적 사고 시나리오

- `get_my_member_badges()` 같은 함수가 SQL Editor에서 실패
- `get_my_member_overview()`는 최신인데 TS 타입은 예전 컬럼만 반영
- 정책/권한 grant는 migration에 있는데 `schema.sql`에는 누락

#### 완화 방안

- migration을 source of truth로 명시
- `schema.sql`은 snapshot artifact로 취급
- `database.ts` 재생성 절차를 문서화
- 함수 반환 구조 변경 체크리스트 도입

### 5.6 권한/인증 흐름 결합 리스크

#### 현상

`AuthProvider`가 아래 역할을 모두 수행한다.

- 세션 구독
- 프로필 sync
- role 계산
- permission 계산
- first login 상태 처리
- profile 에러 메시지 처리

#### 왜 위험한가

- auth와 member self-view가 강하게 묶인다
- 특정 상태 조합에서 access control이 일관되지 않을 수 있다
- 리팩토링 시 profile loading 흐름과 화면 진입 조건이 함께 깨진다

#### 구체적 사고 시나리오

- `mustResetPassword`와 `requiresPasswordSetup` 처리 순서 변경으로 정상 회원이 앱 진입 불가
- profile sync 실패 시 잘못된 기본 role이 적용
- memberId 없는 경우 메시지는 나오지만 UI 일부는 렌더됨

#### 완화 방안

- `auth/session`, `auth/profile`, `auth/permissions` 책임 분리
- access gate selector를 hook으로 이동
- 에러/권한 상태를 명시적 enum으로 정리

### 5.7 파괴적 기능 회귀 리스크

#### 현상

현재 이미 파괴적인 기능이 많다.

- 데이터 초기화
- 팀 삭제
- 배지 삭제
- hard delete
- 활동 취소

#### 왜 위험한가

- UI 리팩토링만 해도 destructive handler wiring이 깨질 수 있다
- 후처리 로직이 빠져도 compile은 통과한다
- audit/badge refresh/recap cleanup 누락이 치명적이다

#### 완화 방안

- destructive flow 우선 테스트
- 최소한 mock integration test 추가
- 후처리까지 검증하는 테스트 케이스 작성

### 5.8 UI 일관성 부재 리스크

#### 현상

현재 `alert`, `confirm`, custom dialog가 혼재한다.

#### 왜 위험한가

- UX 일관성이 없다
- 비동기 실패 처리 패턴이 제각각이다
- 리팩토링 중 confirm 흐름을 공통화하기 어렵다

#### 완화 방안

- 공통 confirm dialog 패턴 정의
- 에러 토스트/배너 정책을 하나로 통일
- settings/dashboard destructive action을 공통 UI로 정리

### 5.9 초기 로드 성능 리스크

#### 현상

현재 앱은 탭 컴포넌트를 모두 정적으로 import한다.

- `DashboardTab`
- `SettingsTab`
- `ActivitiesTab`
- `StatsTab`
- `HomeTab`
- `MemberHomeTab`

빌드 시 메인 청크가 약 959KB 수준이다.

#### 왜 위험한가

- 일반 회원도 관리자용 무거운 탭 코드를 함께 내려받음
- 초기 렌더가 느려질 수 있음
- 추후 통계/차트/리캡이 더 커지면 악화

#### 완화 방안

- 탭 단위 `React.lazy`
- 관리자 전용 코드 분리
- 차트/리캡 viewer 지연 로딩

---

## 6. 선행 결정 사항

리팩토링 착수 전에 아래 정책을 먼저 확정해야 한다.

### 6.1 로컬 fallback 유지 범위

선택지:

- A. 현재처럼 광범위하게 유지
- B. 개발용 최소 mock만 유지
- C. 완전히 제거하고 테스트 fixture로 대체

권장: **B**

### 6.2 DB 소스 오브 트루스

선택지:

- A. migration 중심
- B. `schema.sql` 중심
- C. 둘 다 수동 유지

권장: **A**

### 6.3 `db.ts` 호환 레이어 유지 여부

선택지:

- A. 즉시 import 전면 교체
- B. 한동안 `db.ts`를 facade로 유지

권장: **B**

### 6.4 테스트 우선순위

선택지:

- A. unit test 우선
- B. integration test 우선
- C. E2E 우선

권장: **A + 핵심 destructive flow integration 일부**

---

## 7. 목표 구조

### 7.1 데이터 계층 목표

```text
src/lib/api/
  client.ts
  errors.ts
  shared/
    fallback.ts
    audit.ts
    types.ts
  mappers/
    badges.ts
    members.ts
    teams.ts
    activities.ts
    recaps.ts
  members.ts
  teams.ts
  roles.ts
  badges.ts
  activities.ts
  attendance.ts
  recaps.ts
  settings.ts
  self.ts
```

### 7.2 도메인 규칙 목표

```text
src/lib/domain/
  attendance.ts
  badges.ts
  recaps.ts
  members.ts
```

### 7.3 UI 구조 목표

```text
src/components/dashboard/
  sections/
  dialogs/
  hooks/

src/components/settings/
  sections/
  dialogs/
  hooks/

src/components/home/member/
  sections/
  hooks/

src/components/activities/
  panels/
  dialogs/
  hooks/
```

---

## 8. 브랜치 전략

모든 브랜치는 `codex/` 접두사를 사용한다.

### 8.1 브랜치 목록

1. `codex/refactor-test-harness`
2. `codex/refactor-db-contracts`
3. `codex/refactor-db-split-foundation`
4. `codex/refactor-settings-tab`
5. `codex/refactor-dashboard-tab`
6. `codex/refactor-db-split-admin`
7. `codex/refactor-member-home`
8. `codex/refactor-activities-stats`
9. `codex/refactor-app-shell-lazy-loading`

### 8.2 브랜치 운영 규칙

- 한 브랜치에서 도메인은 최대 1개 또는 2개만 만진다
- SQL 계약 변경 브랜치와 UI 해체 브랜치를 섞지 않는다
- destructive flow를 touched 하면 테스트를 같이 넣는다
- 각 브랜치는 1~3일 이내 merge 가능한 크기로 유지한다
- `main`은 항상 `lint/build` 통과 상태를 유지한다

---

## 9. 브랜치별 상세 계획

### 9.1 `codex/refactor-test-harness`

#### 목표

리팩토링 안전장치 마련

#### 작업 범위

- Vitest 도입
- React Testing Library 도입
- `test` 스크립트 추가
- fixture/helper 기반 최소 테스트 scaffold 생성

#### 우선 테스트 대상

- 배지 criteria normalization
- badge progress 계산
- 팀 삭제 결과 요약 parser
- 데이터 초기화 결과 parser
- destructive modal 조건 검증이 가능한 pure helper

#### 산출물

- 테스트 러너 설정
- `tests/fixtures/*`
- 최소 10~15개 테스트

#### 완료 기준

- `npm run test` 추가
- CI 없이 로컬 기준 `lint/build/test` 가능

#### 예상 리스크

- 현재 구조가 테스트 친화적이지 않아 mocking이 크다

#### 완화

- 이 브랜치에서는 product code 수정 최소화

### 9.2 `codex/refactor-db-contracts`

#### 목표

SQL 계약 관리 규칙 확립

#### 작업 범위

- migration 중심 운영 원칙 문서화
- `database.ts` 재생성 절차 정리
- `schema.sql` 역할 명시
- 함수 반환 타입 변경 시 `drop/create` 체크리스트 추가

#### 산출물

- DB 계약 운영 가이드
- migration 작성 규칙

#### 완료 기준

- badge/account/team 관련 최신 함수들이 문서 규칙과 일치

### 9.3 `codex/refactor-db-split-foundation`

#### 목표

`db.ts` 분해 기반 생성

#### 작업 범위

- `src/lib/api/client.ts`
- `src/lib/api/errors.ts`
- `src/lib/api/shared/*`
- 공통 mapper/util 이동
- `db.ts`는 facade로 유지

#### 산출물

- 공통 모듈 구조
- 도메인 분해용 기반 파일

#### 완료 기준

- 외부 import는 아직 유지되지만 내부 일부가 새 구조를 사용

#### 리스크

- import 순환

#### 완화

- shared → mapper → domain → api 방향만 허용

### 9.4 `codex/refactor-settings-tab`

#### 목표

`SettingsTab` 해체

#### 새 구조

```text
src/components/settings/
  SettingsTab.tsx
  sections/
    SeasonSection.tsx
    AnnouncementSection.tsx
    ScheduleSection.tsx
    BannerSection.tsx
    BadgeSection.tsx
    DataResetSection.tsx
  dialogs/
    SeasonDialog.tsx
    AnnouncementDialog.tsx
    ScheduleDialog.tsx
    BannerDialog.tsx
    BadgeDialog.tsx
    BadgeDeleteDialog.tsx
    DataResetDialog.tsx
  hooks/
    useSettingsData.ts
```

#### 완료 기준

- 메인 `SettingsTab.tsx` 250줄 이하 목표
- 섹션별 상태/모달 분리 완료

#### 리스크

- 배지 draft와 데이터 초기화 dialog 상태 충돌

#### 완화

- 각 섹션 컴포넌트가 자체 modal state 보유

### 9.5 `codex/refactor-dashboard-tab`

#### 목표

`DashboardTab` 해체

#### 새 구조

```text
src/components/dashboard/
  DashboardTab.tsx
  sections/
    MemberSection.tsx
    TeamSection.tsx
    HiddenMemberSection.tsx
    RoleSection.tsx
  dialogs/
    TeamMembersDialog.tsx
    TeamEditDialog.tsx
    TeamDeleteDialog.tsx
    MemberEditDialog.tsx
    HardDeleteMemberDialog.tsx
  hooks/
    useDashboardData.ts
```

#### 완료 기준

- 멤버/팀/숨김 회원/역할 렌더와 상태가 분리
- 팀 관련 destructive flow 회귀 없음

#### 리스크

- 팀 선택 상태와 멤버 draft 상태 분리 중 오류

#### 완화

- dialog 단위로 state object 분리

### 9.6 `codex/refactor-db-split-admin`

#### 목표

관리자 도메인 API 분리

#### 대상

- `members.ts`
- `teams.ts`
- `roles.ts`
- `badges.ts`
- `settings.ts`

#### 완료 기준

- 관리자 화면이 직접 사용하는 API가 도메인 파일로 분리
- `db.ts`는 re-export만 남기기 시작

### 9.7 `codex/refactor-member-home`

#### 목표

`MemberHomeTab` 해체

#### 새 구조

```text
src/components/home/member/
  MemberHomeScreen.tsx
  sections/
    OverviewSection.tsx
    ActivitySection.tsx
    RecapSection.tsx
    BadgeSection.tsx
    AccountSection.tsx
  hooks/
    useMemberHomeData.ts
```

#### 완료 기준

- 각 탭 섹션이 독립 컴포넌트화
- 정정 요청/배지/리캡 계산이 hook으로 이동

### 9.8 `codex/refactor-activities-stats`

#### 목표

활동/출석/통계/리캡 도메인 규칙 중복 제거

#### 범위

- 출석 matcher 공통화
- badge metrics 계산 공통화
- recap aggregation 공통화

#### 완료 기준

- UI 중복 규칙 제거
- domain helper 재사용

### 9.9 `codex/refactor-app-shell-lazy-loading`

#### 목표

탭 단위 lazy loading 도입

#### 범위

- `App.tsx` 정적 import 제거
- 관리자 탭, 통계 탭, 리캡 viewer 지연 로딩
- 탭별 loading fallback UI 추가

#### 완료 기준

- 초기 청크 감소
- 일반 회원이 관리자 탭 코드를 즉시 받지 않음

---

## 10. 브랜치별 예상 커밋 단위

### 10.1 `codex/refactor-test-harness`

- `chore: add vitest and rtl`
- `test: add badge helper coverage`
- `test: add destructive flow result parser tests`

### 10.2 `codex/refactor-db-split-foundation`

- `refactor: extract api client and error helpers`
- `refactor: move shared mappers out of db facade`
- `refactor: add domain api folder scaffold`

### 10.3 `codex/refactor-settings-tab`

- `refactor: extract settings section headers and shared UI`
- `refactor: split banner and badge dialogs from settings tab`
- `refactor: move data reset flow into dedicated section`

### 10.4 `codex/refactor-dashboard-tab`

- `refactor: extract team management section`
- `refactor: extract hidden member flows`
- `refactor: move dashboard modal state into dedicated hooks`

### 10.5 `codex/refactor-app-shell-lazy-loading`

- `perf: lazy load admin tabs`
- `perf: lazy load stats and recap viewers`

---

## 11. 권장 실행 순서

가장 현실적인 순서는 다음과 같다.

1. `codex/refactor-test-harness`
2. `codex/refactor-db-contracts`
3. `codex/refactor-db-split-foundation`
4. `codex/refactor-settings-tab`
5. `codex/refactor-dashboard-tab`
6. `codex/refactor-db-split-admin`
7. `codex/refactor-member-home`
8. `codex/refactor-activities-stats`
9. `codex/refactor-app-shell-lazy-loading`

이 순서가 좋은 이유는 다음과 같다.

- 먼저 안전장치와 계약 기준을 만든다
- 그 다음 가장 복잡한 관리자 화면부터 UI 분리한다
- 데이터 계층 분해는 기반을 만든 뒤 점진적으로 옮긴다
- 마지막에 lazy loading과 번들 최적화를 적용한다

---

## 12. 첫 착수 브랜치 체크리스트

### 12.1 `codex/refactor-test-harness` 시작 전 체크리스트

- 현재 `main` 기준 `lint/build` 통과 확인
- 테스트 프레임워크 선택 확정
- UI 테스트 대상과 pure helper 테스트 대상을 분리

### 12.2 즉시 만들 파일

- `vitest.config.ts`
- `src/test/setup.ts`
- `src/lib/badges.test.ts`
- `src/lib/db.parsers.test.ts` 또는 도메인 helper 테스트 파일

### 12.3 최소 필수 테스트

- 배지 criteria normalize
- badge metrics 계산
- badge earned 판정
- team delete result parsing
- data reset result parsing
- hidden member hard delete local guard

---

## 13. 검증 기준

각 브랜치 머지 전 아래 기준을 통과해야 한다.

### 13.1 공통

- `npm run lint`
- `npm run build`
- 추가된 `npm run test` 통과

### 13.2 UI 리팩토링 브랜치

- 기존 관리자 플로우 수동 점검
- 모달 open/close 및 draft 보존 확인
- destructive action confirm 흐름 확인

### 13.3 SQL 계약 관련 브랜치

- 변경된 RPC/function 반환 타입 확인
- migration 재실행 가능성 확인
- `drop/create` 필요한 함수 목록 점검

### 13.4 배포 전

- Supabase migration 적용 여부 확인
- Edge Function 영향 여부 확인
- 운영 문구와 실제 로직 일치 여부 확인

---

## 14. 완료 정의

다음 상태가 되면 1차 리팩토링이 완료된 것으로 본다.

- `db.ts`가 facade 또는 얇은 re-export 수준으로 축소
- `DashboardTab`, `SettingsTab`이 섹션/모달 단위로 분리
- destructive flow 최소 테스트 존재
- SQL 계약 변경 규칙 정착
- 로컬 fallback 범위가 축소되거나 명확히 문서화
- `App.tsx`에서 탭 lazy loading 적용

---

## 15. 즉시 권장 다음 액션

지금 가장 먼저 해야 할 일은 다음 둘 중 하나다.

1. `codex/refactor-test-harness` 브랜치를 만들어 테스트 기반부터 추가
2. 팀 내에서 fallback 정책과 DB source of truth 정책을 먼저 확정

권장 순서는 **정책 확정 후 테스트 기반 추가**다.
