alter table public.groups
  add column if not exists normalized_name text;

update public.groups
set normalized_name = lower(trim(regexp_replace(name, '\s+', ' ', 'g')))
where normalized_name is null;

create unique index if not exists groups_tenant_normalized_name_uniq
  on public.groups (tenant_id, normalized_name);
