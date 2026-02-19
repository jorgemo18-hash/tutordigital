-- 013_functions_search_path_v7.sql
-- v7.x hardening: force explicit search_path for public SQL/plpgsql functions.
-- Safe to re-run.

-- Trigger / maintenance functions
alter function if exists public.set_group_normalized_name()
  set search_path = pg_catalog, public;

alter function if exists public.cleanup_rejected_students()
  set search_path = pg_catalog, public;

-- RLS helper functions (security definer)
alter function if exists public.is_active_member(uuid)
  set search_path = pg_catalog, public, auth;

alter function if exists public.has_active_role(uuid, text[])
  set search_path = pg_catalog, public, auth;

alter function if exists public.current_student_id(uuid)
  set search_path = pg_catalog, public, auth;

alter function if exists public.current_student_group_id(uuid)
  set search_path = pg_catalog, public, auth;

