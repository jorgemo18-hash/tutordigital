# TutorDigital — Arquitectura del Tutor Multiagente
**Especificación de diseño v1.2 — 13 julio 2026 (revisada con feedback docente de Jorge)**
**Estado: DISEÑO APROBADO, construcción no iniciada.**

---

## 0. Cómo usar este documento

Este documento es la fuente de verdad del diseño del tutor multiagente de TutorDigital. Está escrito para que una IA (Claude Opus, Claude Code, u otra conversación de Claude) pueda retomar el trabajo sin contexto previo.

- Las secciones marcadas **[DECIDIDO]** son decisiones cerradas tras análisis e investigación de competencia (jul 2026). No reabrirlas salvo que Jorge lo pida explícitamente.
- Las marcadas **[RECOMENDACIÓN]** son propuestas con criterio que Jorge puede vetar antes de implementarlas.
- Las marcadas **[ABIERTO]** requieren decisión de Jorge o datos que aún no existen.
- **PASO 0 (sección 11) es obligatorio antes de escribir código**: pedir a Claude Code el mapa del flujo actual y validar este diseño contra la realidad del código, no contra suposiciones.

Reglas de trabajo del proyecto que aplican a toda la construcción:
- Jorge no programa: decide aquí, Claude Code implementa. Prompts a Code completos, de una pieza, terminando con el bloque de criterios de calidad (ver sección 13).
- Verificar schema real (`information_schema.columns`) antes de cualquier query/migración. Migraciones solo vía Supabase MCP `apply_migration`.
- Claude Code fabrica detalles a veces (2 incidentes documentados): verificar afirmaciones de alto riesgo contra código/Advisor real.
- Ningún archivo de lógica >400 líneas (HTML declarativo puro exento).
- No hay fechas límite. Jorge decide qué se trabaja cada sesión.

---

## 1. Contexto del producto (2 minutos de lectura)

**TutorDigital** es un SaaS educativo español multi-tenant: gestión de centro (horarios, familias, cobros, informes) + tutor IA socrático para el alumno, en un solo login. Dos tipos de centro: `instituto` (profesor asigna deberes → alumno los hace con el tutor) y `academia` (el alumno trae los deberes del colegio y los trabaja con el tutor; el profesor de la academia supervisa). Cliente piloto: Academia Lyceo (Huesca).

**Filosofía innegociable del tutor:** NUNCA da la solución. Guía al alumno paso a paso con preguntas (método socrático). El alumno debe recorrer todos los pasos, sin saltarse ninguno. Photomath/Symbolab/Mathos —que dan la respuesta— son el enemigo pedagógico, no la referencia.

**Diferencial de mercado (verificado jul 2026):** Khanmigo valida el concepto socrático pero no tiene alineación LOMLOE ni el bucle cerrado profesor→alumno→informe→familia dentro de un centro español real. Ninguna app del mercado español detecta lagunas conceptuales alineadas al currículo oficial. Ese bucle cerrado + LOMLOE es lo que se está construyendo aquí.

**Qué existe ya (jul 2026):** motor de sesión v1 (`server/lib/orchestrator/` — 5 módulos: analysis, sessionLifecycle, exerciseSelection, chatHandler, sessionMap), detección de ejercicios en el enunciado subido, plan de pasos por ejercicio (UI: "PROGRESO 0/7"), diálogo socrático con escalación al profesor (`[ESCALAR_PROFESOR: motivo]`), sesión libre para academia (una tarea `sesion_libre` por alumno/día — cambiará a por-hoja, ver sección 9), flujo de alumno unificado instituto/academia vía `enterTask()`.

**Foco y alcance [DECIDIDO, revisión Jorge 12-jul]:** el escenario principal de diseño es el **INSTITUTO** (profesor asigna → alumno trabaja guiado → informe al profesor → personalización). La academia hereda el mismo sistema; su particularidad (la sesión libre) es un modo más, no el centro del diseño. Y el tutor es **MULTI-ASIGNATURA desde el diseño**: matemáticas, física y química, lengua, historia... Sin agentes por asignatura — la asignatura es una DIMENSIÓN de los datos (currículo y taxonomía por asignatura) y del contexto inyectado. Se construye y valida primero con matemáticas, pero ninguna pieza debe asumir matemáticas en su estructura.

**El problema que motiva esta reestructura:** el tutor "se pierde" — confunde ejercicios, no sabe en qué paso está, arrastra contexto. La causa raíz: el estado vive implícito en el historial del prompt, no en una estructura persistente.

---

## 2. Principios de diseño [DECIDIDO — no reabrir]

1. **El corazón es el ESTADO, no los agentes.** Un `session_state` estructurado y persistente en Supabase. Los agentes son funciones puras sobre ese estado. Las dos columnas de la UI no "se comunican entre sí": ambas leen/escriben el mismo estado. (Patrón validado en literatura: learner state centralizado + orquestador, arXiv 2512.18669.)

2. **Política de un solo escritor por campo.** Cada campo del estado tiene exactamente un agente/proceso que lo escribe. Evita pisadas y race conditions.

3. **Tipos de sesión = MODOS del mismo agente, no agentes separados.** `deberes | estudio_examen | trabajo | sesion_libre` es un dato del estado que configura la política pedagógica. N agentes por tipo de tarea = N prompts que divergen (antipatrón ya sufrido: 44 copias de escHtml, 4 recetas de velo).

4. **El currículo LOMLOE es una TABLA, no un agente.** Contenido regulatorio estable → tabla curada en Supabase, inyectada como contexto a quien la necesite. Datos, no inteligencia: barato, determinista, auditable, sin alucinaciones sobre qué entra en 2º ESO.

5. **Un solo flujo de alumno.** Academia e instituto difieren solo en la ENTRADA (directo vs agenda) y en el TIPO de sesión. Nunca duplicar caminos de código por tipo de centro (3 bugs consecutivos en jul 2026 por un camino paralelo; se mató con `enterTask()` como camino común).

6. **Cada pieza se construye usable por sí sola**, en el orden de la sección 11. No big bang.

