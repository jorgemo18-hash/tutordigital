# Deuda técnica

Registro de decisiones aplazadas, gaps conocidos y cosas a revisar antes de lanzar.

---

## Convención: toda cifra de auditoría se registra con fecha + comando exacto

**Añadida:** 2026-07-29, tras descubrir que una auditoría externa fechada
23 de julio reportó "44 implementaciones locales de escHtml" cuando el
commit `76d1295` (`2026-07-06 00:26:39 +0200`, verificado con
`git log -1 --format=%ci 76d1295`) ya las había consolidado a 0 — sin
fecha ni comando registrado en la propia auditoría, reconciliar la cifra
con el estado real del árbol exigió rehacer todo el recuento a mano.

A partir de ahora, cualquier cifra que salga de una auditoría (nº de
archivos, ocurrencias, tablas, filas...) se registra en este documento
con tres datos:

- **fecha exacta** de cuando se contó,
- **comando o query exacto** que la produjo (grep, SQL...), reproducible
  tal cual, sin parafrasear,
- **commit/rama** sobre la que se ejecutó.

Sin esos tres datos, la cifra se marca como "sin verificar" y no se usa
para planificar trabajo sin recontarla primero contra el árbol/BD actual.

---

## XSS: innerHTML sin escapar en el panel instituto (tasks.js, tickets.js, students.js) — cifra sin verificar

**Origen:** auditoría externa del 23 de julio (sin fecha/comando
registrado — ver regla de arriba). **Repasado sin auditar:** 2026-07-29.

`assets/teacher/js/tasks.js`, `tickets.js` y `students.js` sí importan
`escapeHtml` (re-exportado del canónico `assets/shared/js/escHtml.js` vía
`./utils.js`, consolidado en `76d1295`), pero eso no garantiza que TODAS
las interpolaciones en `innerHTML` lo usen. Recuento preliminar y ruidoso
— NO es una auditoría real, solo cuenta líneas con `.innerHTML =` sin
rastrear el origen de cada variable interpolada:

```
$ for f in assets/teacher/js/tasks.js assets/teacher/js/tickets.js assets/teacher/js/students.js; do
    echo "$f: $(grep -c '\.innerHTML\s*=' "$f") asignaciones a innerHTML"
  done
assets/teacher/js/tasks.js: 5 asignaciones a innerHTML
assets/teacher/js/tickets.js: 3 asignaciones a innerHTML
assets/teacher/js/students.js: 8 asignaciones a innerHTML
```

Ninguna de esas 16 líneas tiene `escapeHtml(` en la misma línea — pero
incluye falsos positivos obvios (`.innerHTML = ""` para limpiar, o una
variable ya escapada más arriba en el mismo bloque). **No usar esta cifra
para priorizar trabajo** — hace falta una auditoría real, variable por
variable, antes de tocar estos archivos. La consolidación de escHtml
(commits `be598fb`/`26f1a75`/`85d8060`/`dbed899`, 2026-07-29) **no reduce
esta superficie** — no tocó ninguno de estos 3 archivos.

---

## Email a familias: texto configurable y textos legales sin escapar en el HTML (academia)

**Detectado:** 2026-07-29, rastreando si los campos de texto libre del
centro llegan a `email.js`/`ausenciaEmailTemplate.js` (los dos que se
consolidaron contra el escHtml canónico ese mismo día).

`server/lib/academiaEnvio/cuerpoEmail.js` (`buildCuerpoHtml`) interpola
en el HTML del email **sin ningún escapado**:

- `cuerpo` — construido en `enviarFamiliaEmail.js`/`enviarInformeIndividual.js`
  vía `sustituirVariables()` (`textoAcompanamiento.js`), que sustituye
  `{familia}` por `familia.nombre` (columna `academia_familias.nombre`,
  puede venir de import Excel) dentro de la plantilla libre
  `academia_config.email_texto_completo` / `email_texto_solo_recibo` /
  `email_texto_solo_informe` (editable por el admin en Ajustes › Marca y
  textos).
