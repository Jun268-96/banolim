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

grant select on public.user_profiles to authenticated;
revoke insert, update on public.user_profiles from authenticated;

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

create or replace function public.member_role_scope(p_role_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select case
                when roles.permission_scope in ('super_admin', 'operator', 'team_lead', 'member')
                    then roles.permission_scope
                else 'member'
            end
            from public.roles
            where roles.id = p_role_id
            limit 1
        ),
        'member'
    );
$$;

create or replace function public.is_registered_login_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists(
        select 1
        from public.members
        where members.login_email is not null
          and lower(members.login_email) = lower(btrim(coalesce(p_email, '')))
          and members.is_visible = true
          and members.status <> 'inactive'
        limit 1
    );
$$;

alter table public.members
add column if not exists auth_user_id uuid;

alter table public.members
add column if not exists auth_provisioned_at timestamptz;

alter table public.members
add column if not exists password_reset_required boolean not null default false;

create unique index if not exists idx_members_auth_user_id_unique
on public.members (auth_user_id)
where auth_user_id is not null;

drop function if exists public.sync_my_profile();
drop function if exists public.upsert_user_profile_from_identity(uuid, text, text);

create or replace function public.upsert_user_profile_from_identity(
    p_user_id uuid,
    p_email text,
    p_display_name text default null
)
returns table (
    id uuid,
    email text,
    member_id uuid,
    app_role text,
    display_name text,
    is_active boolean,
    must_reset_password boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_normalized_email text;
    v_profile_display_name text;
    v_member_id uuid;
    v_member_name text;
    v_app_role text := 'member';
    v_is_active boolean := false;
    v_must_reset_password boolean := false;
begin
    v_normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

    if v_normalized_email is not null then
        select
            members.id,
            members.name,
            public.member_role_scope(members.role_id),
            members.is_visible and members.status = 'active' and members.auth_user_id is not null and members.login_email is not null,
            coalesce(members.password_reset_required, false)
        into
            v_member_id,
            v_member_name,
            v_app_role,
            v_is_active,
            v_must_reset_password
        from public.members
        where members.login_email is not null
          and lower(members.login_email) = v_normalized_email
        order by members.created_at asc
        limit 1;

        if v_member_id is not null then
            update public.members
            set auth_user_id = coalesce(auth_user_id, p_user_id)
            where members.id = v_member_id
              and (members.auth_user_id is null or members.auth_user_id = p_user_id);
        end if;
    end if;

    v_profile_display_name := coalesce(
        v_member_name,
        nullif(btrim(coalesce(p_display_name, '')), ''),
        v_normalized_email,
        '반올림 회원'
    );

    insert into public.user_profiles (
        id,
        email,
        member_id,
        app_role,
        display_name,
        is_active
    )
    values (
        p_user_id,
        coalesce(v_normalized_email, concat(p_user_id::text, '@banollim.app')),
        v_member_id,
        coalesce(v_app_role, 'member'),
        v_profile_display_name,
        coalesce(v_is_active, false)
    )
    on conflict on constraint user_profiles_pkey do update
    set
        email = excluded.email,
        member_id = excluded.member_id,
        app_role = excluded.app_role,
        display_name = excluded.display_name,
        is_active = excluded.is_active
    returning
        user_profiles.id,
        user_profiles.email,
        user_profiles.member_id,
        user_profiles.app_role,
        user_profiles.display_name,
        user_profiles.is_active,
        coalesce(v_must_reset_password, false)
    into
        id,
        email,
        member_id,
        app_role,
        display_name,
        is_active,
        must_reset_password;

    return next;
end;
$$;

create or replace function public.sync_my_profile()
returns table (
    id uuid,
    email text,
    member_id uuid,
    app_role text,
    display_name text,
    is_active boolean,
    must_reset_password boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_email text;
    v_display_name text;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception '로그인 세션이 없습니다.';
    end if;

    v_email := auth.jwt() ->> 'email';
    v_display_name := coalesce(
        auth.jwt() -> 'user_metadata' ->> 'full_name',
        auth.jwt() ->> 'email',
        '반올림 회원'
    );

    return query
    select *
    from public.upsert_user_profile_from_identity(
        v_user_id,
        coalesce(v_email, concat(v_user_id::text, '@banollim.app')),
        v_display_name
    );
end;
$$;

grant execute on function public.sync_my_profile() to authenticated;
grant execute on function public.is_registered_login_email(text) to anon, authenticated;

create or replace function public.complete_my_password_setup()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_member_id uuid;
begin
    v_member_id := public.current_actor_member_id();

    if v_member_id is null then
        raise exception '회원 프로필이 연결되지 않았습니다.';
    end if;

    update public.members
    set
        password_reset_required = false,
        auth_user_id = coalesce(auth_user_id, auth.uid())
    where members.id = v_member_id;
end;
$$;

grant execute on function public.complete_my_password_setup() to authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    perform *
    from public.upsert_user_profile_from_identity(
        new.id,
        coalesce(new.email, concat(new.id::text, '@banollim.app')),
        coalesce(new.raw_user_meta_data ->> 'full_name', new.email, '반올림 회원')
    );

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
drop policy if exists user_profiles_insert_own on public.user_profiles;

-- Example bootstrap:
-- 1) 운영진이 members.login_email에 실제 로그인 이메일을 미리 등록한다.
-- 2) 사용자가 해당 이메일로 로그인하면 member_id / app_role이 자동 연결된다.