7. **Los pasos son hitos conceptuales mínimos, no un corsé procedimental.** [Lección de uso real de la v1] El plan del Guide marca QUÉ debe quedar cubierto para resolver bien — no impone un ritmo de un-paso-por-turno. Si el alumno cubre tres pasos correctamente en una sola respuesta (agrupa términos y despeja de una línea, bien hecho), se le validan los tres de una vez. Si trae el ejercicio ya resuelto (foto del cuaderno, porque lo entregaba en clase), se evalúa su resolución contra los hitos mínimos y se trabaja solo sobre huecos y errores. Defectos concretos de la v1 que esto corrige: pasos triviales de relleno ("entiende el ejercicio") y un tutor incapaz de validar avances agrupados.

---

## 3. El `session_state` — esquema propuesto

Tabla nueva `tutor_session_state` (nombre definitivo tras PASO 0 — puede que convenga extender `tutor_sessions` en vez de crear tabla; decidir con el mapa real delante):

```sql
tutor_session_state (
  session_id      uuid PK REFERENCES tutor_sessions(id) ON DELETE CASCADE,
  tenant_id       uuid NOT NULL,
  student_id      uuid NOT NULL,
  task_id         uuid NOT NULL,          -- toda sesión cuelga de una tarea (invariante del sistema)
  tipo_sesion     text NOT NULL CHECK (tipo_sesion IN ('deberes','estudio_examen','trabajo','sesion_libre')),
  hoja_attachment_id uuid,                -- enunciado activo (attachment)
  ejercicios      jsonb NOT NULL DEFAULT '[]',  -- [{n, titulo, resumen, estado: pendiente|en_curso|completado|saltado}]
  ejercicio_actual int,                   -- índice en ejercicios[], null = picker pendiente
  plan_pasos      jsonb NOT NULL DEFAULT '[]',  -- pasos del ejercicio actual: [{n, titulo, descripcion, estado}]
  paso_actual     int NOT NULL DEFAULT 0,
  intentos_paso   int NOT NULL DEFAULT 0, -- intentos del alumno en el paso actual (dispara ayuda progresiva/escalación)
  errores         jsonb NOT NULL DEFAULT '[]',  -- [{ts, ejercicio, paso, codigo_taxonomia, evidencia}]
  cerrada_en      timestamptz,            -- null = viva; se fija al pulsar "He terminado" o timeout
  updated_at      timestamptz NOT NULL DEFAULT now(),
  version         int NOT NULL DEFAULT 1  -- optimistic locking
)
```

**Quién escribe qué (single-writer):**

| Campo | Escritor único | Cuándo |
|---|---|---|
| `ejercicios`, `plan_pasos` | **Guide** (vía servidor) | Al analizar la hoja / al cambiar de ejercicio |
| `ejercicio_actual` | Servidor (acción del alumno en el picker o botón CAMBIAR) | Selección de ejercicio |
| `paso_actual`, `intentos_paso` | Servidor, parseando las etiquetas del **Socratic** | Cada turno de chat |
| `errores` | Servidor, parseando etiquetas del **Socratic** | Cada turno con error detectado |
| `cerrada_en` | Servidor ("He terminado" / timeout) | Cierre |
| Informes, perfil | **Analyst** — escribe en SUS tablas, nunca en session_state | Post-cierre |

**Inyección:** en cada turno, el servidor construye el contexto del Socratic con: perfil del alumno + estado actual serializado (ejercicio, paso actual y su descripción, errores previos de la sesión) + últimos N mensajes. El Socratic nunca tiene que "recordar" en qué paso está: se lo dicen. Esto elimina el bug de "se pierde" por diseño.

**Reanudación:** reabrir una sesión viva = recargar estado + últimos mensajes. La columna izquierda pinta ejercicios/pasos desde el estado, no desde el historial del chat. (La resiliencia ya construida en jul 2026 —sesión muerta con adjunto se relanza, botón Reintentar— se conserva.)

---

## 4. Los cuatro agentes — contratos

Modelos: usar la constante central de modelo del proyecto (`server/lib/anthropic.js`), nunca hardcodear versiones. "Tier Opus" = modelo potente para razonamiento profundo puntual; "tier Sonnet" = modelo rápido para volumen.

### 4.1 Guide — el planificador (tier Opus, corre 1 vez por hoja + 1 vez por ejercicio)
- **Dispara:** subida/cambio de enunciado; selección de ejercicio en el picker.
- **Input:** enunciado (imagen/PDF ya procesado), tipo de sesión, curso del alumno, extracto relevante de la tabla curricular LOMLOE (por curso), notas del profesor si la tarea las tiene, filtro de ejercicios del profesor si existe.
- **Output (JSON estricto, el servidor valida):** fase A — lista de ejercicios detectados `[{n, titulo, resumen}]`; fase B (al elegir ejercicio) — plan de pasos `[{n, titulo, descripcion_teorica}]`. La `descripcion_teorica` es el "recuerda que X pasa al otro lado con signo cambiado" que la columna izquierda muestra: teoría del paso, NUNCA la solución aplicada. **Regla de calidad de los pasos:** cada paso es un HITO verificable de la resolución (algo que debe quedar hecho o demostrado), nunca narración de relleno tipo "lee el enunciado" — salvo que la comprensión sea en sí el objetivo (problemas de traducción algebraica, comentario de texto). Los mínimos pasos que cubran la resolución: menos pasos buenos > más pasos triviales.
- **Escribe:** `ejercicios`, `plan_pasos` (vía servidor).
- **Justificación de coste:** corre pocas veces por sesión → puede ser el modelo caro sin arruinar el margen.

