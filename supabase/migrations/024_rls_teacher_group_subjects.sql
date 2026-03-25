-- 024_rls_teacher_group_subjects.sql
-- Activa RLS en las dos tablas que lo tenían desactivado.
-- El service role bypasa RLS, por lo que el backend no se ve afectado.
-- Nota: las funciones helper (has_active_role, is_active_member) de 010_rls_policies_min.sql
-- no están aplicadas en producción, por lo que las políticas usan subqueries inline.

-- ── _group_merge_map ──────────────────────────────────────────────────────
-- Tabla auxiliar residual del backfill de grupos lyceo. Sin uso activo en
-- el código de producción. Se activa RLS sin políticas: queda bloqueada
-- totalmente para cualquier cliente autenticado o anónimo.
comment on table public._group_merge_map is
  'Residual del backfill de grupos lyceo (migración manual). Sin uso activo. RLS sin políticas = acceso bloqueado para todos los roles de cliente.';

alter table public._group_merge_map enable row level security;

-- ── teacher_group_subjects ────────────────────────────────────────────────
-- No tiene tenant_id propio; el tenant se deriva via group_id → groups.tenant_id.

alter table public.teacher_group_subjects enable row level security;

-- SELECT: miembro autenticado con membership activa en el mismo tenant
drop policy if exists tgs_select_tenant_member on public.teacher_group_subjects;
create policy tgs_select_tenant_member
  on public.teacher_group_subjects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.groups g
      join public.tenant_memberships m on m.tenant_id = g.tenant_id
      where g.id = group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
    )
  );

-- INSERT: solo admins del tenant
drop policy if exists tgs_insert_admin on public.teacher_group_subjects;
create policy tgs_insert_admin
  on public.teacher_group_subjects
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.groups g
      join public.tenant_memberships m on m.tenant_id = g.tenant_id
      where g.id = group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

-- UPDATE: solo admins del tenant
drop policy if exists tgs_update_admin on public.teacher_group_subjects;
create policy tgs_update_admin
  on public.teacher_group_subjects
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.groups g
      join public.tenant_memberships m on m.tenant_id = g.tenant_id
      where g.id = group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.groups g
      join public.tenant_memberships m on m.tenant_id = g.tenant_id
      where g.id = group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );

-- DELETE: solo admins del tenant
drop policy if exists tgs_delete_admin on public.teacher_group_subjects;
create policy tgs_delete_admin
  on public.teacher_group_subjects
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.groups g
      join public.tenant_memberships m on m.tenant_id = g.tenant_id
      where g.id = group_id
        and m.user_id = auth.uid()
        and m.status = 'active'
        and m.role = 'admin'
    )
  );
