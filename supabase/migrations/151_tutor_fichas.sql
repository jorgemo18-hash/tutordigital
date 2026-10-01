-- 151_tutor_fichas.sql
-- LA HOJA SE PREPARA UNA VEZ, NO UNA VEZ POR ALUMNO (2/10/2026).
--
-- Hasta ahora cada alumno que abría una tarea lanzaba su propio análisis con
-- Opus (detectar los ejercicios y generar los pasos): 20 alumnos con la misma
-- hoja eran 20 análisis pagados, y cada uno podía recibir pasos distintos.
-- Aquí se guarda el análisis por centro y por HUELLA del enunciado (los
-- archivos, byte a byte, más las notas del profesor y la versión de la
-- guía): el primero que abre la hoja la prepara y los demás la leen.
--
-- Solo la usa el servidor (clave de servicio): RLS activado y sin políticas,
-- así que nadie la lee ni la escribe desde el navegador.
create table if not exists public.tutor_fichas (
  id              uuid        primary key default gen_random_uuid(),
  tenant_id       uuid        not null references public.tenants(id) on delete cascade,
  huella          text        not null,
  ejercicios      jsonb       not null default '[]'::jsonb,
  texto_documento text        not null default '',
  pasos           jsonb       not null default '{}'::jsonb,
  modelo          text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, huella)
);

alter table public.tutor_fichas enable row level security;
