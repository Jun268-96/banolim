-- 출석 세션 숨기기 기능
-- 관리자가 잘못 만들었거나 의미를 잃은 세션을 "마감 처리 후 숨김"으로 목록에서 치워둘 수 있게 한다.
-- 진행 중 세션을 실수로 숨기지 못하도록 check constraint 로 가드한다.

alter table public.attendance_sessions
    add column if not exists is_hidden boolean not null default false;

alter table public.attendance_sessions
    drop constraint if exists attendance_sessions_hidden_requires_closed;

alter table public.attendance_sessions
    add constraint attendance_sessions_hidden_requires_closed
    check (not (is_active = true and is_hidden = true));

create index if not exists idx_attendance_sessions_hidden
    on public.attendance_sessions (is_hidden);
