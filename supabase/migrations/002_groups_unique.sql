-- Ensure unique group names per tenant (normalized)
alter table if exists groups
  add column if not exists normalized_name text;

update groups
set normalized_name = lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))
where normalized_name is null;

-- Deduplicate existing groups by (tenant_id, normalized_name), keep oldest
with ranked as (
  select
    id,
    tenant_id,
    normalized_name,
    row_number() over (
      partition by tenant_id, normalized_name
      order by created_at asc, id asc
    ) as rn,
    first_value(id) over (
      partition by tenant_id, normalized_name
      order by created_at asc, id asc
    ) as keeper_id
  from groups
  where normalized_name is not null
),
dupes as (
  select id, keeper_id
  from ranked
  where rn > 1
)
update students
set group_id = d.keeper_id
from dupes d
where students.group_id = d.id;

with ranked as (
  select
    id,
    tenant_id,
    normalized_name,
    row_number() over (
      partition by tenant_id, normalized_name
      order by created_at asc, id asc
    ) as rn,
    first_value(id) over (
      partition by tenant_id, normalized_name
      order by created_at asc, id asc
    ) as keeper_id
  from groups
  where normalized_name is not null
),
dupes as (
  select id, keeper_id
  from ranked
  where rn > 1
)
update tasks
set group_id = d.keeper_id
from dupes d
where tasks.group_id = d.id;

with ranked as (
  select
    id,
    tenant_id,
    normalized_name,
    row_number() over (
      partition by tenant_id, normalized_name
      order by created_at asc, id asc
    ) as rn
  from groups
  where normalized_name is not null
)
delete from groups
where id in (
  select id from ranked where rn > 1
);

create unique index if not exists idx_groups_tenant_normalized
on groups (tenant_id, normalized_name);

-- Keep normalized_name in sync on insert/update
create or replace function set_group_normalized_name()
returns trigger as $$
begin
  new.normalized_name := lower(regexp_replace(trim(coalesce(new.name,'')), '\\s+', ' ', 'g'));
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_groups_normalized_name on groups;
create trigger trg_groups_normalized_name
before insert or update of name on groups
for each row
execute function set_group_normalized_name();
