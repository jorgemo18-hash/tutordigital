-- 01_add_variant_to_groups.sql

alter table public.groups
  add column if not exists variant text;

update public.groups
set variant = 'main'
where variant is null or variant = '';

-- ojo: si existía el índice antiguo, fuera
drop index if exists public.groups_tenant_stage_year_track_uniq;

create unique index if not exists groups_tenant_stage_year_track_variant_uniq
  on public.groups (tenant_id, stage, year, track, variant);

-- (opcional pero recomendable) mantener normalized_name único por tenant+variant
drop index if exists public.groups_tenant_normalized_name_uniq;

create unique index if not exists groups_tenant_variant_normalized_name_uniq
  on public.groups (tenant_id, variant, normalized_name);
