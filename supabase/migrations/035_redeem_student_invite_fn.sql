-- 035_redeem_student_invite_fn.sql
-- Función atómica para canjear una invitación de alumno.
-- Ejecuta en una sola transacción:
--   1. Upsert tenant_membership (student / active)
--   2. Insert students record  (approval_status = approved)
--   3. Marca el invite como used
-- Si cualquier paso falla se hace rollback automático de todo.

CREATE OR REPLACE FUNCTION public.redeem_student_invite(
  p_tenant_id    uuid,
  p_user_id      uuid,
  p_group_id     uuid,
  p_display_name text,
  p_invite_id    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Upsert membresía de alumno.
  --    ON CONFLICT (tenant_id, user_id):
  --      · Si ya es alumno  → activar
  --      · Si es teacher/admin → DO UPDATE WHERE false → sin cambios (sin error)
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (p_tenant_id, p_user_id, 'student', 'active')
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE
    SET status = 'active'
    WHERE tenant_memberships.role = 'student';

  -- 2. Insert registro de alumno (idempotente vía índice parcial).
  INSERT INTO public.students (tenant_id, user_id, group_id, display_name, status, approval_status)
  VALUES (p_tenant_id, p_user_id, p_group_id, p_display_name, 'pending', 'approved')
  ON CONFLICT (tenant_id, user_id) WHERE user_id IS NOT NULL
  DO NOTHING;

  -- 3. Marcar invite como usado.
  UPDATE public.student_invites
  SET status = 'used'
  WHERE id = p_invite_id;
END;
$$;

-- Revocar permisos de ejecución pública; solo el rol service_role (backend) la llama.
REVOKE EXECUTE ON FUNCTION public.redeem_student_invite(uuid, uuid, uuid, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.redeem_student_invite(uuid, uuid, uuid, text, uuid) TO service_role;
