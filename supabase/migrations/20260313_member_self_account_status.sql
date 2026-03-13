drop function if exists public.get_my_member_overview();

create function public.get_my_member_overview()
returns table (
    id uuid,
    name text,
    score integer,
    is_approved boolean,
    role_id uuid,
    role_name text,
    team_id uuid,
    team_name text,
    status public.member_status,
    joined_at date,
    is_visible boolean,
    auth_user_id uuid,
    auth_provisioned_at timestamptz,
    password_reset_required boolean
)
language sql
stable
security definer
set search_path = public
as $$
    select
        m.id,
        m.name,
        coalesce(sum(pl.delta), 0)::integer as score,
        m.is_approved,
        m.role_id,
        r.name as role_name,
        m.team_id,
        t.name as team_name,
        m.status,
        m.joined_at,
        m.is_visible,
        m.auth_user_id,
        m.auth_provisioned_at,
        m.password_reset_required
    from public.members m
    left join public.roles r on r.id = m.role_id
    left join public.teams t on t.id = m.team_id
    left join public.point_ledgers pl on pl.member_id = m.id
    where m.id = public.current_actor_member_id()
      and m.is_visible = true
    group by
        m.id,
        m.name,
        m.is_approved,
        m.role_id,
        r.name,
        m.team_id,
        t.name,
        m.status,
        m.joined_at,
        m.is_visible,
        m.auth_user_id,
        m.auth_provisioned_at,
        m.password_reset_required;
$$;

grant execute on function public.get_my_member_overview() to authenticated;
