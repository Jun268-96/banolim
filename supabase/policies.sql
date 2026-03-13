grant usage on schema public to anon, authenticated;

grant select on public.member_score_summary to anon, authenticated;
grant select on public.point_rule_catalog to anon, authenticated;
grant select on public.activity_log_feed to anon, authenticated;

grant select on public.roles to anon, authenticated;
grant insert, update, delete on public.roles to authenticated;
grant select, insert, update on public.teams to anon, authenticated;
grant select on public.activity_groups to anon, authenticated;
grant insert, update, delete on public.activity_groups to authenticated;
grant select, insert, delete on public.member_team_links to authenticated;
grant select, insert, update on public.seasons to anon, authenticated;
grant select, insert, update on public.members to anon, authenticated;
grant select, insert, update on public.activity_types to anon, authenticated;
grant select, insert, update on public.point_rules to anon, authenticated;
grant select on public.activity_records to anon, authenticated;
grant select on public.point_ledgers to anon, authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.correction_requests to authenticated;
grant select on public.badges to authenticated;
grant select on public.member_badges to authenticated;
grant select, insert, update on public.announcements to authenticated;
grant select, insert, update on public.schedule_events to authenticated;
grant select, insert on public.recap_snapshots to authenticated;
grant select, insert, update on public.attendance_sessions to authenticated;
grant select, insert, update, delete on public.attendance_session_members to authenticated;
grant select on public.attendance_checkins to authenticated;
grant execute on function public.award_member_badges(uuid) to authenticated;
grant execute on function public.create_attendance_session(text, uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.create_activity_entry(uuid, uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.create_batch_activity_entries(uuid[], uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.complete_my_password_setup() to authenticated;
grant execute on function public.create_point_rule_version(uuid, integer, integer, jsonb) to authenticated;
grant execute on function public.get_my_activity_logs() to authenticated;
grant execute on function public.get_my_member_badges() to authenticated;
grant execute on function public.get_my_member_overview() to authenticated;
grant execute on function public.is_registered_login_email(text) to anon, authenticated;
grant execute on function public.reverse_activity_entry(uuid, text) to authenticated;
grant execute on function public.submit_attendance_checkin(text) to authenticated;
grant execute on function public.submit_correction_request(uuid, text) to authenticated;
grant execute on function public.update_correction_request_status(uuid, public.correction_request_status, text) to authenticated;

alter table public.roles enable row level security;
alter table public.teams enable row level security;
alter table public.activity_groups enable row level security;
alter table public.member_team_links enable row level security;
alter table public.seasons enable row level security;
alter table public.members enable row level security;
alter table public.activity_types enable row level security;
alter table public.point_rules enable row level security;
alter table public.activity_records enable row level security;
alter table public.point_ledgers enable row level security;
alter table public.audit_logs enable row level security;
alter table public.correction_requests enable row level security;
alter table public.badges enable row level security;
alter table public.member_badges enable row level security;
alter table public.announcements enable row level security;
alter table public.schedule_events enable row level security;
alter table public.recap_snapshots enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_session_members enable row level security;
alter table public.attendance_checkins enable row level security;

drop policy if exists roles_select_all on public.roles;
create policy roles_select_all on public.roles for select to anon, authenticated using (true);
drop policy if exists roles_insert_all on public.roles;
create policy roles_insert_all on public.roles for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists roles_update_all on public.roles;
create policy roles_update_all on public.roles for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());
drop policy if exists roles_delete_all on public.roles;
create policy roles_delete_all on public.roles for delete to authenticated using (public.can_manage_admin_tables());

drop policy if exists teams_select_all on public.teams;
create policy teams_select_all on public.teams for select to anon, authenticated using (true);
drop policy if exists teams_insert_all on public.teams;
create policy teams_insert_all on public.teams for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists teams_update_all on public.teams;
create policy teams_update_all on public.teams for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists activity_groups_select_all on public.activity_groups;
create policy activity_groups_select_all on public.activity_groups for select to anon, authenticated using (true);
drop policy if exists activity_groups_insert_all on public.activity_groups;
create policy activity_groups_insert_all on public.activity_groups for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists activity_groups_update_all on public.activity_groups;
create policy activity_groups_update_all on public.activity_groups for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());
drop policy if exists activity_groups_delete_all on public.activity_groups;
create policy activity_groups_delete_all on public.activity_groups for delete to authenticated using (public.can_manage_admin_tables());

drop policy if exists member_team_links_select_authenticated on public.member_team_links;
create policy member_team_links_select_authenticated
on public.member_team_links
for select
to authenticated
using (public.can_access_member(member_id));

drop policy if exists member_team_links_insert_authenticated on public.member_team_links;
create policy member_team_links_insert_authenticated
on public.member_team_links
for insert
to authenticated
with check (public.can_manage_admin_tables() and public.can_access_member(member_id));

drop policy if exists member_team_links_delete_authenticated on public.member_team_links;
create policy member_team_links_delete_authenticated
on public.member_team_links
for delete
to authenticated
using (public.can_manage_admin_tables() and public.can_access_member(member_id));

drop policy if exists seasons_select_all on public.seasons;
create policy seasons_select_all on public.seasons for select to anon, authenticated using (true);
drop policy if exists seasons_insert_all on public.seasons;
create policy seasons_insert_all on public.seasons for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists seasons_update_all on public.seasons;
create policy seasons_update_all on public.seasons for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists members_select_all on public.members;
create policy members_select_all on public.members for select to authenticated using (public.can_access_member(id));
drop policy if exists members_insert_all on public.members;
create policy members_insert_all on public.members for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists members_update_all on public.members;
create policy members_update_all on public.members for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists activity_types_select_all on public.activity_types;
create policy activity_types_select_all on public.activity_types for select to anon, authenticated using (true);
drop policy if exists activity_types_insert_all on public.activity_types;
create policy activity_types_insert_all on public.activity_types for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists activity_types_update_all on public.activity_types;
create policy activity_types_update_all on public.activity_types for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists point_rules_select_all on public.point_rules;
create policy point_rules_select_all on public.point_rules for select to anon, authenticated using (true);
drop policy if exists point_rules_insert_all on public.point_rules;
create policy point_rules_insert_all on public.point_rules for insert to authenticated with check (public.can_manage_admin_tables());
drop policy if exists point_rules_update_all on public.point_rules;
create policy point_rules_update_all on public.point_rules for update to authenticated using (public.can_manage_admin_tables()) with check (public.can_manage_admin_tables());

drop policy if exists activity_records_select_all on public.activity_records;
create policy activity_records_select_all on public.activity_records for select to authenticated using (public.can_access_member(member_id));
drop policy if exists activity_records_insert_all on public.activity_records;
drop policy if exists activity_records_update_all on public.activity_records;

drop policy if exists point_ledgers_select_all on public.point_ledgers;
create policy point_ledgers_select_all on public.point_ledgers for select to authenticated using (public.can_access_member(member_id));
drop policy if exists point_ledgers_insert_all on public.point_ledgers;
drop policy if exists point_ledgers_update_all on public.point_ledgers;

drop policy if exists audit_logs_select_authenticated on public.audit_logs;
create policy audit_logs_select_authenticated on public.audit_logs for select to authenticated using (public.can_manage_activities());

drop policy if exists correction_requests_select_authenticated on public.correction_requests;
create policy correction_requests_select_authenticated
on public.correction_requests
for select
to authenticated
using (
    requester_member_id = public.current_actor_member_id()
    or (public.can_manage_activities() and public.can_access_member(requester_member_id))
);

drop policy if exists badges_select_authenticated on public.badges;
create policy badges_select_authenticated
on public.badges
for select
to authenticated
using (true);

drop policy if exists member_badges_select_authenticated on public.member_badges;
create policy member_badges_select_authenticated
on public.member_badges
for select
to authenticated
using (public.can_access_member(member_id));

drop policy if exists announcements_select_authenticated on public.announcements;
create policy announcements_select_authenticated
on public.announcements
for select
to authenticated
using (true);

drop policy if exists announcements_insert_authenticated on public.announcements;
create policy announcements_insert_authenticated
on public.announcements
for insert
to authenticated
with check (public.can_manage_admin_tables());

drop policy if exists announcements_update_authenticated on public.announcements;
create policy announcements_update_authenticated
on public.announcements
for update
to authenticated
using (public.can_manage_admin_tables())
with check (public.can_manage_admin_tables());

drop policy if exists schedule_events_select_authenticated on public.schedule_events;
create policy schedule_events_select_authenticated
on public.schedule_events
for select
to authenticated
using (true);

drop policy if exists schedule_events_insert_authenticated on public.schedule_events;
create policy schedule_events_insert_authenticated
on public.schedule_events
for insert
to authenticated
with check (public.can_manage_admin_tables());

drop policy if exists schedule_events_update_authenticated on public.schedule_events;
create policy schedule_events_update_authenticated
on public.schedule_events
for update
to authenticated
using (public.can_manage_admin_tables())
with check (public.can_manage_admin_tables());

drop policy if exists recap_snapshots_select_authenticated on public.recap_snapshots;
create policy recap_snapshots_select_authenticated
on public.recap_snapshots
for select
to authenticated
using (
    (member_id is null and public.can_manage_activities())
    or (member_id is not null and public.can_access_member(member_id))
);

drop policy if exists recap_snapshots_insert_authenticated on public.recap_snapshots;
create policy recap_snapshots_insert_authenticated
on public.recap_snapshots
for insert
to authenticated
with check (
    public.can_manage_admin_tables()
    and (
        member_id is null
        or public.can_access_member(member_id)
    )
);

drop policy if exists attendance_sessions_select_authenticated on public.attendance_sessions;
create policy attendance_sessions_select_authenticated
on public.attendance_sessions
for select
to authenticated
using (public.can_manage_activities());

drop policy if exists attendance_sessions_insert_authenticated on public.attendance_sessions;
create policy attendance_sessions_insert_authenticated
on public.attendance_sessions
for insert
to authenticated
with check (public.can_manage_activities());

drop policy if exists attendance_sessions_update_authenticated on public.attendance_sessions;
create policy attendance_sessions_update_authenticated
on public.attendance_sessions
for update
to authenticated
using (public.can_manage_activities())
with check (public.can_manage_activities());

drop policy if exists attendance_session_members_select_authenticated on public.attendance_session_members;
create policy attendance_session_members_select_authenticated
on public.attendance_session_members
for select
to authenticated
using (public.can_access_member(member_id));

drop policy if exists attendance_session_members_insert_authenticated on public.attendance_session_members;
create policy attendance_session_members_insert_authenticated
on public.attendance_session_members
for insert
to authenticated
with check (public.can_manage_activities() and public.can_access_member(member_id));

drop policy if exists attendance_session_members_update_authenticated on public.attendance_session_members;
create policy attendance_session_members_update_authenticated
on public.attendance_session_members
for update
to authenticated
using (public.can_manage_activities() and public.can_access_member(member_id))
with check (public.can_manage_activities() and public.can_access_member(member_id));

drop policy if exists attendance_session_members_delete_authenticated on public.attendance_session_members;
create policy attendance_session_members_delete_authenticated
on public.attendance_session_members
for delete
to authenticated
using (public.can_manage_activities() and public.can_access_member(member_id));

drop policy if exists attendance_checkins_select_authenticated on public.attendance_checkins;
create policy attendance_checkins_select_authenticated
on public.attendance_checkins
for select
to authenticated
using (
    public.can_manage_activities()
    or member_id = public.current_actor_member_id()
);
