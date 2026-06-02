-- 049_session_teacher_reviewed.sql
-- Permite al profesor marcar una sesión como revisada,
-- incluso cuando el alumno no dejó nota (dot verde sin nota).

ALTER TABLE public.tutor_sessions
ADD COLUMN IF NOT EXISTS teacher_reviewed boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tutor_sessions'
      AND policyname = 'teachers_update_session_reviewed'
  ) THEN
    CREATE POLICY "teachers_update_session_reviewed"
    ON public.tutor_sessions FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.tenant_memberships tm
        WHERE tm.user_id = auth.uid()
          AND tm.tenant_id = tutor_sessions.tenant_id
          AND tm.role IN ('admin', 'teacher')
          AND tm.status = 'active'
      )
    )
    WITH CHECK (true);
  END IF;
END $$;
