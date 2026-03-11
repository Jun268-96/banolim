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

grant execute on function public.is_registered_login_email(text) to anon, authenticated;