- `textosLopd` — filas de `academia_textos_legales.contenido`, también
  texto libre editable por el admin.

**Ninguno de los dos pasa por `email.js` ni `ausenciaEmailTemplate.js`**
— llegan directos a `buildCuerpoHtml`, que los mete en el HTML con
`${...}` sin escapar. El envío real usa `sendReciboEmail`
(`server/lib/email.js`) como `enviarEmailFn`, pero esa función es un
pass-through puro a Resend — no escapa nada, nunca lo hizo.

**Corregido, pendiente de verificación en pantalla** (commit `3461763`,
2026-07-30) — no estaba en el alcance de la consolidación de escHtml
original (esos dos archivos ya usaban el canónico correctamente), fue un
hallazgo nuevo de esta sesión, resuelto en un fix aparte tras el análisis
de severidad de abajo. Regla del proyecto: nada se cierra sin verse — los
tests cubren que escapa/convierte bien, no si el email queda bien
maquetado. Jorge tiene que ver un email real (recibo o informe a
familia) con el nuevo cuerpo antes de dar esto por cerrado del todo.

**Análisis de severidad (2026-07-30):**
- No hay ninguna vista previa en el panel admin renderizada con
  `innerHTML` que muestre `cuerpo`/`textosLopd` ya sustituidos — los
  editores de texto usan `<textarea>.value` (seguro) y la única preview
  real (`reciboPreview.js`) construye nodos con `.textContent`. La
  interpolación sin escapar solo ocurre server-side, al enviar el email
  de verdad — sigue siendo bug de maquetación de email, no XSS en
  navegador.
- Los 2 puntos de escritura de `academia_familias.nombre`
  (`academia.familias.routes.js`, `resolverFamiliaId()` en
  `academiaAlumnoHelpers.js`) requieren `roles: ["admin"]` sin excepción
  — no hay alta pública ni importación masiva para el módulo academia.
  El escenario real es un admin del propio centro con datos mal
  escritos, no un tercero no autenticado.
- `academia_textos_legales.contenido` (tipo `recibos`/`ambos`) SÍ
  alimenta también el PDF (`texto_exencion` en
  `academiaPdfPayload.js` → `generators/recibo.py` del microservicio,
  vía `doc.add_run()` de `python-docx`, que no decodifica entidades
  HTML). Confirma que el escapado debe vivir en la frontera de
  interpolación HTML de `cuerpoEmail.js`, nunca en la columna ni en su
  lectura — si se escapara en origen, el PDF mostraría `&amp;` literal.

**Fix aplicado, código verificado por tests** (commit `3461763`):
`sustituirVariables()` escapa el valor de `{familia}` en el momento de la
sustitución, nunca la plantilla ya montada (evita doble escapado); `\n` →
`<br>` corre después de escapar, sobre el texto ya sustituido completo.
`buildCuerpoHtml()` escapa `textosLopd` en su propia frontera de
interpolación — `cuerpo` no se vuelve a tocar ahí, ya llega escapado.
Tests que fallan (5/5) contra la implementación anterior, verificado
revirtiendo con `git stash`.

**Pendiente de verificación en pantalla (Jorge)**: los tests prueban que
el string resultante escapa/convierte bien — no prueban que el email se
vea bien maquetado (saltos de línea, footer LOPD, longitud del cuerpo
con un nombre de familia largo...). Enviar/previsualizar un email real
de recibo o informe y confirmar visualmente antes de cerrar este punto.

### `lopd_footer` en el payload del PDF — decisión: eliminado

**Decisión (2026-07-30):** el campo se elimina de `buildAcademiaPdfPayload()`
— commit que acompaña esta entrada. Razonamiento del producto: el deber
de información del art. 13 RGPD se cumple en la hoja de inscripción, y
el recibo/informe viajan como adjuntos de un email que ya lleva su propio
pie LOPD (`buildCuerpoHtml`, vía `textosLopd`) — el PDF en sí no necesita
repetirlo. **Esta es una decisión provisional razonada por el equipo
técnico, pendiente de confirmación por el asesor legal en la DPIA** (ver
`docs/ROADMAP.md` línea sobre GDPR/LOPDGDD) — si la DPIA concluye que el
PDF adjunto SÍ necesita su propio aviso (p. ej. si se reenvía o se
descarga fuera del hilo del email original), habrá que revertir esto y
además implementar la lectura en `generators/recibo.py`/`informe.py` del
microservicio, que hoy no la tiene.

