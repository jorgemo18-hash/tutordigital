-- 021_groups_join_code_hint.sql
-- Guarda los primeros 4 caracteres del código de grupo para que el admin
-- pueda reconocer qué código corresponde a qué grupo sin almacenar el código completo.

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS join_code_hint text;
