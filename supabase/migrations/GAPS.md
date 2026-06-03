# Migration gaps and out-of-band changes

## Migrations 010-036 (applied before Supabase CLI tracking)

Migrations 010 through 036 were applied directly in the Supabase dashboard
before the project adopted CLI-based migration tracking.  
They were registered manually in `supabase_migrations.schema_migrations` on
2026-06-03 using:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('010', 'rls_policies_min'), ('011', 'enable_rls_v7'), ...
ON CONFLICT (version) DO NOTHING;
```

All 27 files exist in this directory (010_*.sql – 036_*.sql) and were applied
in order. A full DB rebuild must run them in the order shown in the file list.

## Migration 039 (tutor_sessions base table)

`039_tutor_sessions.sql` creates the `tutor_sessions` table.  
It does **not** appear with a numeric "039" version in the DB; instead it was
applied as part of an earlier timestamp migration. The table exists in
production and the file in the repo is the authoritative DDL.  
`040_tutor_sessions_add_needs_help.sql` depends on 039 running first.

## Timestamp-versioned migrations (applied via Supabase CLI)

From migration 037 onwards the project uses timestamp-based versions generated
by the Supabase CLI. The mapping between repo files and DB versions is:

| Repo file                          | DB version         |
|------------------------------------|--------------------|
| 037_attachments_student_upload.sql | 20260518074900     |
| 038_tasks_add_teacher_notes.sql    | 20260518204622     |
| 039_tutor_sessions.sql             | (see note above)   |
| 040_tutor_sessions_add_needs_help  | 20260521210105     |
| 041_teacher_group_subjects_unique  | 20260531093726*    |
| 042_student_names.sql              | 20260531164040     |
| 043_session_map.sql                | 20260601080633     |
| 044_session_exercises.sql          | 20260601164301     |
| 045_attachments_role.sql           | 20260601190935     |
| 046_session_document_text.sql      | 20260601193159     |
| 047_student_notes.sql              | 20260602000537     |
| 048_session_messages.sql           | 20260602000540     |
| 049_session_teacher_reviewed.sql   | 20260602202735     |

\* The DB also contains versions 20260518074844 (037a_rls_helper_functions) and
20260522073824 (041_grades_add_task_id) and 20260513192439 (explicit_grants_all_tables)
which were applied out-of-band and do not have corresponding numbered repo files.
