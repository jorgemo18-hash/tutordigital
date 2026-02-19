-- 011_enable_rls_v7.sql
-- v7.x hardening: ensure RLS is enabled on all multi-tenant tables.
-- Safe to re-run.

alter table if exists public.tenants enable row level security;
alter table if exists public.profiles enable row level security;
alter table if exists public.tenant_memberships enable row level security;
alter table if exists public.groups enable row level security;
alter table if exists public.students enable row level security;
alter table if exists public.tasks enable row level security;
alter table if exists public.attachments enable row level security;
alter table if exists public.student_task_status enable row level security;
alter table if exists public.tickets enable row level security;
alter table if exists public.grades enable row level security;
alter table if exists public.invites enable row level security;
alter table if exists public.teacher_requests enable row level security;

