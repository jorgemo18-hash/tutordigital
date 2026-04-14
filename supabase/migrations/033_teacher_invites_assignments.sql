-- 033_teacher_invites_assignments.sql
-- Adds structured assignments JSONB to teacher_invites and subject_id to teacher_groups.
-- Existing subjects[] and group_ids[] columns are kept for backward compat.

-- teacher_groups: track which subject a teacher teaches to each group
ALTER TABLE public.teacher_groups
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL;

-- teacher_invites: structured assignments instead of flat arrays
ALTER TABLE public.teacher_invites
  ADD COLUMN IF NOT EXISTS assignments jsonb;

COMMENT ON COLUMN public.teacher_invites.assignments IS
  'Array of {subject: string, group_ids: uuid[]}. Supersedes flat subjects[] and group_ids[] for new invites.';