### 4.2 Socratic — el tutor conversacional (tier Sonnet, corre cada turno)
- **Dispara:** cada mensaje del alumno.
- **Input inyectado:** system prompt del modo (sección 6) + perfil del alumno (sección 7) + estado serializado + últimos N mensajes + adjuntos del turno (foto del cuaderno, etc.).
- **Output:** texto para el alumno + **etiquetas ocultas** (ver 4.5) que el servidor parsea y ELIMINA antes de mostrar.
- **Reglas duras (en system prompt):** nunca da la solución ni el resultado de una operación que el alumno debe hacer; guía SOLO hacia el paso actual (si el alumno pregunta por algo de un paso futuro, lo aparca amablemente); ayuda progresiva en el paso según `intentos_paso` (pregunta → pista → ejemplo análogo con otros números → escalación); detecta y etiqueta errores contra la taxonomía sin decírselo al alumno con jerga.
- **Validación flexible de avance:** si una respuesta del alumno cubre correctamente VARIOS pasos, se validan todos de una vez (`⟦PASOS_COMPLETADOS: a-b⟧`) y se le reconoce ("has hecho de una los pasos 2 a 4"). Jamás se le obliga a trocear lo que ya demostró junto. El plan es mapa, no peaje.
- **Revisión de trabajo hecho:** si el alumno sube la foto de su resolución completa (deberes ya hechos en el cuaderno para entregar), el Socratic la contrasta con el plan de pasos: confirma los hitos cubiertos, señala el que falte o esté mal (con su etiqueta de error para el Analyst), y trabaja SOLO sobre los huecos. Es el flujo natural del instituto, donde los deberes se entregan en cuaderno.
- **Escalación:** mantiene el mecanismo existente `[ESCALAR_PROFesor: motivo]`, ampliado con el extracto de conversación donde el alumno se bloqueó.

### 4.3 Analyst — el analista post-sesión (tier Sonnet, corre 1 vez al cerrar sesión)
- **Dispara:** `cerrada_en` fijado (He terminado / timeout de inactividad — proponer 45 min).
- **Input:** transcripción completa + `errores` acumulados + plan de pasos + perfil actual del alumno + taxonomía.
- **Output (JSON estricto):** (a) errores consolidados y clasificados contra taxonomía (puede reclasificar/agrupar los etiquetados en vivo); (b) informe breve para el profesor (qué trabajó, dónde falló, qué dominó, recomendación de 1-2 líneas); (c) perfil del alumno REESCRITO completo (rolling rewrite, sección 7); (d) sugerencia de refuerzo si procede (dispara Generator).
- **Escribe:** tabla de informes de sesión, tabla/campo de perfil, cola de refuerzos. NUNCA session_state.
- **En academia:** el informe va al profesor DE LA ACADEMIA, automático pero ligero (visible en su Diario). Es el diferencial de producto — no es opcional. [DECIDIDO]

### 4.4 Generator — el generador de EJERCICIOS (tier Sonnet; validación aparte)
> Este ES el "generador de ejercicios" del producto: hoy sirve refuerzos del tutor; mañana, el mismo agente genera los ejercicios de las programaciones de aula (sección 11, fase 2+). Un solo generador, dos consumidores.
- **Dispara:** recomendación del Analyst, o 3 ocurrencias del mismo código de error en una sesión, o petición manual del profesor.
- **Input:** código(s) de error objetivo, curso del alumno, extracto curricular LOMLOE del saber afectado, perfil.
- **Output:** 2-4 ejercicios de refuerzo con solución y pasos esperados (la solución se guarda para el profesor/verificación, JAMÁS se muestra al alumno).
- **Verificación:** los ejercicios generados se verifican antes de ofrecerse (mínimo: una segunda pasada de verificación con el problema resuelto de forma independiente; ideal futuro: verificación simbólica determinista — anotado en deuda, no bloqueante para v1).
- **Entrega:** [RECOMENDACIÓN] el refuerzo se OFRECE al alumno al final de la sesión ("¿Quieres practicar 2 ejercicios de esto que te ha costado?") y queda disponible para que el profesor lo asigne como tarea — no se impone automáticamente.

### 4.5 Etiquetas ocultas — protocolo Socratic→servidor
Formato en la salida del Socratic (el servidor las parsea con regex, actualiza estado y las borra del texto mostrado):
```
⟦PASO_COMPLETADO⟧                      → paso_actual++, intentos_paso=0
⟦PASOS_COMPLETADOS: 2-4⟧               → valida el rango de una vez (avance agrupado o foto de resolución), paso_actual=5
⟦INTENTO_FALLIDO⟧                      → intentos_paso++
⟦ERROR: FRAC.3 | evidencia: "sumó denominadores en 1/2+1/3=2/5"⟧  → append a errores[]
⟦EJERCICIO_COMPLETADO⟧                 → ejercicios[actual].estado=completado
⟦ESCALAR_PROFESOR: motivo⟧             → mecanismo existente (mantener compatibilidad)
```
Usar delimitadores improbables (⟦⟧) y validar en servidor. Si el modelo emite una etiqueta malformada: log a Sentry + ignorar (nunca romper el turno del alumno).

---

## 5. Datos estáticos: currículo y taxonomía

### 5.1 Tabla curricular LOMLOE — `curriculo_lomloe`
Contenido curado por Jorge (docente) desde los decretos oficiales — Aragón como referencia inicial (Lyceo está en Huesca), campo `normativa` para acomodar variantes autonómicas después. NO se scrapea ni se genera con IA: es la fuente de verdad pedagógica y la cura un humano.

```sql
curriculo_lomloe (
  id            uuid PK,
  asignatura    text NOT NULL,            -- 'matematicas' primero; el diseño admite más
  curso         text NOT NULL,            -- '1ESO'..'4ESO' (+ '1BACH','2BACH' futuro)
  bloque        text NOT NULL,            -- p.ej. 'Sentido numérico', 'Sentido algebraico'...
  saber_codigo  text NOT NULL UNIQUE,     -- p.ej. 'MAT.2ESO.ALG.03'
  saber         text NOT NULL,            -- descripción del saber básico
  criterios     text[],                   -- criterios de evaluación asociados
  prerequisitos text[],                   -- saber_codigo[] de los que depende
  normativa     text NOT NULL DEFAULT 'aragon-2022',
  orden         int                       -- secuenciación dentro del curso
)
```
**Consumidores:** Guide (contextualizar pasos al curso), Generator (no proponer nada fuera de curso), Analyst (mapear errores→saberes), y el futuro generador de programaciones didácticas (fase 2 — reutiliza esta tabla tal cual, por eso se construye primero).

