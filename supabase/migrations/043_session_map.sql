-- 043_session_map.sql
-- Tabla de mapas de pasos por sesión de tutor, generados por el Agente Guía (Opus).
-- Relación 1:1 con tutor_sessions — cada sesión tiene exactamente un mapa.

CREATE TABLE IF NOT EXISTS public.tutor_session_maps (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid        NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  steps        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  current_step integer     NOT NULL DEFAULT 0,
  guide_model  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tutor_session_maps_session_id_idx
  ON public.tutor_session_maps (session_id);

ALTER TABLE public.tutor_session_maps ENABLE ROW LEVEL SECURITY;

-- Alumnos: leer su propio mapa
CREATE POLICY "students_read_own_step_map"
ON public.tutor_session_maps FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_sessions ts
    JOIN public.students s ON s.id = ts.student_id
    WHERE ts.id = tutor_session_maps.session_id
      AND s.user_id = auth.uid()
  )
);

-- Profesores y admins: leer mapas de su tenant
CREATE POLICY "teachers_read_tenant_step_maps"
ON public.tutor_session_maps FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_sessions ts
    JOIN public.tenant_memberships tm ON tm.tenant_id = ts.tenant_id
    WHERE ts.id = tutor_session_maps.session_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'teacher')
      AND tm.status = 'active'
  )
);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_session_map_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_session_map_updated_at
  BEFORE UPDATE ON public.tutor_session_maps
  FOR EACH ROW EXECUTE FUNCTION public.set_session_map_updated_at();