**Detectado:** 2026-07-30. `buildAcademiaPdfPayload()` envía `lopd_footer`
(de `academia_textos_legales.contenido`, tipo `email`/`ambos`) al
microservicio de PDF para recibo E informe. `grep -rn "lopd" .` sobre
todo `tutordigital-pdf-service` (incluida su historia completa de git,
`git log -S"lopd"`) da **cero resultados** — ni `recibo.py` ni
`informe.py` lo han leído nunca, en ningún commit. `informe.py` ni
siquiera tiene mecanismo de pie de página/footer.

El propio comentario de `academiaPdfPayload.js`, escrito en el mismo
commit que añadió el campo (`3e3b8f7`), ya describe el fallback como "el
email simplemente no lleva footer LOPD" — habla del email, no del PDF.
No hay ningún comentario, TODO ni entrada de docs que diga explícitamente
"el PDF no necesita el footer LOPD por diseño". Lectura más consistente
con la evidencia: se montó la lectura/filtrado/payload en el lado Node
con intención real (no es un accidente — hay lógica dedicada), pero el
lado Python nunca se conectó. **Parece una función a medias, no una
decisión de diseño documentada** — pendiente de que el producto decida
si el recibo/informe debe llevar el aviso LOPD o si el campo se elimina
del payload por no hacer falta.

### Verificación de doble escapado en BD (datos anteriores a la validación zod)

**Verificado:** 2026-07-29 — sin hallazgos. Los campos de texto libre
podrían llevar entidades HTML ya literales si vinieran de datos
anteriores a la validación zod (import Excel masivo, altas manuales,
flujo de alta antiguo) — ningún grep de código lo detecta, hace falta
consultar la BD real:

```sql
select 'academia_alumnos.nombre' as tabla_columna, id, tenant_id, nombre as valor
from academia_alumnos where nombre ~ '&(amp|#39|quot);'
union all
select 'academia_familias.nombre', id, tenant_id, nombre
from academia_familias where nombre ~ '&(amp|#39|quot);'
union all
select 'tenants.name', id, null::uuid, name
from tenants where name ~ '&(amp|#39|quot);'
union all
select 'students.first_name', id, tenant_id, first_name
from students where first_name ~ '&(amp|#39|quot);'
union all
select 'students.last_name', id, tenant_id, last_name
from students where last_name ~ '&(amp|#39|quot);'
union all
select 'students.display_name', id, tenant_id, display_name
from students where display_name ~ '&(amp|#39|quot);'
union all
select 'academia_config.nombre_emisor', tenant_id, tenant_id, nombre_emisor
from academia_config where nombre_emisor ~ '&(amp|#39|quot);'
union all
select 'academia_config.email_texto_completo', tenant_id, tenant_id, email_texto_completo
from academia_config where email_texto_completo ~ '&(amp|#39|quot);'
union all
select 'academia_config.email_texto_solo_recibo', tenant_id, tenant_id, email_texto_solo_recibo
from academia_config where email_texto_solo_recibo ~ '&(amp|#39|quot);'
union all
select 'academia_config.email_texto_solo_informe', tenant_id, tenant_id, email_texto_solo_informe
from academia_config where email_texto_solo_informe ~ '&(amp|#39|quot);'
union all
select 'academia_config.concepto_recibo_plantilla', tenant_id, tenant_id, concepto_recibo_plantilla
from academia_config where concepto_recibo_plantilla ~ '&(amp|#39|quot);'
union all
select 'academia_config.texto_exencion_iva', tenant_id, tenant_id, texto_exencion_iva
from academia_config where texto_exencion_iva ~ '&(amp|#39|quot);'
union all
select 'academia_textos_legales.contenido', id, tenant_id, contenido
from academia_textos_legales where contenido ~ '&(amp|#39|quot);'
union all
select 'academia_textos_legales.etiqueta', id, tenant_id, etiqueta
from academia_textos_legales where etiqueta ~ '&(amp|#39|quot);'
order by 1;
```

