-- 037_attachments_student_upload.sql
-- Permite a estudiantes subir archivos de contexto a sus propias tareas.
--
-- Contexto:
--   · El servidor usa createSupabaseAdmin() para todas las operaciones de Storage
--     y de la tabla attachments, por lo que estas políticas son defensa en
--     profundidad (no bloquean el flujo actual del servidor).
--   · uploader_id se graba en todos los INSERTs a partir de esta versión.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. RLS en public.attachments
--    Actualizar la política SELECT para que los estudiantes también puedan leer
--    los adjuntos de las tareas de su grupo (necesario para firmar URLs de
--    adjuntos del profesor que se pasan al chat).
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS attachments_select_teacher_admin_or_uploader ON public.attachments;
CREATE POLICY attachments_select_teacher_admin_or_uploader
ON public.attachments
FOR SELECT
TO authenticated
USING (
  public.has_active_role(tenant_id, ARRAY['admin','teacher'])
  OR uploader_id = auth.uid()
  OR (
    -- Estudiante puede leer adjuntos de tareas de su grupo
    public.has_active_role(tenant_id, ARRAY['student'])
    AND EXISTS (
      SELECT 1 FROM public.students s
      JOIN public.tasks t ON t.group_id = s.group_id AND t.id = public.attachments.owner_id
      WHERE s.tenant_id = public.attachments.tenant_id
        AND s.user_id   = auth.uid()
    )
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Storage policies en storage.objects (bucket task-attachments)
--    Path en bucket: {tenant_id}/{task_id}/{attachment_id}_{filename}
--    storage.foldername(name) → ARRAY['{tenant_id}', '{task_id}']  (1-indexed en PG)
-- ─────────────────────────────────────────────────────────────────────────────

-- INSERT: el estudiante solo puede subir a tareas de su grupo
DROP POLICY IF EXISTS "students can insert attachments for their tasks" ON storage.objects;
CREATE POLICY "students can insert attachments for their tasks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.tasks t ON t.group_id = s.group_id
    WHERE s.user_id   = auth.uid()
      AND s.tenant_id = t.tenant_id
      AND t.id::text  = (storage.foldername(name))[2]
  )
);

-- SELECT: el estudiante puede leer objetos de tareas de su grupo
DROP POLICY IF EXISTS "students can read attachments for their tasks" ON storage.objects;
CREATE POLICY "students can read attachments for their tasks"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'task-attachments'
  AND EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.tasks t ON t.group_id = s.group_id
    WHERE s.user_id   = auth.uid()
      AND s.tenant_id = t.tenant_id
      AND t.id::text  = (storage.foldername(name))[2]
  )
);
