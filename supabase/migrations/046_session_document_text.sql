-- 046_session_document_text.sql
-- Almacena el texto extraído del enunciado (PDF/DOCX) en la sesión del tutor.
-- Permite al Socrático leer el documento sin descargarlo en cada mensaje.

ALTER TABLE public.tutor_session_maps
  ADD COLUMN IF NOT EXISTS document_text text;
