-- Seed de grupos por tenant (Primaria 1-6, ESO 1-4, Bachillerato 1-2) con vías A-E.
-- Uso:
-- 1) Reemplaza __TENANT_SLUG__ por el slug real (ej. lyceo)
-- 2) Ejecuta en Supabase SQL Editor
-- Requiere índice único por (tenant_id, normalized_name) para ON CONFLICT DO NOTHING.

with target_tenant as (
  select id
  from public.tenants
  where slug = '__TENANT_SLUG__'
  limit 1
),
tracks as (
  select unnest(array['A','B','C','D','E']) as track
),
primaria as (
  select tt.id as tenant_id, gs as year, t.track, 'primaria'::text as level
  from target_tenant tt
  cross join generate_series(1, 6) as gs
  cross join tracks t
),
eso as (
  select tt.id as tenant_id, gs as year, t.track, 'eso'::text as level
  from target_tenant tt
  cross join generate_series(1, 4) as gs
  cross join tracks t
),
bach as (
  select tt.id as tenant_id, gs as year, t.track, 'bachiller'::text as level
  from target_tenant tt
  cross join generate_series(1, 2) as gs
  cross join tracks t
),
all_groups as (
  select * from primaria
  union all
  select * from eso
  union all
  select * from bach
),
named as (
  select
    tenant_id,
    case
      when level = 'primaria' then (year::text || 'º Primaria ' || track)
      when level = 'eso' then (year::text || 'º ESO ' || track)
      else (year::text || 'º Bachillerato ' || track)
    end as name,
    level
  from all_groups
)
insert into public.groups (tenant_id, name, level, normalized_name)
select
  tenant_id,
  name,
  level,
  lower(trim(regexp_replace(name, '\s+', ' ', 'g'))) as normalized_name
from named
on conflict (tenant_id, normalized_name) do nothing;

-- Verificación rápida:
-- select level, count(*) from public.groups g
-- join public.tenants t on t.id = g.tenant_id
-- where t.slug = '__TENANT_SLUG__'
-- group by level
-- order by level;
