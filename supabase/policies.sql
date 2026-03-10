grant usage on schema public to anon, authenticated;

grant select on public.member_score_summary to anon, authenticated;
grant select on public.point_rule_catalog to anon, authenticated;
grant select on public.activity_log_feed to anon, authenticated;

grant select, insert, update on public.roles to anon, authenticated;
grant select, insert, update on public.teams to anon, authenticated;
grant select, insert, update on public.seasons to anon, authenticated;
grant select, insert, update on public.members to anon, authenticated;
grant select, insert, update on public.activity_types to anon, authenticated;
grant select, insert, update on public.point_rules to anon, authenticated;
grant select, insert, update on public.activity_records to anon, authenticated;
grant select, insert, update on public.point_ledgers to anon, authenticated;

alter table public.roles enable row level security;
alter table public.teams enable row level security;
alter table public.seasons enable row level security;
alter table public.members enable row level security;
alter table public.activity_types enable row level security;
alter table public.point_rules enable row level security;
alter table public.activity_records enable row level security;
alter table public.point_ledgers enable row level security;

drop policy if exists roles_select_all on public.roles;
create policy roles_select_all on public.roles for select to anon, authenticated using (true);
drop policy if exists roles_insert_all on public.roles;
create policy roles_insert_all on public.roles for insert to anon, authenticated with check (true);
drop policy if exists roles_update_all on public.roles;
create policy roles_update_all on public.roles for update to anon, authenticated using (true) with check (true);

drop policy if exists teams_select_all on public.teams;
create policy teams_select_all on public.teams for select to anon, authenticated using (true);
drop policy if exists teams_insert_all on public.teams;
create policy teams_insert_all on public.teams for insert to anon, authenticated with check (true);
drop policy if exists teams_update_all on public.teams;
create policy teams_update_all on public.teams for update to anon, authenticated using (true) with check (true);

drop policy if exists seasons_select_all on public.seasons;
create policy seasons_select_all on public.seasons for select to anon, authenticated using (true);
drop policy if exists seasons_insert_all on public.seasons;
create policy seasons_insert_all on public.seasons for insert to anon, authenticated with check (true);
drop policy if exists seasons_update_all on public.seasons;
create policy seasons_update_all on public.seasons for update to anon, authenticated using (true) with check (true);

drop policy if exists members_select_all on public.members;
create policy members_select_all on public.members for select to anon, authenticated using (true);
drop policy if exists members_insert_all on public.members;
create policy members_insert_all on public.members for insert to anon, authenticated with check (true);
drop policy if exists members_update_all on public.members;
create policy members_update_all on public.members for update to anon, authenticated using (true) with check (true);

drop policy if exists activity_types_select_all on public.activity_types;
create policy activity_types_select_all on public.activity_types for select to anon, authenticated using (true);
drop policy if exists activity_types_insert_all on public.activity_types;
create policy activity_types_insert_all on public.activity_types for insert to anon, authenticated with check (true);
drop policy if exists activity_types_update_all on public.activity_types;
create policy activity_types_update_all on public.activity_types for update to anon, authenticated using (true) with check (true);

drop policy if exists point_rules_select_all on public.point_rules;
create policy point_rules_select_all on public.point_rules for select to anon, authenticated using (true);
drop policy if exists point_rules_insert_all on public.point_rules;
create policy point_rules_insert_all on public.point_rules for insert to anon, authenticated with check (true);
drop policy if exists point_rules_update_all on public.point_rules;
create policy point_rules_update_all on public.point_rules for update to anon, authenticated using (true) with check (true);

drop policy if exists activity_records_select_all on public.activity_records;
create policy activity_records_select_all on public.activity_records for select to anon, authenticated using (true);
drop policy if exists activity_records_insert_all on public.activity_records;
create policy activity_records_insert_all on public.activity_records for insert to anon, authenticated with check (true);
drop policy if exists activity_records_update_all on public.activity_records;
create policy activity_records_update_all on public.activity_records for update to anon, authenticated using (true) with check (true);

drop policy if exists point_ledgers_select_all on public.point_ledgers;
create policy point_ledgers_select_all on public.point_ledgers for select to anon, authenticated using (true);
drop policy if exists point_ledgers_insert_all on public.point_ledgers;
create policy point_ledgers_insert_all on public.point_ledgers for insert to anon, authenticated with check (true);
drop policy if exists point_ledgers_update_all on public.point_ledgers;
create policy point_ledgers_update_all on public.point_ledgers for update to anon, authenticated using (true) with check (true);
