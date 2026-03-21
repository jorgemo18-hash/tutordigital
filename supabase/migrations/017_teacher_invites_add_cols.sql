-- 017_teacher_invites_add_cols.sql
-- Adds columns needed by the invite/redeem flow that were missing from migration 014.
-- The redeem endpoint reads these to auto-assign subjects and groups to the teacher.

ALTER TABLE public.teacher_invites
  ADD COLUMN IF NOT EXISTS display_name   text,
  ADD COLUMN IF NOT EXISTS subjects       text[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS group_ids      uuid[]    NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS tutor_group_id uuid      REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revoked_at     timestamptz;
