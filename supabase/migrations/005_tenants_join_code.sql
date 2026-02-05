-- Add join code hash to tenants for one-time enrollment
alter table if exists tenants
  add column if not exists join_code_hash text;

create index if not exists idx_tenants_join_code_hash
on tenants (join_code_hash);
