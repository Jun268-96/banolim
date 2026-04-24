-- 구버전 5-arg 오버로드를 제거하여 PostgREST PGRST203 모호성 해소
-- 과거 20260311_activity_evidence_and_rule_catalog.sql 에서 p_evidence_url 을 추가할 때
-- drop function 없이 create or replace 만 사용하여 5-arg 버전과 6-arg 버전이 공존.
-- 클라이언트가 p_evidence_url 없이 호출하면 둘 다 후보가 되어 PostgREST 가 오버로드를
-- 선택하지 못하고 PGRST203 을 반환. 최신 6-arg 버전만 남긴다.

drop function if exists public.create_activity_entry(
    uuid, uuid, text, text, timestamptz
);

drop function if exists public.create_batch_activity_entries(
    uuid[], uuid, text, text, timestamptz
);
