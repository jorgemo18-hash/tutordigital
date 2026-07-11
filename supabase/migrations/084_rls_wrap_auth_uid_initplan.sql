-- Fix estándar del Advisor (auth_rls_initplan): envolver auth.uid() en
-- (select auth.uid()) para que Postgres lo evalúe una vez por consulta en
-- vez de una vez por fila. Reescritura mecánica, sin cambio semántico.
--
-- El Advisor real señala 29 políticas con este patrón, no solo las de
-- academia_*/tutor_sessions/student_notes — la mayoría (22) están en otras
-- tablas (attachments, grade_weights, session_attachments, session_messages,
-- student_invites, subjects, teacher_group_subjects, teacher_groups,
-- teacher_profiles, teacher_subjects, term_dates, tutor_session_maps) y
-- quedan FUERA de esta migración a propósito, según alcance acordado. Solo
-- se tocan las 7 que caen en academia_*/tutor_sessions/student_notes — ver
-- informe para el listado completo de las 22 restantes.

ALTER POLICY "admin puede gestionar categorias de su tenant" ON public.academia_gastos_categorias
  USING (tenant_id IN ( SELECT tenant_memberships.tenant_id
   FROM tenant_memberships
  WHERE ((tenant_memberships.user_id = (select auth.uid())) AND (tenant_memberships.role = 'admin'::text) AND (tenant_memberships.status = 'active'::text))));

ALTER POLICY students_insert_own_notes ON public.student_notes
  WITH CHECK (student_id IN ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid()))));

ALTER POLICY teachers_read_notes ON public.student_notes
  USING (EXISTS ( SELECT 1
   FROM (tutor_sessions ts
     JOIN tenant_memberships tm ON ((tm.tenant_id = ts.tenant_id)))
  WHERE ((ts.id = student_notes.session_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (tm.status = 'active'::text))));

ALTER POLICY teachers_update_is_read ON public.student_notes
  USING (EXISTS ( SELECT 1
   FROM (tutor_sessions ts
     JOIN tenant_memberships tm ON ((tm.tenant_id = ts.tenant_id)))
  WHERE ((ts.id = student_notes.session_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (tm.status = 'active'::text))))
  WITH CHECK (true);

ALTER POLICY "students can insert own sessions" ON public.tutor_sessions
  WITH CHECK (EXISTS ( SELECT 1
   FROM students s
  WHERE ((s.id = tutor_sessions.student_id) AND (s.user_id = (select auth.uid())))));

ALTER POLICY "teachers can read sessions of their group students" ON public.tutor_sessions
  USING (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = tutor_sessions.tenant_id) AND (tm.role = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (tm.status = 'active'::text))));

ALTER POLICY teachers_update_session_reviewed ON public.tutor_sessions
  USING (EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.user_id = (select auth.uid())) AND (tm.tenant_id = tutor_sessions.tenant_id) AND (tm.role = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (tm.status = 'active'::text))))
  WITH CHECK (true);
