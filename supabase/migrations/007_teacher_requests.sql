create table if not exists teacher_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  unique (tenant_id, requested_by)
);

create index if not exists idx_teacher_requests_tenant_status on teacher_requests(tenant_id, status);
