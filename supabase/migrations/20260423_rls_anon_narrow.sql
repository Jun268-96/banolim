-- ANALYSIS.md P0: RLS anon 범위 축소
-- 민감 뷰 3개(member_score_summary / activity_log_feed / point_rule_catalog)에서
-- anon 전체 권한 회수 + authenticated는 select만 유지.
-- 배경:
--   * 뷰에는 RLS가 걸리지 않아 grant만 막아도 된다.
--   * 기존 정책이 anon에 SELECT/INSERT/UPDATE/DELETE/TRUNCATE/TRIGGER 모두 허용 —
--     base table RLS가 차단해주긴 하나 공격 표면이 넓음.
--   * 본 마이그레이션은 '쓰기' 권한을 원천 차단하고 비로그인(anon) 읽기도 제거.
-- 2026-04-23

revoke all on public.member_score_summary from anon;
revoke all on public.activity_log_feed from anon;
revoke all on public.point_rule_catalog from anon;

revoke insert, update, delete, truncate, trigger, references
    on public.member_score_summary from authenticated;
revoke insert, update, delete, truncate, trigger, references
    on public.activity_log_feed from authenticated;
revoke insert, update, delete, truncate, trigger, references
    on public.point_rule_catalog from authenticated;

grant select on public.member_score_summary to authenticated;
grant select on public.activity_log_feed to authenticated;
grant select on public.point_rule_catalog to authenticated;

comment on view public.member_score_summary is
    'ANALYSIS.md P0: anon 접근 차단(2026-04-23). authenticated select only.';
comment on view public.activity_log_feed is
    'ANALYSIS.md P0: anon 접근 차단(2026-04-23). authenticated select only.';
comment on view public.point_rule_catalog is
    'ANALYSIS.md P0: anon 접근 차단(2026-04-23). authenticated select only.';
