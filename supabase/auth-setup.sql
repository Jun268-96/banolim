create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text not null unique,
    member_id uuid references public.members(id) on delete set null,
    app_role text not null default 'member',
    display_name text,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_email on public.user_profiles (email);
create index if not exists idx_user_profiles_member_id on public.user_profiles (member_id);

grant select, insert, update on public.user_profiles to authenticated;

create or replace function public.set_user_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.set_user_profiles_updated_at();

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.user_profiles (id, email, display_name, app_role, is_active)
    values (
        new.id,
        coalesce(new.email, concat(new.id::text, '@banollim.app')),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email, 'Banollim Member'),
        'member',
        true
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select_own on public.user_profiles;
create policy user_profiles_select_own
on public.user_profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists user_profiles_update_own on public.user_profiles;
create policy user_profiles_update_own
on public.user_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id);

-- Example role promotion:
-- update public.user_profiles
-- set app_role = 'operator'
-- where email = 'name@example.com';
