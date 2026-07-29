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

**Reverificado 2026-07-30**, no solo "la tabla existe": las 2 políticas
que define el propio archivo 039 (`students can insert own sessions`,
`teachers can read sessions of their group students`) existen en
producción, comprobadas por nombre exacto vía `pg_policies`. Confirma que
el contenido de 039 se aplicó tal cual — sigue sin haber ninguna fila en
`schema_migrations`, bajo ningún nombre, que lo explique. Es un caso
distinto del resto de esta tabla: no es "aplicada con otro nombre", es
"aplicada sin ningún registro".

## Migration 054 (tutor_sessions outcome/exercise) — APLICADA SOLO PARCIALMENTE

**Descubierto 2026-07-30**, verificando la reconciliación completa de
migraciones pedida tras el desajuste encontrado en 089/090. El propio
archivo `054_tutor_sessions_outcome_exercise.sql` dice en su cabecera
"were applied out-of-band in production" — pero esa afirmación no estaba
verificada objeto por objeto. Comprobado ahora:

- Columnas `outcome` y `exercise_index` en `tutor_sessions`: **sí
  existen** en producción.
- Política `students_read_own_sessions` (SELECT, alumno ve sus propias
  sesiones): **NO existe** en producción — confirmado dos veces contra
  `jzheomyuwztdhttejskz` vía `pg_policies`.

Es decir: la parte de esquema (columnas) se aplicó, la parte de RLS
(política) no. El propio comentario del archivo la describe como
"belt-and-suspenders" (el backend usa `service_role` y bypasa RLS, así
que hoy esto no cambia el comportamiento de la app) — mismo perfil de
riesgo que las 14 tablas sin políticas ya trabajadas en la tarea RLS de
esta sesión (`tests/rls/`, `docs/deuda-tecnica.md`). No corregido —
queda como candidato natural para cuando se retome esa tarea (Tanda
2/3), no aplicado sueltamente aquí.

