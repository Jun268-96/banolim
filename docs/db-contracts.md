# DB Contract Workflow

## 목적

이 문서는 Supabase SQL 함수, migration, `schema.sql`, TypeScript 타입 간의 계약 불일치를 줄이기 위한 작업 규칙을 정리한다.

## Source Of Truth

이 프로젝트에서 DB 구조의 source of truth는 `supabase/migrations/*` 이다.

- migration이 실제 변경의 기준이다.
- `supabase/schema.sql` 은 snapshot 성격의 보조 산출물이다.
- `src/types/database.ts` 는 migration 결과와 일치해야 하는 generated/maintained 타입이다.

## 함수 변경 규칙

### 1. 반환 row type 변경

다음 경우에는 `create or replace function`만으로 처리하지 않는다.

- `returns table (...)` 컬럼 추가/삭제/순서 변경
- `OUT` 파라미터 구조 변경
- 반환 row type 자체 변경

이 경우 반드시 아래 순서를 따른다.

1. `drop function if exists ...`
2. `create function ...`
3. 필요한 `grant execute ...`

### 2. 이름은 같고 본문만 바뀌는 경우

아래 경우에는 `create or replace function` 사용 가능하다.

- 내부 쿼리 로직 변경
- permission check 변경
- 반환 타입 불변

## 변경 체크리스트

DB 함수나 RPC를 수정할 때는 아래를 함께 확인한다.

- [ ] migration 파일에 반영했는가
- [ ] `schema.sql` snapshot에도 반영했는가
- [ ] `src/types/database.ts` 타입이 변경 계약과 일치하는가
- [ ] 프론트 mapper가 새 컬럼을 읽는가
- [ ] `grant execute` 또는 table grant가 필요한가
- [ ] 반환 구조 변경 함수는 `drop/create` 방식인가

## 권장 작업 순서

1. migration 작성
2. local/remote SQL 실행 또는 적용
3. `schema.sql` snapshot 갱신
4. `src/types/database.ts` 갱신
5. 관련 mapper/consumer 갱신
6. `lint/build/test` 실행

## 주의 사례

### `get_my_member_badges()`

`returns table` 컬럼을 늘린 상태에서 `create or replace function`을 쓰면 PostgreSQL이 다음 오류를 낼 수 있다.

- `cannot change return type of existing function`

이 함수는 반드시 `drop function if exists public.get_my_member_badges();` 후 다시 생성해야 한다.

### `get_my_member_overview()`

계정 상태 컬럼처럼 반환 컬럼이 늘어나는 경우도 동일하다.  
계약 변경 시 snapshot과 TS 타입을 함께 갱신하지 않으면 프론트에서 잘못된 상태가 표시될 수 있다.
