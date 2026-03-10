create extension if not exists pgcrypto;

do $$
begin
    create type public.member_status as enum ('active', 'dormant', 'inactive');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.team_type as enum ('core', 'study', 'project');
exception
    when duplicate_object then null;
end
$$;

do $$
begin
    create type public.season_status as enum ('planned', 'active', 'closed');
exception
    when duplicate_object then null;
end
$$;

create table if not exists public.roles (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    permission_scope text not null,
    rank_order integer not null default 100,
    created_at timestamptz not null default now()
);

create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    type public.team_type not null default 'core',
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.seasons (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    start_date date not null,
    end_date date,
    status public.season_status not null default 'planned',
    created_at timestamptz not null default now()
);

create table if not exists public.members (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    role_id uuid references public.roles(id) on delete set null,
    team_id uuid references public.teams(id) on delete set null,
    status public.member_status not null default 'active',
    joined_at date not null default current_date,
    avatar_key text,
    is_visible boolean not null default true,
    is_approved boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists public.activity_types (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    name text not null,
    group_name text not null default 'general',
    created_at timestamptz not null default now()
);

create table if not exists public.point_rules (
    id uuid primary key default gen_random_uuid(),
    activity_type_id uuid not null references public.activity_types(id) on delete restrict,
    base_point integer not null,
    penalty_point integer not null default 0,
    condition_json jsonb not null default '{}'::jsonb,
    is_active boolean not null default true,
    version integer not null default 1,
    created_at timestamptz not null default now()
);

create table if not exists public.activity_records (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    season_id uuid references public.seasons(id) on delete set null,
    activity_type_id uuid not null references public.activity_types(id) on delete restrict,
    occurred_at timestamptz not null default now(),
    status text not null default 'confirmed',
    note text,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create table if not exists public.point_ledgers (
    id uuid primary key default gen_random_uuid(),
    record_id uuid not null references public.activity_records(id) on delete cascade,
    member_id uuid not null references public.members(id) on delete cascade,
    point_rule_id uuid not null references public.point_rules(id) on delete restrict,
    delta integer not null,
    reason text,
    created_by uuid references public.members(id) on delete set null,
    reversal_of uuid references public.point_ledgers(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_members_visible on public.members (is_visible, status);
create index if not exists idx_activity_records_member on public.activity_records (member_id, occurred_at desc);
create index if not exists idx_point_ledgers_member on public.point_ledgers (member_id, created_at desc);
create index if not exists idx_point_rules_activity_type on public.point_rules (activity_type_id, is_active);

create or replace view public.member_score_summary as
select
    m.id,
    m.name,
    m.is_approved,
    coalesce(sum(pl.delta), 0)::integer as score
from public.members m
left join public.point_ledgers pl on pl.member_id = m.id
where m.is_visible = true
group by m.id, m.name, m.is_approved;

create or replace view public.point_rule_catalog as
select
    pr.id,
    pr.activity_type_id,
    at.name as category_name,
    pr.base_point as point_value,
    pr.is_active,
    pr.version
from public.point_rules pr
join public.activity_types at on at.id = pr.activity_type_id;

create or replace view public.activity_log_feed as
select
    pl.id,
    pl.created_at as timestamp,
    pl.member_id,
    pl.point_rule_id as category_id,
    pl.delta as point_delta,
    pl.reason
from public.point_ledgers pl;
