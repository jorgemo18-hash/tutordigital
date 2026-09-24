-- 130_programaciones.sql
-- LAS PROGRAMACIONES DIDÁCTICAS QUE MONTA EL PROFESOR EN RECURSOS.
--
-- Recursos → Programación (24/9): el profesor elige materia y curso, el
-- currículo oficial (server/lib/curriculo/) pone competencias, criterios y
-- saberes, y él los agrupa en unidades didácticas, pone la evaluación y
-- escribe el resto de apartados del artículo 59.3 de la ORDEN
-- ECD/1172/2022. Esto guarda ese trabajo para seguirlo otro día.
--
-- `datos` es el documento entero (unidades, pesos de calificación, textos
-- de cada apartado) en JSON: su forma la decide y la valida la aplicación
-- (server/lib/programaciones/), y cambia más deprisa que una tabla por
-- apartado. Las columnas de fuera son lo que se lista y se filtra.
--
-- Se puede ejecutar dos veces.

create table if not exists public.programaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  creada_por uuid references public.profiles(id) on delete set null,
  materia_slug text not null,
  curso int check (curso between 1 and 4),
  titulo text not null default '',
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_programaciones_autor
  on public.programaciones (tenant_id, creada_por, updated_at desc);

-- Mismo criterio que el resto: el backend usa la clave de servicio y el
-- acceso real lo deciden las rutas; esto es la red de seguridad.
alter table public.programaciones enable row level security;

drop policy if exists programaciones_all on public.programaciones;
create policy programaciones_all on public.programaciones
for all to authenticated
using (public.has_active_role(tenant_id, array['admin', 'teacher']))
with check (public.has_active_role(tenant_id, array['admin', 'teacher']));