**Proceso de curación:** Claude propone el volcado inicial por curso desde los decretos → Jorge valida/corrige secuenciación y redacción → se carga por migración. Empezar SOLO con matemáticas 1º-4º ESO.

### 5.2 Taxonomía de errores de matemáticas ESO — `taxonomia_errores` [v1.2 — MODELO EMERGENTE]
La pieza fundacional de la personalización: el Analyst clasifica contra ella, el perfil se escribe en sus términos, el Generator dispara por sus códigos. **Cambio de diseño v1.2:** el nivel 1 (familias) sigue fijado a priori por un docente, pero el nivel 2 (subtipos) ya NO se diseña a priori — emerge de los errores reales que el Socratic va etiquetando en sesión, y solo se convierte en código oficial cuando un patrón se repite lo suficiente y un docente lo aprueba. Diseñar subtipos sin datos reales delante era el riesgo original (demasiado fino, demasiado grueso, categorías que en la práctica nunca se usan); el modelo emergente lo evita por construcción.

```sql
taxonomia_errores (
  codigo                    text PK,      -- 'MAT.FRAC.3' (prefijo de asignatura); NULL hasta aprobación
  asignatura                text NOT NULL,-- taxonomía POR asignatura; matemáticas primero
  categoria                 text NOT NULL,-- nivel 1, fijo, curado a priori
  subtipo                   text NOT NULL,-- nivel 2, nace de una descripción libre consolidada
  descripcion                text NOT NULL,-- qué es, con ejemplo típico
  saberes                    text[],      -- saber_codigo[] de curriculo_lomloe relacionados
  estado                     text NOT NULL DEFAULT 'propuesto' CHECK (estado IN ('propuesto','aprobado')),
  ocurrencias_al_proponer    int NOT NULL,-- cuántas veces se vio el patrón cuando el sistema lo propuso (auditoría)
  activo                     boolean DEFAULT true
)

-- Descripciones libres agrupadas por familia, pendientes o no de promoción a subtipo.
-- El Analyst agrupa aquí las descripciones equivalentes que el Socratic va etiquetando;
-- cuando ocurrencias alcanza el umbral (empezar N=5), el sistema propone promoverla
-- (inserta una fila 'propuesto' en taxonomia_errores) y la marca aquí como promovida.
taxonomia_errores_descripciones_libres (
  id                        uuid PK,
  asignatura                text NOT NULL,
  categoria                 text NOT NULL,          -- familia de nivel 1 (FK conceptual a la tabla de categorías)
  descripcion_normalizada   text NOT NULL,          -- descripción canónica del patrón, agrupada por el Analyst
  ocurrencias                int NOT NULL DEFAULT 1,
  ejemplos                   jsonb NOT NULL DEFAULT '[]', -- [{evidencia, session_id, ts}] citas textuales de origen
  promovido_a                text REFERENCES taxonomia_errores(codigo), -- null mientras no se promueve
  created_at, updated_at
)
```

**Nivel 1 — familias, fijo [RECOMENDACIÓN — Jorge valida/ajusta con criterio docente]:**

| Código | Categoría | Ejemplo de subtipo |
|---|---|---|
| ARIT-SIG | Aritmética con signos | resta de negativos, signo al multiplicar |
| ARIT-JER | Jerarquía de operaciones | suma antes que multiplica |
| FRAC | Fracciones | suma denominadores; no simplifica; equivalencia |
| POT | Potencias y raíces | suma exponentes al multiplicar bases distintas |
| ALG-TRANS | Transposición en ecuaciones | pasa sin cambiar signo; divide solo un término |
| ALG-MAN | Manipulación algebraica | distributiva incompleta; identidades notables |
| MOD-TRAD | Traducción enunciado→álgebra | incógnitas mal definidas; condición no traducida |
| PROP | Proporcionalidad y porcentajes | regla de tres invertida; % encadenados |
| GEO | Geometría | fórmula equivocada; unidades mezcladas |
| FUNC | Funciones | interpretación de gráfica; dominio |
| PROB | Probabilidad y estadística | casos favorables/posibles; media vs mediana |
| COMP | Comprensión del enunciado | no identifica qué se pide |
| EJEC | Error de ejecución | método correcto, cálculo mal hecho (despiste) |
| NOT | Notación y presentación | igualdades encadenadas falsas; unidades ausentes |

**Multi-asignatura:** el borrador de arriba es SOLO matemáticas (la primera en activarse). Para cada asignatura nueva se fijan solo sus familias de nivel 1 (~6-14) al activarla; los subtipos NUNCA se diseñan a priori. Cada asignatura tendrá su propia lista de familias con prefijo propio (lengua: LEN.SINT ortografía/sintaxis/comprensión...; historia: HIS.CRON cronología/causalidad/fuentes...; física-química: FYQ.UNI unidades/magnitudes...). Las familias se curan asignatura a asignatura cuando se activen, siempre por un docente; los subtipos, nunca — emergen igual que en matemáticas.

**Nivel 2 — subtipos, emergentes [DECIDIDO v1.2]:** el Socratic ya no clasifica contra un catálogo cerrado de subtipos. Etiqueta cada error con su familia (fija) más una descripción libre y una cita textual:

```
⟦ERROR: MAT.FRAC | desc: "suma los denominadores directamente" | evidencia: "1/2+1/3=2/5"⟧
```

El Analyst, al cierre de cada sesión, agrupa las descripciones libres equivalentes dentro de cada familia (`taxonomia_errores_descripciones_libres`, columna `descripcion_normalizada`). Cuando un patrón agrupado alcanza el umbral de ocurrencias (empezar en N=5), el sistema PROPONE promoverlo a subtipo con código oficial (p.ej. `MAT.FRAC.1`, fila `estado='propuesto'` en `taxonomia_errores`), y el docente lo aprueba, renombra o rechaza desde su panel. Solo los subtipos con `estado='aprobado'` son códigos oficiales que usan el perfil del alumno y el Generator; las descripciones libres no promovidas siguen contando para la recurrencia dentro de su familia (nunca se descartan, solo no tienen código propio todavía).

