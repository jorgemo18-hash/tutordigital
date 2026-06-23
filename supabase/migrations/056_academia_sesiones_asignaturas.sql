-- 056_academia_sesiones_asignaturas.sql
-- Soporta varias asignaturas por sesión (hasta 3, validado en el backend).
-- asignatura/tema (texto) se mantienen para compatibilidad con clientes
-- antiguos; al guardar se derivan de la primera entrada de este array.
-- Ya aplicada en producción vía MCP (jzheomyuwztdhttejskz) — este archivo
-- solo deja la migración versionada en el repo.

ALTER TABLE public.academia_sesiones
  ADD COLUMN IF NOT EXISTS asignaturas jsonb DEFAULT '[]'::jsonb;
