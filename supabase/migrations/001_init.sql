-- Initial schema for Tutordigital (FASE 1)

create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  level text,
  created_at timestamptz not null default now()
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  display_name text not null,
  status text not null default 'pending' check (status in ('needs_teacher', 'pending', 'submitted')),
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  teacher_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('homework', 'exam', 'work')),
  title text not null,
  desc text,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  uploader_id uuid references auth.users(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  mime text,
  size bigint,
  created_at timestamptz not null default now()
);

create table if not exists student_task_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  task_id uuid not null references tasks(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  status text not null check (status in ('done', 'needs_teacher', 'pending')),
  updated_at timestamptz not null default now(),
  unique (task_id, student_id)
);

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  teacher_id uuid references auth.users(id) on delete set null,
  group_id uuid references groups(id) on delete set null,
  title text not null,
  detail text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists grades (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  student_id uuid references students(id) on delete set null,
  teacher_id uuid references auth.users(id) on delete set null,
  title text not null,
  score text not null,
  date date,
  created_at timestamptz not null default now()
);

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  role text not null check (role in ('admin', 'teacher', 'student')),
  code_hash text not null,
  expires_at timestamptz,
  max_uses int not null default 1,
  used_count int not null default 0,
  group_id uuid references groups(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_memberships_user on tenant_memberships(user_id);
create index if not exists idx_groups_tenant on groups(tenant_id);
create index if not exists idx_students_tenant on students(tenant_id);
create index if not exists idx_tasks_tenant on tasks(tenant_id);
create index if not exists idx_attachments_owner on attachments(owner_type, owner_id);
create index if not exists idx_tickets_tenant on tickets(tenant_id);
create index if not exists idx_grades_tenant on grades(tenant_id);
