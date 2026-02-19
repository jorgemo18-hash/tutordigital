-- Supabase tenant-isolation smoke (manual SQL editor).
-- This is a pseudo-test checklist to validate RLS behavior.
--
-- Run steps with real JWTs/sessions for users in two different tenants.

-- 1) Confirm RLS enabled
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'tenants','profiles','tenant_memberships','groups','students','tasks',
    'student_task_status','tickets','grades','invites','attachments','teacher_requests'
  )
order by tablename;

-- 2) Confirm policies present
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'tenants','profiles','tenant_memberships','groups','students','tasks',
    'student_task_status','tickets','grades','invites','attachments','teacher_requests'
  )
order by tablename, policyname;

-- 3) Function-level hardening visibility
select n.nspname, p.proname, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_group_normalized_name',
    'cleanup_rejected_students',
    'is_active_member',
    'has_active_role',
    'current_student_id',
    'current_student_group_id'
  )
order by p.proname;

-- 4) Manual A/B check (execute as authenticated user in tenant A):
-- Expected: returns 0 rows from tenant B.
-- select count(*) from public.groups where tenant_id = '<tenant_b_uuid>';
--
-- 5) Manual A/B insert guard (execute as tenant A user):
-- Expected: INSERT into tenant B fails with RLS error.
-- insert into public.tickets (tenant_id, title, status) values ('<tenant_b_uuid>', 'probe', 'open');

