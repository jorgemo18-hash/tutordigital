-- 048_session_messages.sql
-- Almacena el historial de mensajes de cada sesión del tutor IA.
-- El profesor los ve como burbujas de conversación en el drawer del cuaderno.

CREATE TABLE IF NOT EXISTS public.session_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES public.tutor_sessions(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS session_messages_session_id_idx ON public.session_messages(session_id);
CREATE INDEX IF NOT EXISTS session_messages_created_at_idx ON public.session_messages(session_id, created_at);

ALTER TABLE public.session_messages ENABLE ROW LEVEL SECURITY;

-- Alumnos: leer sus propios mensajes
CREATE POLICY "students_read_own_messages"
ON public.session_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_sessions ts
    JOIN public.students s ON s.id = ts.student_id
    WHERE ts.id = session_messages.session_id
      AND s.user_id = auth.uid()
  )
);

-- Profesores y admins: leer mensajes de su tenant
CREATE POLICY "teachers_read_messages"
ON public.session_messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_sessions ts
    JOIN public.tenant_memberships tm ON tm.tenant_id = ts.tenant_id
    WHERE ts.id = session_messages.session_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin', 'teacher')
      AND tm.status = 'active'
  )
);
