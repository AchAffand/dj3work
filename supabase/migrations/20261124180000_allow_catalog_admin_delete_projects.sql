-- Allow catalog admins to delete projects owned by other users.
-- Project owners retain their existing delete policy.
-- Child project rows already use ON DELETE CASCADE foreign keys.

drop policy if exists "catalog admins delete all projects" on public.projects;

create policy "catalog admins delete all projects"
on public.projects
for delete
to authenticated
using ((select private.is_catalog_admin()));