Ejecutada contra el proyecto `jzheomyuwztdhttejskz` (producción): **0
filas** — ningún dato hoy en BD lleva `&amp;`/`&#39;`/`&quot;` literales
en estas columnas. No hay doble escapado hoy, pero conviene repetir esta
query tras cualquier import masivo nuevo (Excel, migración de otro
sistema) — es precisamente el tipo de vía que no pasa por la validación
zod del formulario normal.

---

## RLS: estado real en producción

**Verificado:** 2026-03-25 · **Actualizado:** 2026-07-06 · **Recontado:** 2026-07-29

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

### Las 14 tablas con RLS activado y cero políticas — recontadas 2026-07-29

```sql
select c.relname as tabla
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
order by c.relname;
```

Ejecutada contra `jzheomyuwztdhttejskz` (producción): `_group_merge_map,
grades, groups, invites, profiles, student_task_status,
student_trimester_reports, students, tasks, teacher_invites,
teacher_requests, tenant_memberships, tenants, tickets` — 14 tablas,
idéntica a la lista de la auditoría original. Esta cifra sí queda
verificada con fecha y comando (a diferencia de la de innerHTML del panel
instituto, arriba). Trabajo en curso: harness de test contra RLS real
(`tests/rls/`, Node + `pg`, transacciones `SET LOCAL ROLE authenticated` +
`ROLLBACK`) validado manualmente contra `academia_fichajes` (ALLOW y
DENY con fixtures autocontenidos) — pendiente de que se ejecute
`npm run test:rls` con credenciales reales antes de escribir ninguna
política nueva sobre estas 14 tablas.

### `tutor_sessions` — NO es una de las 14, pero tiene una política incompleta pendiente de decisión de producto

**No confundir con las 14 tablas de arriba** — `tutor_sessions` SÍ tiene
políticas (3, verificadas 2026-07-30 en producción: `students can insert
own sessions`, `teachers can read sessions of their group students`,
`teachers_update_session_reviewed`), así que no aparece en ese recuento.
Lo que falta es una política concreta: `students_read_own_sessions`
(SELECT, el propio alumno lee sus sesiones), definida en
`054_tutor_sessions_outcome_exercise.sql` pero nunca aplicada (ver
`supabase/migrations/GAPS.md`).

**No añadir esta política todavía.** Hoy el alumno puede escribir sus
propias sesiones (política de INSERT sí existe) pero no releerlas por su
cuenta — sin efecto visible porque el backend usa `service_role`. Si el
alumno debe poder releer su propio historial es una decisión de producto
pendiente para la sesión de diseño del tutor (`docs/tutor/ARQUITECTURA.md`,
Fase 2/3), no una omisión técnica a corregir sola. Cuando esa sesión de
diseño resuelva la pregunta, `tutor_sessions` entra en el plan de tandas
de esta tarea RLS (candidata natural para la Tanda 2, junto a `students`/
`tasks`/`grades` — no antes).

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

---

## Helpers `hoyISO()`/`todayISO()` privados sin override inyectable

**Detectado:** 2026-07-27, auditoría de fechas frágiles en tests (a raíz del
fix de `sustitucionesSection.js`/`fetchEstadoActual` — ver `hoyISOFn`/`hoyISO`
como parámetro explícito en `resolverAlumnoIdsVisibles`, `revocarSustitucion`,
`sustitucionesSection.js` y `fetchEstadoActual` como el patrón correcto).

Los siguientes helpers privados leen `new Date()` real sin forma de
inyectar una fecha fija, **pero hoy no tienen ningún test que los ejercite**,
así que no hay ningún test frágil todavía — es deuda latente, no un bug activo:

