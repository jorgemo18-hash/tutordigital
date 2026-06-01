-- 047_student_notes.sql
-- Tabla para que el alumno deje una nota para el profesor durante/tras la sesión IA.
-- El profesor la ve en el drawer del cuaderno y puede marcarla como leída.

CREATE TABLE IF NOT EXISTS public.student_notes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  task_id     uuid        REFERENCES public.tasks(id) ON DELETE CASCADE,
  student_id  uuid        NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  group_id    uuid,
  note_text   text        NOT NULL CHECK (char_length(note_text) >= 1 AND char_length(note_text) <= 2000),
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS student_notes_session_id_idx ON public.student_notes(session_id);
CREATE INDEX IF NOT EXISTS student_notes_student_id_idx ON public.student_notes(student_id);
CREATE INDEX IF NOT EXISTS student_notes_group_id_idx   ON public.student_notes(group_id);

ALTER TABLE public.student_notes ENABLE ROW LEVEL SECURITY;

-- Alumnos: solo pueden insertar sus propias notas
CREATE POLICY "students_insert_own_notes"
ON public.student_notes FOR INSERT TO authenticated
WITH CHECK (
  student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  )
);

-- Profesores y admins: leer notas de alumnos de su tenant
CREATE POLICY "teachers_read_notes"
ON public.student_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_sessions ts
    JOIN public.tenant_memberships tm ON tm.tenant_id = ts.tenant_id
    WHERE ts.id = student_notes.session_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'teacher')
      AND tm.status = 'active'
  )
);

-- Profesores y admins: actualizar is_read
CREATE POLICY "teachers_update_is_read"
ON public.student_notes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_sessions ts
    JOIN public.tenant_memberships tm ON tm.tenant_id = ts.tenant_id
    WHERE ts.id = student_notes.session_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'teacher')
      AND tm.status = 'active'
  )
)
WITH CHECK (true);