**Ejemplo del formato de subtipo promovido (semilla inicial opcional, validar con Jorge — no diseñada a priori para el resto de familias):**

| Código | Categoría | Subtipo | Descripción |
|---|---|---|---|
| MAT.ALG-TRANS.1 | ALG-TRANS | Signo no cambia al transponer | Pasa un término al otro lado de la igualdad sin cambiar su signo (ej: x+3=5 → x=5+3) |
| MAT.ALG-TRANS.2 | ALG-TRANS | Coeficiente aplicado a un solo término | Divide o multiplica solo un término de la ecuación, no toda la igualdad (ej: 2x+4=10 → x+4=5) |
| MAT.ALG-TRANS.3 | ALG-TRANS | Operación inversa equivocada | Usa la operación inversa incorrecta al despejar — resta en vez de dividir o viceversa (ej: 3x=12 → x=12-3) |
| MAT.ALG-TRANS.4 | ALG-TRANS | Orden de despeje en pasos combinados | Invierte el orden correcto al deshacer varias operaciones combinadas sobre la incógnita |
| MAT.ALG-TRANS.5 | ALG-TRANS | Pérdida de término al reagrupar | Olvida arrastrar un término al mover elementos entre ambos lados de la igualdad |

**Regla de granularidad:** un patrón se promueve a subtipo solo cuando distingue un refuerzo DISTINTO de los ya aprobados en su familia — si dos patrones se corregirían con el mismo tipo de ejercicio, el docente los rechaza como duplicados o los fusiona al aprobar. Distinguir siempre error conceptual (p.ej. FRAC.x) de despiste (EJEC) — tienen tratamiento pedagógico opuesto.

**Fuente de arranque pre-sesiones:** exámenes y cuadernos corregidos reales fotografiados por el docente, procesados por el mismo pipeline del Analyst — sirve además de embrión del futuro corrector de exámenes.

---

## 6. Tipos de sesión como modos [DECIDIDO]

Mismo Socratic, misma maquinaria; cambia la política pedagógica vía bloque de modo en el system prompt + configuración:

| | `deberes` | `sesion_libre` | `estudio_examen` | `trabajo` |
|---|---|---|---|---|
| Origen | tarea del profesor | hoja subida por el alumno | tarea/iniciativa | tarea del profesor |
| Pasos obligatorios | SÍ, plan del Guide | SÍ, plan del Guide | NO — hay comprobación de dominio | Parcial — hitos, no pasos |
| Guide | plan de pasos | plan de pasos | genera preguntas de sondeo por saberes | descompone en hitos/secciones |
| Conducta Socratic | guía paso a paso | guía paso a paso | pregunta, evalúa respuesta, detecta lagunas, repregunta | orienta estructura, fuentes, no redacta por él |
| Al cerrar (Analyst) | informe estándar | informe al profesor de academia | mapa de dominio por saber (semáforo) | informe de progreso |
| Nota clave | notas del profesor inyectadas | contexto muere con la hoja | NUNCA da la respuesta antes de que el alumno intente | anti-plagio: no genera texto del trabajo |

`sesion_libre` es hoy un mapeo provisional a modo deberes (`TYPE_TO_MODE` en el código, comentado). Con esta reestructura pasa a modo propio (mismo plan de pasos, distinto destinatario del informe).

---

## 7. Perfil del alumno — rolling rewrite [DECIDIDO el patrón]

Un texto acotado (~300-500 palabras máx.) por alumno y asignatura, REESCRITO COMPLETO por el Analyst al cierre de cada sesión (no append infinito, no vector DB). Vive en tabla propia (`student_learning_profile`) con historial de versiones (últimas ~10, para auditoría y para que el profesor vea evolución).

**Contiene:** fortalezas demostradas; errores recurrentes activos (códigos + racha: "ALG-TRANS visto en 4 de las últimas 5 sesiones"); errores superados (para reconocérselo); estilo observado (se rinde rápido / persevera / pide la solución); nivel estimado por bloque curricular. **NO contiene:** datos personales más allá de lo pedagógico, diagnósticos psicológicos, comparaciones con otros alumnos.

**Consumo:** se inyecta al Socratic al abrir sesión (por eso el tutor "conoce" al alumno) y al Generator al crear refuerzos. El profesor lo ve en la ficha del alumno.

**Nota GDPR:** el perfil es perfilado de menores con IA — está ya en el paquete legal pendiente con las consultoras (Privacidad Lógica primera opción). No bloquea el desarrollo con datos de prueba; SÍ bloquea el despliegue a alumnos reales externos sin el paquete legal cerrado.

---

## 8. El bucle del profesor (el diferencial de producto)

1. **Notas del profesor en la tarea** → se inyectan al Guide y al Socratic ("insistid en que dibujen la región factible"). Campo existente en tasks (`teacher_notes`) — verificar en PASO 0 si se inyecta ya o está pendiente.
2. **Escalación en vivo** (existente, se conserva): `⟦ESCALAR_PROFESOR⟧` → notificación con extracto.
3. **Informe post-sesión del Analyst** → Diario del profesor (academia) / panel del profesor (instituto). Breve: 5 líneas + errores etiquetados + enlace a transcripción.
4. **Foto del cuaderno al terminar** [pendiente de construir, ya diseñado]: botón al final de sesión → el alumno fotografía su cuaderno → se adjunta a la sesión → el profesor la ve junto al informe. (Fase 2 del corrector: el Analyst también la lee.)
5. **Refuerzos**: el profesor ve los generados y puede asignarlos como tarea real.
6. **Filtro de ejercicios por profesor** [pendiente]: el profesor marca qué ejercicios de la hoja debe hacer el alumno → el Guide filtra el picker.

---

## 9. Decisiones de producto

### Cerradas [DECIDIDO]
- **Sesión libre = UNA HOJA subida** (no un día). Nueva hoja → nueva sesión, contexto limpio. "Por día" queda solo como agrupación visual del historial. Implica cambiar `ensureSesionLibreTask` de get-or-create-por-día a crear-por-hoja.
- **Informe de sesión libre → profesor de la academia**, automático y ligero. No voluntario.
- **Un solo flujo de alumno** (entrada distinta, camino común `enterTask`).

