create table if not exists public.activity_groups (
    code text primary key,
    name text not null unique,
    sort_order integer not null default 100,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

insert into public.activity_groups (code, name, sort_order)
values
    ('attendance', '출석', 10),
    ('study', '스터디', 20),
    ('contribution', '기여', 30),
    ('operations', '운영', 40),
    ('manual', '기타', 50)
on conflict (code) do update
set
    name = excluded.name,
    sort_order = excluded.sort_order,
    is_active = true;

insert into public.activity_groups (code, name, sort_order)
select
    at.group_name,
    case at.group_name
        when 'attendance' then '출석'
        when 'study' then '스터디'
        when 'contribution' then '기여'
        when 'operations' then '운영'
        when 'manual' then '기타'
        else at.group_name
    end,
    100
from public.activity_types at
where at.group_name is not null
  and length(trim(at.group_name)) > 0
  and not exists (
      select 1
      from public.activity_groups ag
      where ag.code = at.group_name
  );

grant select on public.activity_groups to anon, authenticated;
grant insert, update, delete on public.activity_groups to authenticated;

alter table public.activity_groups enable row level security;

drop policy if exists activity_groups_select_all on public.activity_groups;
create policy activity_groups_select_all on public.activity_groups
for select
to anon, authenticated
using (true);

drop policy if exists activity_groups_insert_all on public.activity_groups;
create policy activity_groups_insert_all on public.activity_groups
for insert
to authenticated
with check (public.can_manage_admin_tables());

drop policy if exists activity_groups_update_all on public.activity_groups;
create policy activity_groups_update_all on public.activity_groups
for update
to authenticated
using (public.can_manage_admin_tables())
with check (public.can_manage_admin_tables());

drop policy if exists activity_groups_delete_all on public.activity_groups;
create policy activity_groups_delete_all on public.activity_groups
for delete
to authenticated
using (public.can_manage_admin_tables());