- `assets/academia/admin/js/drawer/datosSection.js` — `function todayISO()`
- `assets/teacher/mobile/mobileTeacherAgenda.js` — `_todayStr()`, `_tomorrowStr()`,
  `_in7Days()`, y un `new Date()` suelto en la línea 84
- `server/routes/v1/academia.alumnos.routes.js` — `function hoyISO()`
- `server/routes/v1/academia.alumnos.archivar.routes.js` — `function hoyISO()`
- `server/routes/v1/academia-sustituciones/sustituciones.routes.js` — `function hoyISO()`

Si alguno de estos archivos se toca y se le añade un test con fecha de
fixture, aplicar el mismo patrón que ya usan `resolverAlumnoIdsVisibles`
(`hoyOverride`) y `fetchEstadoActual` (`hoy` como parámetro con default
`new Date()`) en vez de leer el reloj real dentro de la función.

También quedan dos huecos de propagación de bajo riesgo, ya documentados
inline donde ocurren: `fetchDiarioVisible` (`academia.sesiones.routes.js`) y
`fetchFranjasVisibles` (`academia.horario.routes.js`) no reenvían `hoyISO` a
`resolverAlumnoIdsVisibles` aunque esta última sí lo soporta; y `renderDiario`
(`assets/academia/profesor/js/diario.js`) no expone override para el
`hoyISO` interno de `clampToRange`.

---

## Versionado de assets estáticos: manual, ya desincronizado

**Detectado:** 2026-07-27, auditoría motivada por un patrón recurrente: al
menos dos incidentes en producción (commit `56a40ce`, "tarjetas negras",
2026-07-07; y commit `433bae4`, FAB de fichaje solapando drawers,
2026-07-26) donde un cambio de CSS parecía no llegar a producción, y en
ambos el fix aplicado incluyó subir un `?v=` — `fichar-fab.css` en
concreto se cargaba vía `@import` sin query de versión dentro de
`_academia-admin.css`/`_academia-profesor.css`, mientras los `<link>` del
HTML sí la llevaban. Ver la corrección de diagnóstico más abajo — esta
explicación causal, tal y como se documentó en su momento, no se sostiene
con lo medido después.

**Cobertura real medida** (no estimada — grep sobre el árbol completo):

| Capa | Referencias totales | Con `?v=` | Cobertura |
|---|---|---|---|
| `@import` interno en CSS | 57 | 2 (ambos a `fichar-fab.css`) | 3.5% |
| `<link>`/`<script src>` en HTML | ~48 | 35 | ~73% |
| `import ... from` en JS (módulos ES) | 906 | 0 | 0% |

Los 906 `import` de JS tienen el mismo problema estructural que el CSS (un
módulo importado puede quedar cacheado aunque el que lo importa cambie de
versión) — no ha explotado visualmente porque un JS desincronizado suele
degradar en vez de romper de forma obvia como el CSS, pero es el mismo
riesgo latente, sin ningún parche todavía.

**Donde sí hay `?v=`, ya está desincronizado en producción, no es solo un
riesgo futuro:**

- `00-tokens.css`: `?v=1.1.0` en `student-register.html`/`invite.html`/
  `academia/index.html`, pero `?v=1.2.1` en `academia/profesor/index.html`/
  `academia/admin/index.html` — mismo archivo, dos versiones distintas
  circulando a la vez.
- `runtime-config.js`: `?v=8.0.5` en la mayoría de páginas, `?v=9.0.0` en
  `assets/student/index.html`, y **sin versión ninguna** en
  `student-register.html`, `academia/admin/index.html`,
  `academia/profesor/index.html` y toda `academia/admin/captura/index.html`
  (los 5 assets de esa mini-app, ninguno versionado).
- La única pieza ya automatizada es `scripts/generate-runtime-config.mjs`
  (ejecutado por Vercel en `buildCommand`), que sí escribe `APP_VERSION`
  dentro de `runtime-config.js` a partir de `package.json`, pero eso no
  reescribe ningún `?v=` de ningún `<link>`/`<script>`/`@import` — son dos
  mecanismos sin relación entre sí.

