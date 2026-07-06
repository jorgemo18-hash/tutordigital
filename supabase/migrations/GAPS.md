# Migration gaps and out-of-band changes

## Migrations 010-036 (applied before Supabase CLI tracking)

Migrations 010 through 036 were registered manually in
`supabase_migrations.schema_migrations` on 2026-06-03 using:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES
  ('010', 'rls_policies_min'), ('011', 'enable_rls_v7'), ...
ON CONFLICT (version) DO NOTHING;
```

**Corrección (verificado 2026-07-06 contra producción, `jzheomyuwztdhttejskz`):**
esa fila en `schema_migrations` es solo un registro administrativo — todas
las filas 010-036 tienen `statements IS NULL` (el runner normal de Supabase
sí guarda las sentencias ejecutadas; un `INSERT` manual como el de arriba,
no). Que la fila exista **no** prueba que el SQL del archivo se ejecutara.
Se verificó objeto por objeto contra el schema real de producción:

- **010, 012, 013 — NO aplicadas.** De las ~25 políticas RLS que define
  `010_rls_policies_min.sql`, ninguna sobrevive en producción (la única
  coincidencia de nombre, `attachments_select_teacher_admin_or_uploader`,
  pertenece en realidad a `037_attachments_student_upload.sql`, que la
  redefine con `DROP POLICY IF EXISTS` + `CREATE POLICY` — no a la 010). De
  sus 4 funciones `SECURITY DEFINER`, solo `has_active_role` e
  `is_active_member` existen, traídas por la migración fuera de banda
  `037a_rls_helper_functions` (2026-05-18) — no por la 010 misma.
  `current_student_id`/`current_student_group_id` no existen. 012 (políticas
  de `teacher_requests` sobre esa base) y 013 (hardening de `search_path`
  sobre esas funciones) tampoco están aplicadas — ver
  `docs/deuda-tecnica.md` para el detalle, que ya reflejaba esto
  correctamente.
- **011 y 014-036 (salvo 012/013) — SÍ aplicadas.** Verificado
  individualmente: RLS habilitado en las tablas de 011; tablas/columnas/
  índices/funciones de 014, 015, 016, 017, 018, 019, 020, 021, 022, 025,
  026, 027, 028, 029, 030, 031, 032, 033, 034, 035, 036 existen tal cual;
  023 (borrado de `students` huérfanos) no dejó ninguno (`group_id IS NULL`
  → 0 filas); 024 tiene sus 4 políticas sobre `teacher_group_subjects`
  activas.

En resumen: el bookkeeping de "010-036 aplicadas en orden" es correcto
para 24 de los 27 archivos, pero **falso para 010, 012 y 013** — esas tres
son placebo en `schema_migrations`, no reflejan el schema real. Un rebuild
completo desde cero necesitaría aplicar 010/012/013 de verdad (o su
equivalente ya cubierto por 037a + políticas inline) antes de fiarse de
este registro para esas tres.

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
