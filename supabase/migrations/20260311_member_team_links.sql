create table if not exists public.member_team_links (
    id uuid primary key default gen_random_uuid(),
    member_id uuid not null references public.members(id) on delete cascade,
    team_id uuid not null references public.teams(id) on delete cascade,
    created_at timestamptz not null default now(),
    unique (member_id, team_id)
);

insert into public.member_team_links (member_id, team_id)
select distinct members.id, members.team_id
from public.members
where members.team_id is not null
on conflict (member_id, team_id) do nothing;

grant select, insert, delete on public.member_team_links to authenticated;

alter table public.member_team_links enable row level security;

drop policy if exists member_team_links_select_authenticated on public.member_team_links;
create policy member_team_links_select_authenticated
on public.member_team_links
for select
to authenticated
using (public.can_access_member(member_id));

drop policy if exists member_team_links_insert_authenticated on public.member_team_links;
create policy member_team_links_insert_authenticated
on public.member_team_links
for insert
to authenticated
with check (public.can_manage_admin_tables() and public.can_access_member(member_id));

drop policy if exists member_team_links_delete_authenticated on public.member_team_links;
create policy member_team_links_delete_authenticated
on public.member_team_links
for delete
to authenticated
using (public.can_manage_admin_tables() and public.can_access_member(member_id));

create or replace function public.member_team_id(p_member_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(
        (
            select members.team_id
            from public.members
            where members.id = p_member_id
            limit 1
        ),
        (
            select member_team_links.team_id
            from public.member_team_links
            where member_team_links.member_id = p_member_id
            order by member_team_links.created_at asc
            limit 1
        )
    );
$$;

create or replace function public.can_access_member(p_member_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_app_role text;
    v_current_member_id uuid;
begin
    v_app_role := coalesce(public.current_app_role(), 'member');

    if v_app_role in ('super_admin', 'operator') then
        return true;
    end if;

    v_current_member_id := public.current_actor_member_id();

    if v_current_member_id is null then
        return false;
    end if;

    if p_member_id = v_current_member_id then
        return true;
    end if;

    if v_app_role = 'team_lead' then
        return exists (
            select 1
            from public.member_team_links current_links
            join public.member_team_links target_links
              on target_links.team_id = current_links.team_id
            where current_links.member_id = v_current_member_id
              and target_links.member_id = p_member_id
        ) or public.member_team_id(v_current_member_id) = public.member_team_id(p_member_id);
    end if;

    return false;
end;
$$;
