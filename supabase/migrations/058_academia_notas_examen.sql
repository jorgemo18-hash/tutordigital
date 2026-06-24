-- 058_academia_notas_examen.sql
-- Notas de examen registradas desde la tarjeta del diario del profesor.
--
-- Correcciones sobre la propuesta original:
--   - profesor_id referencia teacher_profiles(id), igual que
--     academia_sesiones.profesor_id — el backend resuelve ese id a partir
--     de (tenant_id, user_id), nunca guarda auth.users.id directamente.
--   - La política RLS usa has_active_role(tenant_id, array[...]) (definida
--     en 013_functions_search_path_v7.sql), no una tabla "professor_profiles"
--     que no existe en este esquema. Un profesor puede tener fila en
--     teacher_profiles en varios tenants, así que un `tenant_id = (SELECT
--     ... WHERE user_id = auth.uid())` sin más filtros puede devolver más
--     de una fila y romper en tiempo de ejecución.
--   - Mismo nivel de confianza que academia_sesiones: admin+teacher con
--     CRUD completo en su tenant (es el mismo flujo del diario).

CREATE TABLE IF NOT EXISTS public.academia_notas_examen (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  alumno_id   uuid NOT NULL REFERENCES public.academia_alumnos(id) ON DELETE CASCADE,
  profesor_id uuid REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  fecha       date NOT NULL,
  asignatura  text NOT NULL,
  tema        text,
  nota        numeric(4,2) NOT NULL CHECK (nota >= 0 AND nota <= 10),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_academia_notas_examen_alumno ON public.academia_notas_examen(alumno_id);
CREATE INDEX IF NOT EXISTS idx_academia_notas_examen_tenant_fecha ON public.academia_notas_examen(tenant_id, fecha);

ALTER TABLE public.academia_notas_examen ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academia_notas_examen_admin_teacher_all ON public.academia_notas_examen;
CREATE POLICY academia_notas_examen_admin_teacher_all
ON public.academia_notas_examen
FOR ALL
TO authenticated
USING (public.has_active_role(tenant_id, array['admin','teacher']))
WITH CHECK (public.has_active_role(tenant_id, array['admin','teacher']));
