-- Extiende 084_rls_wrap_auth_uid_initplan.sql a las 22 políticas restantes
-- del Advisor (auth_rls_initplan) que quedaron fuera de aquella migración
-- por alcance (academia_*/tutor_sessions/student_notes). Autorizado
-- extender a todas: attachments, grade_weights, session_attachments,
-- session_messages, student_invites, subjects, teacher_group_subjects,
-- teacher_groups, teacher_profiles, teacher_subjects, term_dates,
-- tutor_session_maps. Mismo tratamiento mecánico: envolver auth.uid() en
-- (select auth.uid()) para que Postgres lo evalúe una vez por consulta en
-- vez de una vez por fila — sin cambio semántico.
--
-- Única excepción de función: term_dates.tenant_isolation no usa
-- auth.uid() en absoluto, usa current_setting('app.tenant_slug', true) —
-- el Advisor también marca current_setting() por el mismo motivo (misma
-- re-evaluación por fila), así que se aplica el mismo tratamiento:
-- (select current_setting('app.tenant_slug'::text, true)).
--
-- Generado programáticamente a partir de pg_get_expr() de cada política
-- real (no transcrito a mano) para evitar errores en expresiones largas;
-- verificado antes de aplicar que el único cambio por política es el
-- envoltorio (select ...), y después de aplicar releyendo pg_policies.

ALTER POLICY attachments_select_teacher_admin_or_uploader ON public.attachments
  USING ((has_active_role(tenant_id, ARRAY['admin'::text, 'teacher'::text]) OR (uploader_id = (select auth.uid())) OR (has_active_role(tenant_id, ARRAY['student'::text]) AND (EXISTS ( SELECT 1
   FROM (students s
     JOIN tasks t ON (((t.group_id = s.group_id) AND (t.id = attachments.owner_id))))
  WHERE ((s.tenant_id = attachments.tenant_id) AND (s.user_id = (select auth.uid()))))))));

ALTER POLICY grade_weights_delete ON public.grade_weights
  USING ((tenant_id IN ( SELECT teacher_profiles.tenant_id
   FROM teacher_profiles
  WHERE (teacher_profiles.user_id = (select auth.uid())))));

ALTER POLICY grade_weights_insert ON public.grade_weights
  WITH CHECK ((tenant_id IN ( SELECT teacher_profiles.tenant_id
   FROM teacher_profiles
  WHERE (teacher_profiles.user_id = (select auth.uid())))));

ALTER POLICY grade_weights_select ON public.grade_weights
  USING ((tenant_id IN ( SELECT teacher_profiles.tenant_id
   FROM teacher_profiles
  WHERE (teacher_profiles.user_id = (select auth.uid())))));

ALTER POLICY grade_weights_update ON public.grade_weights
  USING ((tenant_id IN ( SELECT teacher_profiles.tenant_id
   FROM teacher_profiles
  WHERE (teacher_profiles.user_id = (select auth.uid())))));

ALTER POLICY student_own_attachments ON public.session_attachments
  USING ((student_id = ( SELECT students.id
   FROM students
  WHERE (students.user_id = (select auth.uid()))
 LIMIT 1)));

ALTER POLICY superadmin_all_attachments ON public.session_attachments
  USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND (profiles.is_superadmin = true)))));

ALTER POLICY teacher_tenant_attachments ON public.session_attachments
  USING ((tenant_id = ( SELECT teacher_profiles.tenant_id
   FROM teacher_profiles
  WHERE (teacher_profiles.user_id = (select auth.uid()))
 LIMIT 1)));

ALTER POLICY students_read_own_messages ON public.session_messages
  USING ((EXISTS ( SELECT 1
   FROM (tutor_sessions ts
     JOIN students s ON ((s.id = ts.student_id)))
  WHERE ((ts.id = session_messages.session_id) AND (s.user_id = (select auth.uid()))))));

ALTER POLICY teachers_read_messages ON public.session_messages
  USING ((EXISTS ( SELECT 1
   FROM (tutor_sessions ts
     JOIN tenant_memberships tm ON ((tm.tenant_id = ts.tenant_id)))
  WHERE ((ts.id = session_messages.session_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (tm.status = 'active'::text)))));

ALTER POLICY student_invites_admin_all ON public.student_invites
  USING ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.tenant_id = student_invites.tenant_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM tenant_memberships tm
  WHERE ((tm.tenant_id = student_invites.tenant_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))));

ALTER POLICY subjects_admin_all ON public.subjects
  USING ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN tenants t ON ((t.id = tm.tenant_id)))
  WHERE ((tm.user_id = (select auth.uid())) AND (t.slug = subjects.tenant_slug) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN tenants t ON ((t.id = tm.tenant_id)))
  WHERE ((tm.user_id = (select auth.uid())) AND (t.slug = subjects.tenant_slug) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))));

