CREATE TABLE IF NOT EXISTS tutor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  duration_seconds integer NOT NULL DEFAULT 0,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tutor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students can insert own sessions"
ON tutor_sessions FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM students s
    WHERE s.id = student_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "teachers can read sessions of their group students"
ON tutor_sessions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id = tutor_sessions.tenant_id
      AND tm.role IN ('admin', 'teacher')
      AND tm.status = 'active'
  )
);
