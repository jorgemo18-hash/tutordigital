-- 012_policies_v7_teacher_requests.sql
-- v7.x hardening: add missing teacher_requests policies with tenant isolation.
--
-- Existing baseline policies for tenants/groups/students/tasks/tickets/grades/etc
-- are defined in 010_rls_policies_min.sql.
-- This migration only completes teacher_requests.

-- Select:
-- - requester can see own requests
-- - active admin/teacher of same tenant can see tenant requests
drop policy if exists teacher_requests_select_self_or_admin_teacher on public.teacher_requests;
create policy teacher_requests_select_self_or_admin_teacher
on public.teacher_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or public.has_active_role(tenant_id, array['admin','teacher'])
);

-- Insert:
-- - requester can create own request row
-- - active admin/teacher may create on behalf of requester
drop policy if exists teacher_requests_insert_self_or_admin_teacher on public.teacher_requests;
create policy teacher_requests_insert_self_or_admin_teacher
on public.teacher_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
  or public.has_active_role(tenant_id, array['admin','teacher'])
);

-- Update/Delete:
-- - only active admin can decide/cleanup requests in tenant
drop policy if exists teacher_requests_update_admin on public.teacher_requests;
create policy teacher_requests_update_admin
on public.teacher_requests
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists teacher_requests_delete_admin on public.teacher_requests;
create policy teacher_requests_delete_admin
on public.teacher_requests
for delete
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