ALTER POLICY tgs_delete_admin ON public.teacher_group_subjects
  USING ((EXISTS ( SELECT 1
   FROM (groups g
     JOIN tenant_memberships m ON ((m.tenant_id = g.tenant_id)))
  WHERE ((g.id = teacher_group_subjects.group_id) AND (m.user_id = (select auth.uid())) AND (m.status = 'active'::text) AND (m.role = 'admin'::text)))));

ALTER POLICY tgs_insert_admin ON public.teacher_group_subjects
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (groups g
     JOIN tenant_memberships m ON ((m.tenant_id = g.tenant_id)))
  WHERE ((g.id = teacher_group_subjects.group_id) AND (m.user_id = (select auth.uid())) AND (m.status = 'active'::text) AND (m.role = 'admin'::text)))));

ALTER POLICY tgs_select_tenant_member ON public.teacher_group_subjects
  USING ((EXISTS ( SELECT 1
   FROM (groups g
     JOIN tenant_memberships m ON ((m.tenant_id = g.tenant_id)))
  WHERE ((g.id = teacher_group_subjects.group_id) AND (m.user_id = (select auth.uid())) AND (m.status = 'active'::text)))));

ALTER POLICY tgs_update_admin ON public.teacher_group_subjects
  USING ((EXISTS ( SELECT 1
   FROM (groups g
     JOIN tenant_memberships m ON ((m.tenant_id = g.tenant_id)))
  WHERE ((g.id = teacher_group_subjects.group_id) AND (m.user_id = (select auth.uid())) AND (m.status = 'active'::text) AND (m.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (groups g
     JOIN tenant_memberships m ON ((m.tenant_id = g.tenant_id)))
  WHERE ((g.id = teacher_group_subjects.group_id) AND (m.user_id = (select auth.uid())) AND (m.status = 'active'::text) AND (m.role = 'admin'::text)))));

ALTER POLICY teacher_groups_admin_all ON public.teacher_groups
  USING ((EXISTS ( SELECT 1
   FROM ((teacher_profiles tp
     JOIN tenant_memberships tm ON ((tm.user_id = (select auth.uid()))))
     JOIN tenants t ON (((t.id = tm.tenant_id) AND (t.slug = tp.tenant_slug))))
  WHERE ((tp.id = teacher_groups.teacher_profile_id) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM ((teacher_profiles tp
     JOIN tenant_memberships tm ON ((tm.user_id = (select auth.uid()))))
     JOIN tenants t ON (((t.id = tm.tenant_id) AND (t.slug = tp.tenant_slug))))
  WHERE ((tp.id = teacher_groups.teacher_profile_id) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))));

ALTER POLICY teacher_profiles_admin_all ON public.teacher_profiles
  USING ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN tenants t ON ((t.id = tm.tenant_id)))
  WHERE ((tm.user_id = (select auth.uid())) AND (t.slug = teacher_profiles.tenant_slug) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (tenant_memberships tm
     JOIN tenants t ON ((t.id = tm.tenant_id)))
  WHERE ((tm.user_id = (select auth.uid())) AND (t.slug = teacher_profiles.tenant_slug) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))));

ALTER POLICY teacher_subjects_admin_all ON public.teacher_subjects
  USING ((EXISTS ( SELECT 1
   FROM ((teacher_profiles tp
     JOIN tenant_memberships tm ON ((tm.user_id = (select auth.uid()))))
     JOIN tenants t ON (((t.id = tm.tenant_id) AND (t.slug = tp.tenant_slug))))
  WHERE ((tp.id = teacher_subjects.teacher_profile_id) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM ((teacher_profiles tp
     JOIN tenant_memberships tm ON ((tm.user_id = (select auth.uid()))))
     JOIN tenants t ON (((t.id = tm.tenant_id) AND (t.slug = tp.tenant_slug))))
  WHERE ((tp.id = teacher_subjects.teacher_profile_id) AND (tm.role = 'admin'::text) AND (tm.status = 'active'::text)))));

ALTER POLICY tenant_isolation ON public.term_dates
  USING ((tenant_id = ( SELECT tenants.id
   FROM tenants
  WHERE (tenants.slug = (select current_setting('app.tenant_slug'::text, true))))));

ALTER POLICY students_read_own_step_map ON public.tutor_session_maps
  USING ((EXISTS ( SELECT 1
   FROM (tutor_sessions ts
     JOIN students s ON ((s.id = ts.student_id)))
  WHERE ((ts.id = tutor_session_maps.session_id) AND (s.user_id = (select auth.uid()))))));

ALTER POLICY teachers_read_tenant_step_maps ON public.tutor_session_maps
  USING ((EXISTS ( SELECT 1
   FROM (tutor_sessions ts
     JOIN tenant_memberships tm ON ((tm.tenant_id = ts.tenant_id)))
  WHERE ((ts.id = tutor_session_maps.session_id) AND (tm.user_id = (select auth.uid())) AND (tm.role = ANY (ARRAY['admin'::text, 'teacher'::text])) AND (tm.status = 'active'::text)))));
