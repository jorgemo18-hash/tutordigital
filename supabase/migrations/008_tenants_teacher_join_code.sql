alter table tenants add column if not exists teacher_join_code_hash text;

create index if not exists idx_tenants_teacher_join_code_hash on tenants(teacher_join_code_hash);
