create table if not exists public.recap_snapshots (
    id uuid primary key default gen_random_uuid(),
    snapshot_scope text not null check (snapshot_scope in ('member', 'overall')),
    period_type text not null check (period_type in ('month', 'season')),
    title text not null,
    subtitle text not null,
    summary text not null,
    badge_label text not null,
    note text not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    member_id uuid references public.members(id) on delete set null,
    member_name text,
    season_id uuid references public.seasons(id) on delete set null,
    payload jsonb not null default '{}'::jsonb,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_recap_snapshots_scope_created on public.recap_snapshots (snapshot_scope, created_at desc);
create index if not exists idx_recap_snapshots_member_created on public.recap_snapshots (member_id, created_at desc);

grant select, insert on public.recap_snapshots to authenticated;

alter table public.recap_snapshots enable row level security;

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
