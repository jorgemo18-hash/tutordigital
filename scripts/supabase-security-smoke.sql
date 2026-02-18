-- Supabase security smoke checks (read-only).
-- Run in SQL editor against your target environment.

-- 1) RLS status for all public tables
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;

-- 2) Policies currently defined in public
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 3) Function definitions (verify fixed search_path)
select n.nspname, p.proname, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('set_group_normalized_name', 'cleanup_rejected_students');