Además, `tests/migrations/liveCheck.mjs` (ver sección de más abajo) sacó
a la luz una fila más de `schema_migrations` relacionada:
`20260610092119 add_session_outcome_and_escalation_reason`. Confirmado
que `tutor_sessions.escalation_reason` también existe en producción —
una tercera columna de este mismo grupo de cambios ("outcome/exercise/
escalation"), sin ningún archivo del repo que la documente en absoluto
(ni siquiera 054, que solo cubre `outcome`/`exercise_index`). Registrada
en `supabase/migrations/known-drift.json`, no en un archivo `.sql` nuevo
— escribir ese archivo retroactivamente es trabajo aparte, no hecho aquí.

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

## Rango 050-101 — reconciliado 2026-07-30

Esta tabla no se había extendido más allá de la 049 desde que se escribió
— eso es exactamente lo que dejó pasar sin detectar el desajuste real de
089/090 que motivó esta reconciliación. Verificado con
`supabase_migrations.schema_migrations` completo (`version`, `name`,
`statements is not null`) cruzado contra los 101 archivos del repo:

| Repo file | DB version | DB name |
|---|---|---|
| 050_tenants_add_pending_status.sql | 20260603072746 | 050_tenants_add_pending_status |
| 051_term_dates.sql | 20260609141526 | term_dates |
| 052_tenants_daily_message_limit.sql | 20260609185424 | tenants_daily_message_limit |
| 053_student_trimester_reports.sql | 20260610083646 | add_student_trimester_reports |
| 054_tutor_sessions_outcome_exercise.sql | — | **parcial, ver sección propia arriba** |
| 055_academia_module_schema.sql | 20260619180927 | academia_module_schema |
| 056_academia_sesiones_asignaturas.sql | 20260623122433 | academia_sesiones_asignaturas_jsonb |
| 057_academia_config_dias_laborables.sql | 20260623122436 | academia_config_dias_laborables |
| 058_academia_notas_examen.sql | 20260624154856 | 058_academia_notas_examen |
| 059_academia_recibos.sql | 20260625141245 y 20260625142730 | 059_academia_recibos_envio y academia_recibos_v2 (2 entradas, misma tarde) |
| 060_add_academia_descuentos_recurrentes.sql | 20260626141309 | add_academia_descuentos_recurrentes |
| 061_academia_alumno_contacto_y_descuento_recurrente.sql | 20260626171027 | academia_alumno_contacto_y_descuento_recurrente |
| 062_academia_recibos_lineas_descuento_concepto.sql | 20260626183534 | academia_recibos_lineas_descuento_concepto |
| 063_academia_recibos_lineas_desglose_descuentos.sql | 20260626190541 | academia_recibos_lineas_desglose_descuentos |
| 064_academia_config_assets.sql | 20260626201504 | academia_config_assets |
| 065_academia_textos_legales.sql | 20260626210859 | academia_textos_legales |
| 066_academia_textos_legales_tipo_activo.sql | 20260626215636 | academia_textos_legales_tipo_activo |
| 067_add_recibo_estado_pagado.sql | 20260627104538 | add_recibo_estado_pagado |
| 068_academia_assets_pdf_8mb.sql | 20260628205713 | academia_assets_pdf_8mb |
| 069_academia_config_fiscal.sql | 20260629131615 | academia_config_fiscal |
| 070_academia_fiscal_trimestres.sql | 20260629144459 | academia_fiscal_trimestres |
| 071_academia_fiscal_trimestres_extend.sql | 20260701091448 | 071_academia_fiscal_trimestres_extend |
| 072_academia_sesiones_email_familia.sql | 20260701195225 | 072_academia_sesiones_email_familia |
| 073_academia_gastos_categorias.sql | 20260701194918 | add_academia_gastos_categorias |
| 074_add_missing_indexes_pagos_facturas.sql | 20260701192537 | add_missing_indexes_pagos_facturas |
| 075_add_students_tenant_user_unique_constraint.sql | 20260706142358 | add_students_tenant_user_unique_constraint |
| 076_academia_alumnos_pendientes_confirmacion.sql | 20260706202611 | academia_alumnos_pendientes_confirmacion |
| 077_fix_academia_alumnos_confirmacion_last_sign_in.sql | 20260706211309 | fix_academia_alumnos_confirmacion_last_sign_in |
| 078_academia_alumnos_acceso_activado.sql | 20260706212805 | academia_alumnos_acceso_activado |
| 079_academia_alumnos_rpc_acceso_activado.sql | 20260706212840 | academia_alumnos_rpc_acceso_activado |
| 080_tasks_sesion_libre.sql | 20260709111053 | tasks_sesion_libre |
| 081_revoke_security_definer_execute.sql | 20260710094542 | revoke_security_definer_execute |
| 082_add_indexes_unindexed_fks.sql | 20260711203756 | add_indexes_unindexed_fks |
| 083_drop_duplicate_indexes.sql | 20260711203810 | drop_duplicate_indexes |
| 084_rls_wrap_auth_uid_initplan.sql | 20260711203829 | rls_wrap_auth_uid_initplan |
| 085_rls_wrap_auth_uid_initplan_resto.sql | 20260711204912 | rls_wrap_auth_uid_initplan_resto |
| 086_academia_documentos_bucket.sql | 20260713233156 | academia_documentos_bucket |
| 087_academia_inscripcion_config.sql | 20260715213842 | academia_inscripcion_config |
| 088_documentos_generados_bucket.sql | 20260716085111 | 088_documentos_generados_bucket |
| 089_backfill_academia_textos_legales_exencion_iva.sql | 20260720134727 | backfill_academia_textos_legales_exencion_iva |
| 090_drop_academia_config_texto_exencion_iva.sql | — | **sin aplicar, por diseño — ver docs/deuda-tecnica.md, commit 6071464** |
| 091_academia_config_email_texto_acompanamiento.sql | 20260722110337 | 091_academia_config_email_texto_acompanamiento |
| 092_academia_config_email_textos_tipo.sql | 20260722122028 | 092_academia_config_email_textos_tipo |
| 093_academia_fichajes.sql | 20260723194001 | 093_academia_fichajes |
| 094_academia_profesor_alumnos.sql | 20260723211901 | 094_academia_profesor_alumnos |
| 095_teacher_profiles_nif_fecha_alta.sql | 20260723214631 | 095_teacher_profiles_nif_fecha_alta |
| 096_academia_fichajes_notas.sql | 20260724210332 | 096_academia_fichajes_notas |
| 097_academia_sustituciones.sql | 20260725211824 | 097_academia_sustituciones |
| 098_academia_sustituciones_sin_solape.sql | 20260725220010 | 098_academia_sustituciones_sin_solape |
| 099_backfill_profiles_display_name_desde_teacher_profiles.sql | 20260726094737 | 099_backfill_profiles_display_name_desde_teacher_profiles |
| 100_ai_token_usage.sql | 20260727161142 | 100_ai_token_usage |
| 101_ai_token_usage_moneda.sql | 20260727163805 | 101_ai_token_usage_moneda |

**Conclusión del rango 050-101**: de 52 archivos, 50 están aplicados con
correspondencia clara (aunque en 6 casos bajo un nombre distinto al del
archivo — 041, 053, 056, 059 [x2], 073, 089), 1 está parcialmente
aplicada (054, ver arriba) y 1 sigue deliberadamente sin aplicar (090,
pendiente de que Jorge la ejecute). Ninguna migración del rango 050-101
está totalmente ausente sin más — la sensación de "faltan cosas" que
motivó esta reconciliación venía específicamente de 089/090, cuyos
nombres en `schema_migrations` no llevan el prefijo numérico que sí
llevan sus vecinas.

## Entradas en `schema_migrations` sin ningún archivo del repo (28)

Aplicadas en producción, pero no corresponden a ningún archivo numerado
del repo — ni por versión, ni por nombre, ni por nombre-sin-prefijo.
Clasificadas por lo que parecen ser, no verificado objeto por objeto cada
una (alcance de esta reconciliación: inventariar el desajuste, no
auditar cada entrada en profundidad):

**Cambios de esquema reales, nunca documentados en un archivo numerado**
(candidatos a que alguien escriba el `.sql` correspondiente algún día,
como se hizo retroactivamente con 039/054 — no hecho en esta sesión, es
trabajo aparte):

| Versión | Nombre |
|---|---|
| 20260513192439 | explicit_grants_all_tables |
| 20260518074844 | 037a_rls_helper_functions (ya documentada aparte, ver docs/deuda-tecnica.md) |
| 20260522073824 | 041_grades_add_task_id |
| 20260530082053 | add_last_seen_at_to_teacher_profiles |
| 20260608205851 | create_grade_weights |
| 20260613082846 | add_reminder_tracking_to_session_maps |
| 20260613083821 | add_tutor_session_progress_tracking_columns |
| 20260613091813 | remove_redundant_progress_columns_from_tutor_sessions |
| 20260616212248 | create_session_attachments |
| 20260627115350 | academia_recibos_estado_check_add_pagado |
| 20260629142031 | add_regimen_fiscal_to_tenants |
| 20260629185457 | update_tenant_type_enum |
| 20260629201326 | add_sector_to_tenants |
| 20260629203500 | update_sector_enum_add_concertado |
| 20260629204648 | add_desglose_iva_to_academia_config |
| 20260710094626 | revoke_security_definer_execute_from_public |

**Parches de datos/limpieza de fixtures de test, no cambios de esquema**
(no deberían necesitar nunca un archivo de migración — es deuda de
proceso, no de esquema, aplicarlos vía `apply_migration` los mete en
`schema_migrations` aunque no sean DDL):

| Versión | Nombre |
|---|---|
| 20260415084730 | redeem_student_invite_fn (reaplicación, ver 035) |
| 20260609092541 | add_test_student_ana_garcia |
| 20260612174941 | restore_jorge_2bach_a_teacher_group |
| 20260615132457 | clear_all_test_tutor_sessions |
| 20260615133110 | restore_subject_for_jorge_2bach_a |
| 20260615135812 | clear_test_tasks_keep_prueba_final |

## Comprobación automática (2026-07-30) — no se puede volver a acumular en silencio

`tests/migrations/known-drift.json` (junto a este archivo) es la versión
máquina-legible de todo lo de arriba — cada desajuste investigado tiene
su entrada con motivo. `npm run test:migrations` (requiere
`SUPABASE_DB_URL`, igual que `test:rls`) reconcila `supabase/migrations/*.sql`
contra `supabase_migrations.schema_migrations` en vivo y falla si aparece
algo NUEVO no explicado — ni una migración del repo sin aplicar y sin
excusa, ni una fila en la BD sin archivo y sin excusa. La lógica de
comparación (`tests/migrations/reconcileMigrations.mjs`) tiene su propio
test offline en el `npm test` por defecto, así que no depende de tener
`SUPABASE_DB_URL` para verificar que el propio mecanismo de comparación
funciona.

Verificado 2026-07-30: alimentado con los 101 archivos del repo y las
122 filas reales de `schema_migrations` (obtenidas vía MCP), da 0
desajustes sin explicar — exactamente el estado que debe tener hoy.
