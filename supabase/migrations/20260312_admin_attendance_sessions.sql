create table if not exists public.attendance_sessions (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    session_code text not null unique,
    point_rule_id uuid not null references public.point_rules(id) on delete restrict,
    season_id uuid references public.seasons(id) on delete set null,
    starts_at timestamptz not null,
    ends_at timestamptz,
    note text,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

alter table public.attendance_sessions
    add column if not exists target_group_type text not null default 'all';

alter table public.attendance_sessions
    add column if not exists target_team_id uuid references public.teams(id) on delete set null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'attendance_sessions_target_group_type_check'
    ) then
        alter table public.attendance_sessions
            add constraint attendance_sessions_target_group_type_check
            check (target_group_type in ('all', 'team', 'ungrouped'));
    end if;
end $$;

create table if not exists public.attendance_session_members (
    id uuid primary key default gen_random_uuid(),
    session_id uuid not null references public.attendance_sessions(id) on delete cascade,
    member_id uuid not null references public.members(id) on delete cascade,
    attendance_status text not null default 'present',
    activity_record_id uuid references public.activity_records(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'attendance_session_members_attendance_status_check'
    ) then
        alter table public.attendance_session_members
            add constraint attendance_session_members_attendance_status_check
            check (attendance_status in ('present', 'late', 'absent'));
    end if;
end $$;

create unique index if not exists idx_attendance_session_members_unique
    on public.attendance_session_members (session_id, member_id);

create index if not exists idx_attendance_session_members_member
    on public.attendance_session_members (member_id, updated_at desc);

grant select, insert, update, delete on public.attendance_session_members to authenticated;

alter table public.attendance_session_members enable row level security;

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

notify pgrst, 'reload schema';
