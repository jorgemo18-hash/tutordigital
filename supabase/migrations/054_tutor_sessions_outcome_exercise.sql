-- 054_tutor_sessions_outcome_exercise.sql
-- Adds outcome and exercise_index to tutor_sessions (were applied out-of-band in production).
-- Using IF NOT EXISTS so re-running on a fresh DB is safe.

ALTER TABLE public.tutor_sessions
  ADD COLUMN IF NOT EXISTS outcome       text    CHECK (outcome IN ('in_progress','completed','abandoned','escalated')),
  ADD COLUMN IF NOT EXISTS exercise_index integer;

-- Students need SELECT on their own sessions for the historial API (server uses admin, but belt-and-suspenders).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'tutor_sessions'
      AND policyname = 'students_read_own_sessions'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "students_read_own_sessions"
      ON public.tutor_sessions FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.id = tutor_sessions.student_id
            AND s.user_id = auth.uid()
        )
      )
    $p$;
  END IF;
END $$;