### CORRECCIÓN (2026-07-27) — el diagnóstico de "caché sin versión" no está confirmado

Medido el 2026-07-27 contra `www.tutordigital.app`: `Cache-Control` ya era
`public, max-age=0, must-revalidate` para CSS/JS/HTML/imágenes/JSON —
confirmado también que `vercel.json` nunca tuvo cabeceras propias (revisado
el histórico completo del archivo, un único commit lo creó y solo con
`buildCommand`), así que ese default lleva así desde siempre, no es algo
que cambiara a raíz del incidente. ETag se genera por contenido y Vercel
responde 304 real ante `If-None-Match` correcto (verificado con `curl`).

Con `must-revalidate` ya activo, el navegador revalida en CADA carga: un
archivo con contenido nuevo debería devolver un ETag distinto y un 200 con
el contenido nuevo, aunque el `?v=` de la URL no cambiara. Es decir, si esa
cabecera ya estaba así en el momento del incidente de `fichar-fab.css`, el
mecanismo diagnosticado entonces ("el navegador sirve la copia cacheada
porque no cambió el `?v=`") no debería haber podido producir el síntoma
observado tal y como se explicó.

**La causa real de aquel incidente NO está establecida.** Hipótesis
abiertas, ninguna confirmada:

- **Caché de edge/CDN de Vercel con TTL propia**, independiente de lo que
  ve el navegador vía `Cache-Control` — el propio comentario original en
  `fichar-fab.css` ya apuntaba a esto ("probablemente por cómo cachea el
  CDN"), sin confirmarlo entonces ni ahora.
- **El deploy con el fix aún no había propagado** en el momento en que se
  probó y se vio el problema — un "no se ve el fix" que en realidad era
  "todavía no está desplegado", no un problema de caché en absoluto.
- **El problema nunca fue de caché.** El commit `433bae4` cambia DOS cosas
  a la vez en el mismo commit: añade `?v=` al `@import` de `fichar-fab.css`
  Y sustituye el enfoque entero del FAB (de jugar con `z-index` a
  desplazarlo geométricamente fuera de la columna del drawer, con
  `body:has(.ac-drawer-overlay.open)`). Al ir ambos cambios juntos, nunca
  se aisló cuál de los dos resolvió el problema visible — pudo ser solo el
  cambio de enfoque (que hace el solape imposible geométricamente,
  independiente de cualquier caché), no el `?v=`.

**Por qué importa:** si vuelve a pasar que un cambio de frontend "no
llega" a producción, no dar por hecho que la causa es el `?v=` — con
`must-revalidate` confirmado activo, esa explicación por sí sola ya no se
sostiene. Antes de asumir un problema de versionado, comprobar la cabecera
real servida en ese momento y si el deploy había terminado de propagar.

### Cabeceras explícitas (2026-07-27) — red de seguridad, no corrección del bug original

`vercel.json` ahora fija explícitamente `Cache-Control: public, max-age=0,
must-revalidate` para `.css`/`.js`/`.html`. Como coincide con el default ya
medido, esto **no cambia el comportamiento actual** — lo deja pinneado y
explícito en vez de depender de un default no documentado de la plataforma
que podría cambiar sin aviso. Dado que la causa del incidente de
`fichar-fab.css` sigue sin confirmarse (ver arriba), este cambio no debe
presentarse como "el fix" de aquel bug — es una garantía hacia delante
(cualquier `?v=` que se desincronice en el futuro deja de poder servir una
copia vieja más allá de la siguiente petición condicional), no una
explicación retroactiva de lo que pasó entonces.

Coste medido en `www.tutordigital.app` (peticiones condicionales en
paralelo, como hace un navegador por HTTP/2): ~1.2–2.1s para el panel admin
de academia (154 assets con ETag válido de 157), ~1.8–1.9s para el panel de
alumno (96 de 98) — no es coste nuevo, ya ocurría por el default de Vercel,
pero es real y recurrente en cada visita, no solo en la primera. Detalle
del volumen de peticiones en la sección siguiente.

**Pendiente como mejora de rendimiento** (no de corrección de bug — la
clase de bug de versión desincronizada ya queda cerrada con las cabeceras,
al margen de qué causó el incidente original): pasar a versionado real
(hash de contenido en el nombre de archivo, o un único valor global
derivado del commit reescrito en build) para que las visitas repetidas
puedan volver a cachear sin revalidar. Se descartó automatizarlo ya mismo
porque los 906 `import` de JS obligan a reescribir especificadores dentro
de cada archivo — un solo sitio que el script de reescritura no cubra
reproduce el bug original en silencio, así que es un cambio que merece
hacerse con calma, no bajo presión.

---

## Rendimiento de entrega de assets: ~150-160 peticiones por carga, sin empaquetado

**Detectado:** 2026-07-27, al medir el coste de las cabeceras de caché (ver
sección anterior). Independiente del versionado — esto pasaría igual con
versionado perfecto, porque es un problema de CUÁNTOS archivos separados
hay que pedir, no de si se cachean bien.

Grafo real de `@import`/`import` transitivos calculado desde el código
(no estimado) y medido contra `www.tutordigital.app`:

| Panel | Assets propios (CSS+JS) | Carga en frío (paralelo, sin caché) |
|---|---|---|
| Admin de academia | 157 | ~2.8–3.0s |
| Alumno | 98 | (no medido en frío por separado; condicional ~1.8–1.9s) |

Este es el coste de la PRIMERA visita (o de cualquier visita sin caché
utilizable, con o sin versionado) — nadie lo evita solo arreglando el
versionado. Con HTTP/2 (confirmado: Vercel sirve `HTTP/2`) las descargas se
multiplexan sobre una sola conexión, así que no es tan grave como sería en
HTTP/1.1, pero cada archivo sigue pagando su propio round-trip de
descubrimiento — el navegador tiene que parsear `academiaAdmin.js` para
enterarse de sus imports, y esos imports para enterarse de los suyos,
formando una cascada de varios niveles antes de que la última pieza
empiece a pedirse. En centros con conexiones de alta latencia (rural,
móvil, o equipos/redes modestas) esa cascada pesa más que el tamaño total
en bytes.

**Opciones para un stack sin bundler** (sin recomendar ninguna todavía):

- **Adoptar un bundler mínimo solo para el build step** (p.ej. esbuild):
  Vercel ya ejecuta un `buildCommand` con Node (`generate-runtime-config.mjs`),
  así que hay un gancho natural para añadir un paso que concatene/minifique
  cada panel a 1-2 archivos. Es la solución más estándar y probada, pero
  diluye la línea de "sin bundler" que define hoy el proyecto.
- **Concatenación manual a build-time sin bundler real**: un script propio
  que una los `@import` de CSS en un solo archivo (mecánico y seguro, CSS
  no tiene scope léxico que romper). Para JS es más arriesgado — los
  módulos ES tienen `import`/`export` con semántica de scope que una
  concatenación ingenua puede romper (colisiones de nombres, orden de
  evaluación) sin un mínimo de tooling real detrás.
- **`<link rel="modulepreload">`/`preload`**: no reduce el número de
  peticiones, pero aplana la cascada de descubrimiento — el navegador
  puede empezar a pedir los módulos anidados antes de terminar de parsear
  el padre. Cambio pequeño y reversible, no toca la arquitectura de
  archivos.
- **Consolidar archivos a mano** (fusionar varios `@import`/módulos
  pequeños en menos archivos más grandes, sin tooling nuevo): reduce el
  número de peticiones directamente, pero en tensión con la convención ya
  establecida en este proyecto de un archivo por responsabilidad — cambia
  el mantenimiento del código, no solo el rendimiento.
- **No tocar nada**: con HTTP/2 y las cabeceras ya puestas, el coste es
  "solo" de la primera visita o de una revalidación de ~1-2s en las
  siguientes — puede que no compense la complejidad añadida si el uso real
  desde conexiones modestas es bajo. Dato que falta para decidir: cuántos
  centros/usuarios reales están en esa situación.

---

## Tipo de cambio USD→EUR en aiPricing.js: se desfasa con el tiempo

**Detectado:** 2026-07-28, al revisar el diseño de coste real de IA
(`server/lib/aiPricing.js`, tabla `ai_token_usage`).

`USD_TO_EUR` es una constante fija (0.88, tomada de una cotización de
mercado consultada el 2026-07-27) — a diferencia del precio por modelo (que
solo cambia cuando Anthropic hace un anuncio, un evento discreto y raro,
fácil de detectar), el cambio de divisa fluctúa a diario, y no hay ninguna
alarma si este número se queda desfasado.

**Acción pendiente:** revisar `USD_TO_EUR` periódicamente (no hay cadencia
fijada todavía — a valorar: trimestral, o solo cuando el coste en € del
panel de superadmin empiece a "no cuadrar" con la factura real de
Anthropic). Cada revisión debe actualizar también el comentario "Última
revisión" en el propio archivo.

**Resuelto (2026-07-28):** la duda de si merecía la pena guardar el tipo de
cambio aplicado por fila. Migración `101_ai_token_usage_moneda.sql`
replantea qué se congela: `ai_token_usage.cost_usd` guarda el coste EXACTO
según la tarifa de Anthropic (nunca necesita revisión, es la cifra que debe
cuadrar con la factura real) y `fx_usd_eur` guarda el tipo de cambio
aplicado en el momento del INSERT. `cost_eur` se eliminó — ya no se guarda
ningún EUR directamente, se deriva siempre de `cost_usd * fx_usd_eur` **por
fila** al leer (ver `usdToEur` en `aiPricing.js` y `sumTokenUsage` en
`superadmin.stats.routes.js`). Con el fx histórico ya guardado por fila,
derivarlo al leer ya no reintroduce el problema original (recalcular con el
tipo de cambio de HOY) — es solo aritmética sobre dos números ya
congelados, no una lectura en caliente de `USD_TO_EUR`.

---

## Sin instrumentación de "funciones usadas" (adjuntos, voz, pizarra, calculadora)

**Detectado:** 2026-07-28, al auditar el panel "Estadísticas" de superadmin
(`assets/superadmin/views/estadisticas.js`) contra lo que el backend puede
ofrecer de verdad.

La sección "Funciones usadas" (% de alumnos que usaron adjunto imagen/PDF/
archivo, voz, pizarra, calculadora, o recuperaron el historial) tenía el
HTML montado en el frontend pero nunca se conectó a ningún dato — no
porque faltara una query, sino porque **ninguna tabla registra qué
funciones se usaron** en una sesión o mensaje. `session_messages` guarda
`role`/`content`, no qué adjuntos o herramientas se abrieron.

Se eliminó la sección por completo (no se dejó en un "Sin datos aún"
perpetuo, que sugiere que la información llegará sola sin serlo).

**Si algún día se quiere medir esto**, hace falta instrumentación nueva:
registrar en algún punto del flujo de chat (`server/lib/chat.js` o el
endpoint de composer) qué se adjuntó/abrió en cada mensaje o sesión — una
tabla o columna nueva, no una consulta distinta sobre datos que ya existen.

---

## Sin backups automáticos (plan Free)

**Detectado:** 2026-07-28. El proyecto está en plan Free de Supabase, que
no incluye backups ("Free Plan does not include project backups",
confirmado en el dashboard). La base contiene datos de alumnos menores,
familias, histórico económico de Lyceo y fichajes con valor legal
(RDL 8/2019) — hoy no existe ninguna copia de seguridad de nada de eso.

Volcado manual mediante `scripts/backup-db.sh` (`pg_dump -Fc`, ver
`scripts/README-backup-db.md` para el comando de restauración y
verificación) — es la única red de seguridad hasta que se resuelva de raíz.

Migración a Supabase Pro (backups automáticos + PITR) prevista para
septiembre 2026. Hasta entonces, el volcado manual debe ejecutarse con
regularidad — no es un sustituto real de un backup automático, solo mitiga
la ausencia total mientras tanto.
