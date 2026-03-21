-- 020_student_invites.sql
-- Lista de emails autorizados por grupo + código de acceso por grupo.
-- Control: ¿está este email en la lista de este grupo?

-- Código de acceso por grupo (hash del código que el admin comparte con alumnos)
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS join_code_hash text;

CREATE INDEX IF NOT EXISTS idx_groups_join_code_hash
  ON public.groups (join_code_hash)
  WHERE join_code_hash IS NOT NULL;

-- Tabla de emails autorizados por grupo
CREATE TABLE IF NOT EXISTS public.student_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  group_id   uuid        NOT NULL REFERENCES public.groups(id)  ON DELETE CASCADE,
  email      text        NOT NULL,
  status     text        NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'used', 'revoked')),
  created_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Un email solo puede tener un invite activo por grupo
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_invites_group_email_pending
  ON public.student_invites (group_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_student_invites_tenant
  ON public.student_invites (tenant_id);

CREATE INDEX IF NOT EXISTS idx_student_invites_group
  ON public.student_invites (group_id);

ALTER TABLE public.student_invites ENABLE ROW LEVEL SECURITY;

-- Solo admins del tenant pueden gestionar los invites
DROP POLICY IF EXISTS student_invites_admin_all ON public.student_invites;
CREATE POLICY student_invites_admin_all
  ON public.student_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = student_invites.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      = 'admin'
        AND tm.status    = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = student_invites.tenant_id
        AND tm.user_id   = auth.uid()
        AND tm.role      = 'admin'
        AND tm.status    = 'active'
    )
  );
