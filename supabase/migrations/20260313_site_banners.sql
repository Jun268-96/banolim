create table if not exists public.site_banners (
    id uuid primary key default gen_random_uuid(),
    title text,
    image_url text not null,
    display_order integer not null default 100,
    is_active boolean not null default true,
    created_by uuid references public.members(id) on delete set null,
    created_at timestamptz not null default now()
);

create or replace function public.swap_banner_display_order(
    p_first_banner_id uuid,
    p_second_banner_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_first_order integer;
    v_second_order integer;
begin
    if not public.can_manage_admin_tables() then
        raise exception '배너 순서를 변경할 권한이 없습니다.';
    end if;

    select display_order
    into v_first_order
    from public.site_banners
    where id = p_first_banner_id
    for update;

    select display_order
    into v_second_order
    from public.site_banners
    where id = p_second_banner_id
    for update;

    if v_first_order is null or v_second_order is null then
        raise exception '순서를 변경할 배너를 찾지 못했습니다.';
    end if;

    update public.site_banners
    set display_order = case
        when id = p_first_banner_id then v_second_order
        when id = p_second_banner_id then v_first_order
        else display_order
    end
    where id in (p_first_banner_id, p_second_banner_id);
end;
$$;

grant select, insert, update, delete on public.site_banners to authenticated;
grant execute on function public.swap_banner_display_order(uuid, uuid) to authenticated;

alter table public.site_banners enable row level security;

drop policy if exists site_banners_select_authenticated on public.site_banners;
create policy site_banners_select_authenticated
on public.site_banners
for select
to authenticated
using (true);

drop policy if exists site_banners_insert_authenticated on public.site_banners;
create policy site_banners_insert_authenticated
on public.site_banners
for insert
to authenticated
with check (public.can_manage_admin_tables());

drop policy if exists site_banners_update_authenticated on public.site_banners;
create policy site_banners_update_authenticated
on public.site_banners
for update
to authenticated
using (public.can_manage_admin_tables())
with check (public.can_manage_admin_tables());

drop policy if exists site_banners_delete_authenticated on public.site_banners;
create policy site_banners_delete_authenticated
on public.site_banners
for delete
to authenticated
using (public.can_manage_admin_tables());
