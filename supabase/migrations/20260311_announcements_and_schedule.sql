create table if not exists public.announcements (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    body text not null,
    starts_at timestamptz,
    ends_at timestamptz,
    is_pinned boolean not null default false,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.schedule_events (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    description text,
    location text,
    start_at timestamptz not null,
    end_at timestamptz,
    season_id uuid references public.seasons(id) on delete set null,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

grant select, insert, update on public.announcements to authenticated;
grant select, insert, update on public.schedule_events to authenticated;

alter table public.announcements enable row level security;
alter table public.schedule_events enable row level security;

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
