-- ==========================================================
-- SEED + BLINDAJE para tenant 'lyceo'
-- - normalized_name
-- - unique index (tenant_id, normalized_name)
-- - seed grupos estándar A–E
-- - seed extras opcionales (APOYO/DIVER/PT/AL)
-- ==========================================================

-- 0) Resolver tenant_id de Lyceo
with t as (
  select id as tenant_id
  from public.tenants
  where slug = 'lyceo'
  limit 1
)
select * from t;

-- 1) (Recomendado) PRECHECK duplicados por normalized_name (solo Lyceo)
with t as (
  select id as tenant_id
  from public.tenants
  where slug = 'lyceo'
  limit 1
),
norm as (
  select
    g.tenant_id,
    lower(trim(regexp_replace(g.name, '\s+', ' ', 'g'))) as nn,
    count(*) as c,
    array_agg(g.id) as ids,
    array_agg(g.name) as names
  from public.groups g
  where g.tenant_id = (select tenant_id from t)
  group by g.tenant_id, lower(trim(regexp_replace(g.name, '\s+', ' ', 'g')))
)
select *
from norm
where c > 1
order by c desc;

-- Si esto devuelve filas: hay duplicados a consolidar/renombrar antes de crear el UNIQUE.
-- Si devuelve 0 rows: perfecto, sigue.

-- 2) normalized_name + UNIQUE (blindaje real)
alter table public.groups
  add column if not exists normalized_name text;

update public.groups
set normalized_name = lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
where normalized_name is null;

create unique index if not exists groups_tenant_normalized_name_uniq
  on public.groups (tenant_id, normalized_name);

-- 3) Seed base: Primaria 1–6, ESO 1–4, Bach 1–2 con tracks A–E
with
t as (
  select id as tenant_id
  from public.tenants
  where slug = 'lyceo'
  limit 1
),
tracks as (
  select unnest(array['A','B','C','D','E']) as track
),
levels as (
  select 'Primaria'::text as stage, y as year from generate_series(1,6) y
  union all
  select 'ESO'::text as stage, y as year from generate_series(1,4) y
  union all
  select 'Bach'::text as stage, y as year from generate_series(1,2) y
),
rows_to_insert as (
  select
    (select tenant_id from t) as tenant_id,
    (stage || ' ' || year || ' ' || track) as name
  from levels
  cross join tracks
)
insert into public.groups (tenant_id, name, normalized_name)
select
  tenant_id,
  name,
  lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
from rows_to_insert
on conflict (tenant_id, normalized_name) do nothing;

-- 4) Extras opcionales (si quieres “apoyos” sin inventarte cursos duplicados)
-- Puedes editar esta lista tranquilamente.
with
t as (
  select id as tenant_id
  from public.tenants
  where slug = 'lyceo'
  limit 1
),
extra_tags as (
  select unnest(array['APOYO','DIVER','PT','AL']) as tag
),
tracks as (
  select unnest(array['A','B','C','D','E']) as track
),
levels as (
  select 'Primaria'::text as stage, y as year from generate_series(1,6) y
  union all
  select 'ESO'::text as stage, y as year from generate_series(1,4) y
),
rows_to_insert as (
  select
    (select tenant_id from t) as tenant_id,
    (stage || ' ' || year || ' ' || track || '-' || tag) as name
  from levels
  cross join tracks
  cross join extra_tags
)
insert into public.groups (tenant_id, name, normalized_name)
select
  tenant_id,
  name,
  lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
from rows_to_insert
on conflict (tenant_id, normalized_name) do nothing;

-- 5) CHECK: cuántos grupos tienes en Lyceo
with t as (
  select id as tenant_id
  from public.tenants
  where slug = 'lyceo'
  limit 1
)
select count(*) as lyceo_groups
from public.groups
where tenant_id = (select tenant_id from t);
