-- 044_session_exercises.sql
-- Añade columna exercises a tutor_session_maps para almacenar la lista
-- de ejercicios detectados por el Agente Guía en la fase de detección.
-- Se usa cuando la tarea tiene múltiples ejercicios y el alumno debe elegir.

ALTER TABLE public.tutor_session_maps
  ADD COLUMN IF NOT EXISTS exercises jsonb NOT NULL DEFAULT '[]'::jsonb;
