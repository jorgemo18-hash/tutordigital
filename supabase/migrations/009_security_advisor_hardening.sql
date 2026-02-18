-- Security hardening for Supabase Security Advisor:
-- 1) Enable RLS on public tables (backend-only access via service_role).
-- 2) Fix mutable search_path on security-sensitive functions.

alter table if exists public.profiles enable row level security;
alter table if exists public.tenant_memberships enable row level security;
alter table if exists public.groups enable row level security;
alter table if exists public.tenants enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.attachments enable row level security;
alter table if exists public.student_task_status enable row level security;
alter table if exists public.tickets enable row level security;
alter table if exists public.grades enable row level security;
alter table if exists public.invites enable row level security;
alter table if exists public.students enable row level security;
alter table if exists public.teacher_requests enable row level security;

create or replace function public.set_group_normalized_name()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.normalized_name := lower(regexp_replace(trim(coalesce(new.name, '')), '\s+', ' ', 'g'));
  return new;
end;
$$;

create or replace function public.cleanup_rejected_students()
returns void
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  delete from students
  where approval_status = 'rejected'
    and rejected_at is not null
    and rejected_at < now() - interval '30 days';
end;
$$;
