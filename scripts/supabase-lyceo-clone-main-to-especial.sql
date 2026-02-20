with t as (
  select id as tenant_id
  from public.tenants
  where slug = 'lyceo'
  limit 1
),
base as (
  select g.*
  from public.groups g
  join t on t.tenant_id = g.tenant_id
  where g.variant = 'main'
),
to_insert as (
  select
    b.tenant_id,
    b.stage,
    b.year,
    b.track,
    'especial' as variant,
    (b.name || ' Especial') as name,
    lower(trim(regexp_replace(b.name || ' Especial', '\s+', ' ', 'g'))) as normalized_name
  from base b
)
insert into public.groups (tenant_id, stage, year, track, variant, name, normalized_name)
select tenant_id, stage, year, track, variant, name, normalized_name
from to_insert
on conflict (tenant_id, stage, year, track, variant)
do update set
  name = excluded.name,
  normalized_name = excluded.normalized_name;
