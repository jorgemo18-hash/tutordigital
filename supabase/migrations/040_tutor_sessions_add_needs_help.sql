ALTER TABLE tutor_sessions
  ADD COLUMN IF NOT EXISTS needs_help boolean NOT NULL DEFAULT false;
