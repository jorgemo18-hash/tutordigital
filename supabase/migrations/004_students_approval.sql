-- Add approval status for student access control
alter table if exists students
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id) on delete set null,
  add column if not exists rejected_reason text;

-- Existing students are considered approved
update students
set approval_status = 'approved'
where approval_status is null;

create index if not exists idx_students_approval
on students (tenant_id, group_id, approval_status);
