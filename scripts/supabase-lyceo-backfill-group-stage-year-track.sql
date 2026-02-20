-- ==========================================================
-- Lyceo: diagnóstico + backfill stage/year/track en groups
-- ==========================================================

-- 1) ¿Cuántos groups tienen NULL en stage/year/track?
select
  sum(case when g.stage is null then 1 else 0 end) as stage_null,
  sum(case when g.year  is null then 1 else 0 end) as year_null,
  sum(case when g.track is null then 1 else 0 end) as track_null,
  count(*) as total
from public.groups g
join public.tenants t on t.id = g.tenant_id
where t.slug = 'lyceo';

-- 2) Ejemplos mal formados
select g.id, g.name, g.normalized_name, g.stage, g.year, g.track, g.variant
from public.groups g
join public.tenants t on t.id = g.tenant_id
where t.slug = 'lyceo'
  and (g.stage is null or g.year is null or g.track is null)
order by g.created_at nulls last
limit 20;

-- 3) Backfill stage/year/track desde name cuando estén NULL
with lyceo as (
  select t.id as tenant_id
  from public.tenants t
  where t.slug = 'lyceo'
)
update public.groups g
set
  stage = coalesce(g.stage,
    case
      when g.name ~* '^\s*ESO\b' then 'ESO'
      when g.name ~* '^\s*BACH\b' then 'BACH'
      when g.name ~* '^\s*PRI\b|^\s*PRIM\b|^\s*PRIMARIA\b' then 'PRI'
      else g.stage
    end
  ),
  year = coalesce(g.year,
    nullif((regexp_match(g.name, '^\s*(?:ESO|BACH|PRI|PRIM|PRIMARIA)\s+(\d)'))[1], '')::int
  ),
  track = coalesce(g.track,
    nullif((regexp_match(g.name, '\b([A-E])\b'))[1], '')
  )
from lyceo
where g.tenant_id = lyceo.tenant_id
  and (g.stage is null or g.year is null or g.track is null);

-- 4) Recheck
select
  sum(case when g.stage is null then 1 else 0 end) as stage_null,
  sum(case when g.year  is null then 1 else 0 end) as year_null,
  sum(case when g.track is null then 1 else 0 end) as track_null,
  count(*) as total
from public.groups g
join public.tenants t on t.id = g.tenant_id
where t.slug = 'lyceo';
