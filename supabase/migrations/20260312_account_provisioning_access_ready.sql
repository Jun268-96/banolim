update public.members
set is_approved = true
where auth_user_id is not null
  and is_approved = false;

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
