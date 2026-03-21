-- 018_groups_add_stage_year_track.sql
-- Adds stage/year/track columns referenced by the unique index in migration 016
-- but never defined with ADD COLUMN in any prior migration.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS year  text,
  ADD COLUMN IF NOT EXISTS track text;
