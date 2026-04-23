-- ANALYSIS.md P0 후속: point_rule_catalog 뷰를 security_invoker로 전환
-- Supabase advisor ERROR(security_definer_view) 해소.
-- 이 뷰의 baseline인 point_rules/activity_types는 select policy가 public이므로
-- invoker 전환이 일반 사용자 조회에 영향을 주지 않음.
-- 2026-04-23

alter view public.point_rule_catalog set (security_invoker = on);
