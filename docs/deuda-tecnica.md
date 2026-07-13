# Deuda técnica

Registro de decisiones aplazadas, gaps conocidos y cosas a revisar antes de lanzar.

---

## RLS: estado real en producción

**Verificado:** 2026-03-25 · **Actualizado:** 2026-07-06

### Funciones helper — estado mixto en producción

De las 4 funciones definidas en `supabase/migrations/010_rls_policies_min.sql`:

- `has_active_role` e `is_active_member` **sí están aplicadas en producción**
  desde el 2026-05-18, vía la migración fuera de banda `037a_rls_helper_functions`
  (versión DB `20260518074844`, necesaria para poder aplicar la 037 — ver
  `supabase/migrations/GAPS.md`). Es seguro escribir políticas nuevas con estas
  dos funciones.
- `current_student_id` y `current_student_group_id` siguen sin aplicarse.

Las migraciones 012 y 013 (que referencian estas funciones) siguen sin
aplicarse como tales — 037a solo trajo las dos funciones que hacían falta
para 037, no esas migraciones completas.

**¿Hay algo roto?** No. Las políticas que existen en producción fueron escritas con
subqueries inline y no dependen de estas funciones. No hay ninguna política fallando.

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
el backend), habrá que definir políticas para cada tabla afectada. `has_active_role`
e `is_active_member` ya están aplicadas y se pueden usar; `current_student_id` y
`current_student_group_id` no existen todavía — para esas, seguir con subqueries
inline hasta confirmar que se aplican.

---

## mammoth desactualizado (vulnerabilidad conocida en underscore)

**Detectado:** 2026-07-10 (auditoría externa).

`mammoth` (usado para extraer texto de DOCX en `server/lib/chat.js` y
`server/lib/agents/guide.js`) arrastra una versión vulnerable de `underscore`
en su cadena de dependencias (DoS vía `template()`). Mitigación aplicada: un
límite de 10MB inmediatamente antes de cada llamada a
`mammoth.extractRawText()` (además de los límites que ya existían upstream —
body limit de ~250KB en la ruta de chat, `MAX_FILE_BYTES` de 12MB en
attachments.routes.js). La solución real pendiente es actualizar o sustituir
`mammoth`.

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

El código del endpoint (85 líneas) siguió viviendo en
`server/routes/v1/access.routes.js` tras el `return 410` — no comentado como
decía esta nota anteriormente, sino código real e inalcanzable (unreachable
tras el return). Se eliminó (2026-07-10, auditoría externa); el historial de
git lo conserva si hace falta recuperarlo.

---

## Fallos pendientes de investigar en `POST /academia/finanzas/gastos/extraer`

**Detectado:** 2026-07-13, al comparar este endpoint con el bug (ya corregido)
de `academia/inscripciones/extraer` — media_type llegando undefined a Claude.
Estos dos son distintos y **no se han investigado todavía**:

- **Sentry `TUTORDIGITAL-BACKEND-2`** — `Error: aborted`, 2 eventos, hace 12 días.
- **Sentry `TUTORDIGITAL-BACKEND-1`** — `FastifyError: Request body is too large`,
  2 eventos, hace 12 días. Candidato a estar relacionado con el `bodyLimit`
  global de Fastify (30MB) chocando con archivos grandes desde el flujo de
  captura móvil, pero sin confirmar.

Acción pendiente: triaje con el mismo nivel de detalle que se hizo para el bug
de inscripciones (reproducir, confirmar causa raíz contra el código real,
decidir fix) antes de tocar nada.
