grant select on public.roles to anon, authenticated;
grant insert, update, delete on public.roles to authenticated;

drop policy if exists roles_delete_all on public.roles;
create policy roles_delete_all
on public.roles
for delete
to authenticated
using (public.can_manage_admin_tables());
