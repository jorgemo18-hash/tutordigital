-- 022_students_unique_user.sql
-- Un usuario solo puede ser alumno de un tenant una vez.
-- Esta constraint es necesaria para que el upsert en el registro funcione.

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_tenant_user
  ON public.students (tenant_id, user_id)
  WHERE user_id IS NOT NULL;