### Cerradas hoy [RECOMENDACIÓN — vetables por Jorge antes de implementar]
- **Historial del alumno:** puede RELEER sus sesiones cerradas (solo lectura, sin reabrir el chat). Valor de repaso, coste bajo.
- **Transcripciones y profesor:** el profesor ve SIEMPRE el informe del Analyst; la transcripción completa queda accesible bajo demanda (botón "ver conversación"). Justificación: con menores, la supervisión adulta del canal es defendible y esperable por las familias; el valor de producto está en el informe, la transcripción es auditoría.
- **Familias:** NO ven transcripciones. Solo el informe mensual existente (que en fase 2 se nutrirá del Analyst).
- **Retención:** transcripciones 12 meses, informes y perfil mientras el alumno esté activo + 12 meses. → VALIDAR con las consultoras GDPR antes de clientes externos.
- **Timeout de sesión viva:** 45 min de inactividad → cierre automático + Analyst. (Evita sesiones zombis sin analizar.)

### Abiertas [ABIERTO]
- Nombre/copy de cara al alumno de los modos (¿"Estudiar para examen" como botón propio en la entrada de academia?).
- ¿El alumno puede saltarse un ejercicio del plan del profesor? (propuesta: sí con registro, el informe lo refleja).
- Presupuesto de coste por sesión objetivo (depende del tracking de tokens, prerequisito de pricing — pendiente).

---

## 10. UI — qué cambia y qué no

**No cambia:** el layout de dos columnas (ENUNCIADO+pasos | RESOLUCIÓN chat), el picker de ejercicios, el botón CAMBIAR, He terminado, Nota al profesor, la estética (tokens/bg-layers ya unificados).

**Cambia por debajo:** la columna izquierda deja de pintarse desde respuestas ad-hoc y pasa a renderizar `session_state` (ejercicios, pasos, paso_actual resaltado, ✔ en completados). El avance del paso en la izquierda ocurre cuando el servidor procesa `⟦PASO_COMPLETADO⟧` — el alumno VE avanzar su progreso en tiempo real, que es además refuerzo motivacional.

**Nuevo:** indicador de errores NO visible para el alumno (los códigos de taxonomía son internos; el alumno recibe pedagogía, no etiquetas). Botón de foto del cuaderno al cerrar. Oferta de refuerzo post-sesión.

**Nota técnica:** la cadena `student.js` (563L) / `chatRenderer.js` (649L) / `send.js` (524L) está DELIBERADAMENTE sin modularizar — se reestructura como parte de este trabajo, no antes. El flujo SSE de streaming NO tiene cobertura de tests (agujero conocido de la suite) — cualquier cambio ahí exige añadir el test primero o verificación manual exhaustiva.

---

## 11. Orden de construcción [DECIDIDO] — cada fase usable por sí sola

**PASO 0 — Mapa del flujo actual (OBLIGATORIO antes de nada).** Prompt para Claude Code:

```
Necesito el mapa completo del flujo actual del tutor, solo lectura, para diseñar la
reestructura multiagente sobre la realidad del código y no sobre suposiciones:

1. MODELO DE DATOS: qué tablas participan hoy en una sesión de tutor (tutor_sessions,
   tutor_session_maps, session_messages, session_attachments... schema real de cada una
   vía information_schema). ¿Qué es exactamente "una sesión" hoy? ¿Cuándo se crea, se
   reutiliza, se cierra?
2. ESTADO ACTUAL: dónde vive hoy el plan de pasos y el "PROGRESO 0/7" de la UI (¿tabla,
   JSON en memoria, prompt?). ¿Dónde vive qué ejercicio está activo? ¿Qué se pierde al
   recargar la página y qué sobrevive?
3. CICLO DE VIDA: qué ocurre exactamente al pulsar "He terminado" (endpoints, escrituras,
   qué ve el profesor después). ¿Y al abandonar sin pulsar nada?
4. PROMPTS: dónde viven los system prompts actuales del tutor (archivo/tabla), estructura
   del prompt de cada llamada (qué se inyecta hoy: ¿historial completo?), y el mecanismo
   de [ESCALAR_PROFESOR] de punta a punta.
5. ORQUESTACIÓN: papel actual de cada módulo de server/lib/orchestrator/ (analysis,
   sessionLifecycle, exerciseSelection, chatHandler, sessionMap) y de session/*.routes.
6. TEACHER_NOTES: ¿se inyecta ya teacher_notes de la tarea al tutor o está pendiente?
7. COSTE: qué se loguea hoy de tokens/uso por llamada (si algo).
Entrégalo como informe estructurado. No modifiques nada.
```

**Fase 1 — Tabla curricular LOMLOE** (sin riesgo, cimiento de todo): migración + carga matemáticas ESO curada por Jorge. HECHO cuando: la tabla existe, cargada y validada por Jorge, y una query por curso devuelve los saberes correctos.

**Fase 2 — session_state + puntero de pasos**: crear la estructura, migrar el motor actual a leer/escribir en ella, inyección de estado al Socratic, etiquetas ⟦PASO_*⟧, UI izquierda renderiza desde estado. ARREGLA EL BUG "SE PIERDE" antes de que exista ningún agente nuevo. HECHO cuando: una sesión sobrevive a recarga con paso exacto; el tutor nunca confunde ejercicio; suite +tests nuevos en verde.

**Fase 3 — Pipeline de etiquetado emergente de errores** [v1.2]: familias de nivel 1 curadas por Jorge + el Socratic emite ⟦ERROR: familia | desc | evidencia⟧ + el Analyst agrupa descripciones libres por familia + panel del docente para aprobar/renombrar/rechazar propuestas de subtipo al alcanzar el umbral de ocurrencias. El entregable de esta fase NO es una taxonomía completa de subtipos — es el pipeline (etiquetado libre → consolidación → propuesta → aprobación). HECHO cuando: sesiones de prueba etiquetan errores plausibles por familia, el Analyst agrupa descripciones equivalentes de forma razonable, y al menos una propuesta de subtipo real pasa por el panel y es aprobada por Jorge.

