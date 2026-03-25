# Deuda técnica

Registro de decisiones aplazadas, gaps conocidos y cosas a revisar antes de lanzar.

---

## RLS: estado real en producción

**Verificado:** 2026-03-25

### Funciones helper no aplicadas en producción

Las funciones `has_active_role`, `is_active_member`, `current_student_id` y
`current_student_group_id` están definidas en
`supabase/migrations/010_rls_policies_min.sql` pero **nunca se aplicaron en la
base de datos de producción**. Tampoco las migraciones 012 y 013 que las referencian.

**¿Hay algo roto?** No. Las políticas que existen en producción fueron escritas con
subqueries inline y no dependen de esas funciones. No hay ninguna política fallando.

### Modelo de seguridad actual

El backend usa **service role** (bypasa RLS). Las tablas `students`, `groups`,
`tasks`, `tickets`, etc. tienen RLS activado pero sin políticas definidas — Postgres
las bloquea por defecto para cualquier cliente externo. Esto es correcto para el
modelo actual donde todo pasa por el backend.

### Políticas RLS activas en producción (verificadas)

| Tabla | Política | Operación |
|---|---|---|
| `student_invites` | `student_invites_admin_all` | ALL |
| `subjects` | `subjects_admin_all` | ALL |
| `teacher_group_subjects` | `tgs_select_tenant_member` | SELECT |
| `teacher_group_subjects` | `tgs_insert_admin` | INSERT |
| `teacher_group_subjects` | `tgs_update_admin` | UPDATE |
| `teacher_group_subjects` | `tgs_delete_admin` | DELETE |
| `teacher_groups` | `teacher_groups_admin_all` | ALL |
| `teacher_profiles` | `teacher_profiles_admin_all` | ALL |
| `teacher_subjects` | `teacher_subjects_admin_all` | ALL |

### Qué hacer antes de usar Supabase client desde el frontend

Si en el futuro se añade acceso directo vía cliente JS de Supabase (sin pasar por
el backend), habrá que definir políticas para cada tabla afectada. Escribirlas con
subqueries inline — no usar las funciones helper de 010 hasta verificar que están
aplicadas en producción.

---

## Flujo /tenant/join desactivado

**Desactivado:** 2026-03-25 — devuelve `410 Gone`.

El endpoint `POST /api/v1/tenant/join` permitía que alumnos se unieran al centro
con un código de tenant (no de grupo). Creaba registros en `students` sin `group_id`
y con `approval_status = 'pending'`. No había ninguna UI que lo llamara.

Se desactivó porque el flujo real es `student-register.html` → `POST /student/register`,
que usa el código de grupo, verifica lista blanca y auto-aprueba al alumno.

Los 7 registros huérfanos (group_id NULL) creados por este flujo fueron eliminados
(migración 023).

El código del endpoint se conserva en `server/routes/v1/access.routes.js`
comentado debajo del `return 410` por si se necesita recuperar.
