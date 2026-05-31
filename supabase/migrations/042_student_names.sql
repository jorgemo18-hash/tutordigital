-- 042_student_names.sql
-- Añade first_name y last_name en student_invites y students.
-- display_name se mantiene como campo calculado para compatibilidad con la app de alumno.
-- Actualiza redeem_student_invite con la nueva firma (p_first_name, p_last_name).

ALTER TABLE public.student_invites
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name  text;

-- Eliminar la función con la firma antigua para poder crear la nueva
DROP FUNCTION IF EXISTS public.redeem_student_invite(uuid, uuid, uuid, text, uuid);

CREATE OR REPLACE FUNCTION public.redeem_student_invite(
  p_tenant_id  uuid,
  p_user_id    uuid,
  p_group_id   uuid,
  p_first_name text,
  p_last_name  text,
  p_invite_id  uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
BEGIN
  v_display_name := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  IF v_display_name = '' THEN
    v_display_name := 'Alumno';
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (p_tenant_id, p_user_id, 'student', 'active')
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE
    SET status = 'active'
    WHERE tenant_memberships.role = 'student';

  INSERT INTO public.students (tenant_id, user_id, group_id, first_name, last_name, display_name, status, approval_status)
  VALUES (p_tenant_id, p_user_id, p_group_id, p_first_name, p_last_name, v_display_name, 'pending', 'approved')
  ON CONFLICT (tenant_id, user_id) WHERE user_id IS NOT NULL
  DO NOTHING;

  UPDATE public.student_invites
  SET status = 'used'
  WHERE id = p_invite_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_student_invite(uuid, uuid, uuid, text, text, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.redeem_student_invite(uuid, uuid, uuid, text, text, uuid) TO service_role;