**Fase 4 — Analyst**: cierre de sesión → informe al profesor + errores consolidados. HECHO cuando: el profesor de academia ve informes reales en su Diario tras cada sesión.

**Fase 5 — Perfil del alumno**: rolling rewrite + inyección al Socratic. HECHO cuando: el tutor demuestra memoria entre sesiones ("la semana pasada te costaban los signos, veamos cómo va").

**Fase 6 — Generator**: refuerzos verificados + oferta post-sesión + asignación por profesor. HECHO cuando: un error recurrente produce refuerzo correcto validado por Jorge.

**Fase 7 — Modos restantes**: estudio_examen y trabajo (deberes y sesion_libre quedan cubiertos desde Fase 2). Después: sesión libre por-hoja, foto cuaderno, filtro de ejercicios del profesor.

**Fase 2+ del producto, sobre esta base** (reutilizan curriculo_lomloe, taxonomía y Generator):
- **Corrector de exámenes con IA.**
- **Generador de programaciones — DOS productos distintos:**
  1. **Programación didáctica** (la oficial): el documento anual alineado a LOMLOE que el profesor presenta a la administración — mínimos, criterios de evaluación, secuenciación por evaluaciones. Se genera desde `curriculo_lomloe`.
  2. **Programación de aula** (el día a día): el profesor dice "fracciones en 7 días" — días y apartados personalizables por él, o la IA propone los apartados — y el sistema genera la secuencia de sesiones con explicación teórica + ejercicios (vía Generator). Primero para el grupo en general; después **personalizada por alumno** usando el perfil y los errores detectados por el Analyst — que cada alumno reciba refuerzos según sus fallos reales de sesión es el diferencial del producto.

---

## 12. Riesgos y precauciones

- **Coste:** Socratic corre por turno. Vigilar longitud de contexto inyectado (perfil+estado+N mensajes, no historial infinito — proponer N=12 turnos + resumen). El tracking de tokens por tenant es prerequisito de pricing y conviene construirlo DURANTE estas fases (cada llamada ya pasa por el cliente central: anotar tokens ahí es barato).
- **JSON de agentes:** Guide/Analyst deben devolver JSON estricto; validar con zod en servidor; ante JSON inválido → reintento 1 vez → error controlado (nunca sesión rota).
- **SSE sin tests** (agujero conocido): la Fase 2 toca el corazón del chat — presupuestar el smoke test de streaming como parte de la fase, no como opcional.
- **Code fabrica:** verificación contra código/BD real en cada fase (2 incidentes previos documentados).
- **GDPR menores:** transcripciones + perfilado = núcleo del paquete legal pendiente. Desarrollo con datos de prueba OK; alumnos reales externos NO hasta paquete cerrado.
- **No romper lo que funciona:** el motor v1 funciona (sesión libre incluida). Cada fase migra por partes con la suite en verde; jamás un big bang que deje el tutor caído para Lyceo.

---

## 13. Glosario técnico mínimo (para conversaciones sin contexto)

- **Stack:** Node/Fastify (Render) · Vanilla JS PWA (Vercel) · Supabase PostgreSQL+Auth (proyecto `jzheomyuwztdhttejskz`) · Claude API (cliente central `server/lib/anthropic.js`) · Sentry · Resend · CI GitHub Actions (backend+UI, verde obligatorio).
- **Lyceo tenant_id:** `88da1d9d-6dd3-496f-92a3-42d1597a70ff` · Jorge teacher profile: `8e01d227-6855-493d-a4f2-30f41beb228b`.
- **Motor actual:** `server/lib/orchestrator/{analysis,sessionLifecycle,exerciseSelection,chatHandler,sessionMap}.js` + `server/routes/v1/session/*`.
- **Frontend alumno:** `assets/student/` (student.js + controllers/render — cadena reservada a esta reestructura).
- **Seguridad:** helper canónico `taskBelongsToStudent` para cualquier endpoint que reciba task_id. `tasks.student_id` existe (sesión libre). Tests de aislamiento en suite.
- **Suite:** `npm test` (176 backend) + `npm run test:ui` (31 Playwright, visual+smoke). Todo corre en CI en cada push.
- **Bloque de criterios de calidad** (añadir al final de TODO prompt a Code): crea las carpetas necesarias para organizar correctamente los archivos nuevos. Antes de modificar cualquier archivo existente, cuenta sus líneas actuales — si el archivo resultante tras los cambios superaría las 400 líneas, extráelo en módulos más pequeños primero y luego aplica los cambios. Ningún archivo debe terminar con más de 400 líneas (HTML declarativo puro exento). Cada archivo tiene una única responsabilidad. Las funciones extraídas reciben sus dependencias como parámetros explícitos en lugar de cerrar sobre variables del scope padre.

---

## 14. Apéndice — Borradores de system prompts (castellano, esqueleto)

> Son PUNTOS DE PARTIDA. Se refinan con sesiones reales. Los `{{...}}` los inyecta el servidor.

### 14.1 Guide (fase A: detección de ejercicios)
```
Eres el planificador pedagógico de TutorDigital. Recibes el enunciado de una hoja de
ejercicios de {{asignatura}} de un alumno de {{curso}}.
Contexto curricular oficial (LOMLOE) de ese curso: {{extracto_curriculo}}
{{#notas_profesor}}Instrucciones del profesor: {{notas_profesor}}{{/notas_profesor}}
Tarea: identifica los ejercicios de la hoja. Devuelve EXCLUSIVAMENTE JSON:
{"ejercicios":[{"n":1,"titulo":"...","resumen":"...","saberes":["MAT.2ESO.ALG.03"]}]}
No resuelvas nada. No inventes ejercicios que no estén en la hoja.
```

### 14.2 Guide (fase B: plan de pasos del ejercicio elegido)
```
Mismo contexto. El alumno va a trabajar el ejercicio {{n}}: {{resumen}}.
Genera el plan de pasos que un alumno de {{curso}} debe recorrer para resolverlo por
sí mismo. Cada paso es un HITO verificable (algo que debe quedar hecho o demostrado),
nunca narración de relleno tipo "lee el enunciado". titulo corto + descripcion_teorica
(la regla o idea que aplica, p.ej. "recuerda que al pasar un término al otro lado
cambia de signo") SIN aplicarla a los números concretos. Los MÍNIMOS pasos que cubran
la resolución (3-9). Devuelve solo JSON:
{"pasos":[{"n":1,"titulo":"...","descripcion_teorica":"..."}]}
```

