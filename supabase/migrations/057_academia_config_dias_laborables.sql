-- 057_academia_config_dias_laborables.sql
-- Días laborables configurables por centro (1=lunes…6=sábado). El horario
-- semanal del profesor genera sus columnas a partir de este array — por
-- defecto lunes a viernes, pero el centro puede añadir sábado.
-- Ya aplicada en producción vía MCP (jzheomyuwztdhttejskz) — este archivo
-- solo deja la migración versionada en el repo.

ALTER TABLE public.academia_config
  ADD COLUMN IF NOT EXISTS dias_laborables jsonb DEFAULT '[1,2,3,4,5]'::jsonb;
