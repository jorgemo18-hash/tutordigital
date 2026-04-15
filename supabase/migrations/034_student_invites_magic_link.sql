-- 034_student_invites_magic_link.sql
-- Extend student_invites to support the magic-link invite flow.
-- Mirrors teacher_invites: code_hash for token verification, expires_at, display_name.

ALTER TABLE public.student_invites
  ADD COLUMN IF NOT EXISTS code_hash    text,
  ADD COLUMN IF NOT EXISTS expires_at   timestamptz,
  ADD COLUMN IF NOT EXISTS display_name text;

-- Fast lookup for redeem (email + status=pending)
CREATE INDEX IF NOT EXISTS idx_student_invites_email_pending
  ON public.student_invites (email)
  WHERE status = 'pending';
