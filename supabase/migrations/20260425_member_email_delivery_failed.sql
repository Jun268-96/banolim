-- members.email_delivery_failed 플래그 추가
-- invite/recovery 메일 발송이 실패하면 true로 셋팅되어 관리자 화면에서 [계정 발급] 버튼이 다시 노출되게 한다.
-- 메일이 정상 발송되면 다음 발급/재발급 시 false로 회복된다.

alter table public.members
    add column if not exists email_delivery_failed boolean not null default false;

comment on column public.members.email_delivery_failed is
    '직전 invite/recovery 메일 발송 실패 여부. true면 관리자 화면에서 [계정 발급] 버튼이 재노출되어 재시도를 유도한다.';