### 14.3 Socratic (núcleo común, por turno)
```
Eres el tutor socrático de TutorDigital. REGLA ABSOLUTA: nunca das la solución, el
resultado de un cálculo que el alumno deba hacer, ni el paso resuelto. Guías con
preguntas, pistas y ejemplos análogos con OTROS números.

ALUMNO: {{nombre}}, {{curso}}. Perfil pedagógico: {{perfil}}
SESIÓN ({{tipo_sesion}} · {{asignatura}}): ejercicio {{ejercicio_actual}} — {{resumen_ejercicio}}
PLAN: {{plan_pasos_con_estados}}
PASO ACTUAL ({{paso_actual}}/{{total}}): {{titulo_paso}} — {{descripcion_teorica}}
Intentos del alumno en este paso: {{intentos_paso}}
Errores ya detectados esta sesión: {{errores_sesion}}

CONDUCTA
- Trabaja SOLO el paso actual. Si pregunta por pasos futuros: "eso llega en el paso X,
  primero rematemos este".
- Ayuda progresiva según intentos: 0-1 → pregunta guía; 2 → pista concreta; 3 → ejemplo
  análogo resuelto con otros números; 4+ → emite ⟦ESCALAR_PROFESOR: motivo⟧.
- Si detectas un error, NO digas la etiqueta al alumno: corrige con pedagogía y emite
  al final ⟦ERROR: CODIGO | evidencia: "cita textual"⟧ (códigos: {{taxonomia_resumen}}).
- Cuando el alumno complete correctamente el paso: celebra breve y emite ⟦PASO_COMPLETADO⟧.
- Si UNA respuesta cubre bien VARIOS pasos: valídalos todos (⟦PASOS_COMPLETADOS: a-b⟧) y
  reconóceselo ("has hecho de una los pasos 2 a 4, perfecto"). No le obligues a trocearlo.
- Si sube foto de su resolución completa: contrástala con el plan — confirma los hitos
  cubiertos, trabaja SOLO sobre los que falten o estén mal (etiqueta sus errores).
- Si su respuesta al paso es incorrecta: emite ⟦INTENTO_FALLIDO⟧.
- Al completar el último paso: emite ⟦EJERCICIO_COMPLETADO⟧ y propón el siguiente.
- Tono: cercano, paciente, frases cortas, cero condescendencia. Español de España.
{{bloque_de_modo}}
```

### 14.4 Bloques de modo (se concatenan al núcleo)
```
[deberes/sesion_libre] El objetivo es que COMPLETE los deberes entendiéndolos. Ritmo ágil.
[estudio_examen] No hay pasos: sondeas dominio. Pregunta → espera respuesta → evalúa →
  si falla, repregunta más fácil hasta encontrar la base del hueco. Etiqueta cada hueco.
  JAMÁS des la respuesta antes de 2 intentos reales del alumno.
[trabajo] Orientas estructura y método. PROHIBIDO redactar texto que el alumno pueda
  copiar: das guiones, preguntas y criterios, nunca prosa terminada.
```

### 14.5 Analyst (post-sesión)
```
Eres el analista pedagógico. Recibes la transcripción completa de una sesión, los
errores etiquetados en vivo, el plan de pasos y el perfil previo del alumno.
Taxonomía oficial: {{taxonomia}}
Devuelve EXCLUSIVAMENTE JSON:
{
 "errores_consolidados":[{"codigo":"...","ocurrencias":n,"evidencia":"..."}],
 "informe_profesor":"máx 6 líneas: qué trabajó, qué dominó, dónde falló, recomendación",
 "perfil_actualizado":"reescritura COMPLETA del perfil, máx 400 palabras, misma estructura",
 "refuerzo_recomendado":{"codigos":["..."],"justificacion":"..."} | null
}
Sé concreto y basado en evidencia de la transcripción. No inventes. No diagnostiques
psicológicamente: describe conducta observada de aprendizaje.
```

### 14.6 Generator
```
Genera {{n}} ejercicios de refuerzo para un alumno de {{curso}} que comete el error
{{codigo}}: {{descripcion_error}}. Contexto curricular: {{extracto_curriculo}}
Nivel: ligeramente por debajo del ejercicio donde falló, subiendo gradualmente.
Devuelve JSON: {"ejercicios":[{"enunciado":"...","solucion":"...","pasos_esperados":[...]}]}
La solución es para el profesor: no se muestra al alumno.
```

---

*Fin de la especificación v1.2 — siguiente acción: PASO 0 (mapa del flujo) con Claude Code.*
*Changelog v1.1: foco instituto + multi-asignatura como dimensión; principio 7 (pasos = hitos flexibles, validación agrupada ⟦PASOS_COMPLETADOS⟧); revisión de trabajo hecho (foto de resolución vs pasos mínimos); Generator explicitado como el generador de ejercicios del producto; programación didáctica vs programación de aula bien diferenciadas; taxonomía con dimensión de asignatura.*
*Changelog v1.2: taxonomía de errores pasa de diseño a priori a MODELO EMERGENTE (5.2) — nivel 1 (familias) fijo, nivel 2 (subtipos) nace de descripciones libres agrupadas por el Analyst y se promueve por umbral de ocurrencias (N=5) con aprobación del docente en panel; esquema de `taxonomia_errores` ampliado con `estado`/`ocurrencias_al_proponer` + tabla hermana `taxonomia_errores_descripciones_libres`; tabla de 5 subtipos de ALG-TRANS como ejemplo/semilla opcional del formato promovido; nueva fuente de arranque pre-sesiones (exámenes/cuadernos corregidos fotografiados, embrión del futuro corrector); Fase 3 del orden de construcción redefinida como el pipeline de etiquetado, no una taxonomía completa.*
