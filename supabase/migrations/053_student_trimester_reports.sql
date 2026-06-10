-- student_trimester_reports: one AI narrative per (tenant, student, trimester, academic_year, subject_name)
CREATE TABLE IF NOT EXISTS student_trimester_reports (
  id              UUID         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       UUID         NOT NULL,
  student_id      UUID         NOT NULL,
  group_id        UUID,
  trimester       SMALLINT     NOT NULL CHECK (trimester BETWEEN 1 AND 3),
  academic_year   TEXT         NOT NULL,                  -- e.g. "2024-2025"
  subject_name    TEXT         NOT NULL DEFAULT '',
  narrative       TEXT         NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT uq_trimester_report
    UNIQUE (tenant_id, student_id, trimester, academic_year, subject_name)
);

CREATE INDEX IF NOT EXISTS idx_str_tenant_student
  ON student_trimester_reports (tenant_id, student_id);
