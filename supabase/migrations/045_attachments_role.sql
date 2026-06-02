ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS role TEXT
  CHECK (role IN ('statement', 'hint'))
  DEFAULT 'hint';
