-- Incremental migration for registered-email identity matching.
-- Operators pre-register a member's login_email, and only matched members can access the app.

alter table public.members
add column if not exists login_email text;

update public.members
set login_email = null
where login_email is not null
  and btrim(login_email) = '';

create unique index if not exists idx_members_login_email_unique
on public.members (lower(login_email))
where login_email is not null;

grant select on public.user_profiles to authenticated;
revoke insert, update on public.user_profiles from authenticated;

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
    is_active boolean
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
begin
    v_normalized_email := nullif(lower(btrim(coalesce(p_email, ''))), '');

    if v_normalized_email is not null then
        select
            members.id,
            members.name,
            public.member_role_scope(members.role_id),
            members.is_approved and members.is_visible and members.status <> 'inactive'
        into
            v_member_id,
            v_member_name,
            v_app_role,
            v_is_active
        from public.members
        where members.login_email is not null
          and lower(members.login_email) = v_normalized_email
        order by members.created_at asc
        limit 1;
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
    on conflict (id) do update
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
        user_profiles.is_active
    into
        id,
        email,
        member_id,
        app_role,
        display_name,
        is_active;

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
    is_active boolean
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

drop policy if exists user_profiles_update_own on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;

do $$
declare
    v_auth_user record;
begin
    for v_auth_user in
        select
            auth.users.id,
            coalesce(auth.users.email, concat(auth.users.id::text, '@banollim.app')) as email,
            coalesce(auth.users.raw_user_meta_data ->> 'full_name', auth.users.email, '반올림 회원') as display_name
        from auth.users
    loop
        perform *
        from public.upsert_user_profile_from_identity(
            v_auth_user.id,
            v_auth_user.email,
            v_auth_user.display_name
        );
    end loop;
end;
$$;
