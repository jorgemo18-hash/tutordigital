-- 118_contenido_didactico.sql
-- El modelo de datos de las hojas de ejercicios: qué se enseña, qué tipos de
-- pregunta hay, qué ejercicios se han generado y qué hoja se imprimió.
--
-- POR QUÉ ESTAS TABLAS Y NO UN CAMPO DE TEXTO CON LA HOJA GENERADA. Porque sin
-- ejercicio estable no hay medición: un intento es "este alumno, este
-- ejercicio, este día, bien o mal". Si el ejercicio solo existió en el instante
-- de imprimirlo, tres meses después no se sabe en qué falló y se cae lo único
-- que da valor al producto — adaptar lo que se le manda a cada alumno. La IA
-- GENERA, la base de datos CONSERVA; no son alternativas (ver
-- claude/hojas-de-ejercicios.md).
--
-- LAS DOS MITADES, y por qué tienen dueños distintos:
--
--   CATÁLOGO (temas → conceptos → errores típicos, y arquetipos y ejercicios)
--   `tenant_id` ANULABLE. Un arquetipo de progresiones no es de ningún centro:
--   "dada la sucesión, halla el término general" es lo mismo en Huesca que en
--   Teruel. Las filas con tenant_id NULL son el catálogo común, y las filas con
--   tenant_id son lo que un centro concreto se ha hecho para él. Nace anulable
--   desde el primer día porque convertir después una tabla "de un centro" en
--   una compartida obliga a decidir a posteriori de quién era cada fila, y esa
--   decisión no tiene respuesta.
--
--   DOCUMENTOS (hojas y sus huecos)
--   `tenant_id` OBLIGATORIO. Una hoja impresa es de un centro, tiene su nombre
--   en el pie y su código.
--
-- EL PREFIJO `contenido_` NO ES DECORATIVO. En este esquema conviven dos
-- productos: las tablas `academia_*` (Lyceo) y las de instituto, sin prefijo y
-- en inglés (`students`, `tasks`, `subjects`). Estas no son ni de uno ni de
-- otro —el catálogo se comparte y una hoja la puede imprimir cualquiera de los
-- dos—, así que ponerles un prefijo de producto sería mentir. `contenido_` dice
-- lo que son y las deja juntas en una lista de sesenta tablas.
--
-- POR QUÉ EL CATÁLOGO NO APUNTA A `subjects`. `subjects` es de un tenant y de
-- instituto; el catálogo es compartido. Una clave foránea de una fila común a
-- una tabla de un centro no se puede escribir. La materia y el curso van como
-- texto ('Matemáticas', '1.º ESO') a propósito.
--
-- Y POR QUÉ `comunidad`. Los saberes básicos que se guardan en `temas` son
-- códigos del currículo autonómico (MAT.1.A.2.3 es la ORDEN ECD/1172/2022, de
-- Aragón). El mismo código en otra comunidad significa otra cosa o no existe.
-- Sin esta columna, el primer centro de fuera de Aragón obliga a rehacer la
-- tabla.
--
-- Verificado antes de escribirla: ninguno de estos nombres de tabla existe ya
-- en el esquema public.

-- ── TEMAS ────────────────────────────────────────────────────────────────
-- Un tema es "Números enteros" de 1.º ESO de Matemáticas. NO es un "tema 1":
-- el currículo de Aragón organiza los saberes por curso pero no fija ningún
-- orden de temas — el orden lo pone la editorial. Por eso `orden` es una
-- sugerencia para pintar listas y no una verdad del currículo.
create table if not exists public.contenido_temas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  materia text not null,
  curso text not null,
  nombre text not null,
  comunidad text not null default 'aragon',
  -- Códigos de saberes básicos del currículo ('MAT.1.A.2.3'). Sirven para
  -- justificar ante un centro que la hoja cubre lo que toca.
  saberes text[] not null default '{}',
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- ── CONCEPTOS ────────────────────────────────────────────────────────────
-- Lo que de verdad hay que escribir a mano. Para un tema son 8-12 conceptos, y
-- son los que convierten "hazme ejercicios de progresiones" en "hazme dos de
-- distinguir la diferencia de la razón, nivel refuerzo".
create table if not exists public.contenido_conceptos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  tema_id uuid not null references public.contenido_temas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  -- Los conceptos que no se pueden preguntar sin dibujo (los números
  -- triangulares, leer una gráfica) quedan FUERA de la generación: un modelo
  -- no dibuja eso de forma fiable y la hoja saldría mal. Se marcan en vez de
  -- borrarlos para que se vea que existen y que están pendientes.
  requiere_figura boolean not null default false,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- ── ERRORES TÍPICOS ──────────────────────────────────────────────────────
-- Lo único que los libros de referencia NO dan: cómo se falla. Sale de Jorge y,
-- más adelante, de los fallos reales que vea el tutor. Puede estar vacía al
-- principio: sin errores típicos la generación funciona igual, solo que sin
-- poder pedir ejercicios que provoquen un error concreto.
create table if not exists public.contenido_errores_tipo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  concepto_id uuid not null references public.contenido_conceptos(id) on delete cascade,
  nombre text not null,
  descripcion text,
  orden int not null default 0,
  created_at timestamptz not null default now()
);

-- ── ARQUETIPOS ───────────────────────────────────────────────────────────
-- El tipo de pregunta: "dada la sucesión, halla el término general". Es la
-- unidad de reutilización — la IA genera INSTANCIAS de un arquetipo y no se
-- inventa el tipo de pregunta, que es donde se va de madre.
create table if not exists public.contenido_arquetipos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  concepto_id uuid not null references public.contenido_conceptos(id) on delete cascade,
  nombre text not null,
  -- Lo que se le dice al modelo para generar una instancia, y un ejemplo
  -- propio. El ejemplo no es adorno: la dificultad etiquetada "a ojo" por un
  -- modelo es un desastre, y se corrige enseñándole cómo es un refuerzo NUESTRO.
  instrucciones text,
  ejemplo text,
  tipo text not null default 'ejercicio' check (tipo in ('ejercicio', 'problema')),
  dificultad int not null default 2 check (dificultad between 1 and 3),
  requiere_figura boolean not null default false,
  estado text not null default 'activo' check (estado in ('activo', 'retirado')),
  -- REVISIÓN IMPLÍCITA. Cada vez que un profesor pulsa "cambiar este ejercicio"
  -- se suma uno aquí. No hay que pedirle a nadie que valore nada: un arquetipo
  -- que se cambia tres veces es malo y se retira. Lo mantiene el backend.
  veces_cambiado int not null default 0,
  created_at timestamptz not null default now()
);

-- ── EJERCICIOS ───────────────────────────────────────────────────────────
-- Una instancia concreta, ya generada y con su texto definitivo.
--
-- UN EJERCICIO NO SE EDITA NUNCA una vez usado: corregir su enunciado crea una
-- FILA NUEVA que apunta a la vieja por `reemplaza_a`, y la vieja pasa a
-- 'retirado'. Si se editara en sitio, los intentos ya registrados apuntarían a
-- un texto que el alumno no llegó a ver, y el historial diría cosas falsas sin
-- que nadie pueda notarlo.
create table if not exists public.contenido_ejercicios (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  concepto_id uuid not null references public.contenido_conceptos(id) on delete cascade,
  -- Anulable: un ejercicio escrito a mano por un profesor no tiene por qué
  -- venir de ningún arquetipo.
  arquetipo_id uuid references public.contenido_arquetipos(id) on delete set null,
  enunciado text not null,
  -- Los apartados a)/b)/c) y cómo se pintan, con la misma forma que ya consume
  -- la plantilla (assets/shared/hoja/js/actividades.js): un array de textos,
  -- en cuántas columnas van y cuántas líneas de pauta se dejan para escribir.
  apartados text[] not null default '{}',
  columnas int not null default 1 check (columnas between 1 and 3),
  lineas int not null default 0 check (lineas between 0 and 12),
  tipo text not null default 'ejercicio' check (tipo in ('ejercicio', 'problema')),
  dificultad int not null default 2 check (dificultad between 1 and 3),
  -- LA SOLUCIÓN NO SE IMPRIME. Está aquí porque es el control de calidad: si al
  -- resolverlo el término 20 sale 3,4666… o el problema no tiene solución
  -- entera, el ejercicio se descarta solo y se genera otro. Es lo que permite
  -- que el profesor no tenga que revisar la hoja, que es el objetivo.
  solucion jsonb,
  -- Qué comprobó la autovalidación y con qué resultado. Sirve para saber qué
  -- arquetipos generan basura sin tener que leer los ejercicios uno a uno.
  validacion jsonb,
  origen text not null default 'ia' check (origen in ('ia', 'manual')),
  -- Con qué modelo salió. Cuando dentro de un año un modelo nuevo genere mejor,
  -- esto es lo que permite saber qué hay que regenerar.
  modelo text,
  estado text not null default 'propuesto'
    check (estado in ('propuesto', 'aprobado', 'retirado')),
  -- Para no repetirle el mismo ejercicio al mismo alumno: la variedad sin
  -- repetición exige saber qué se ha usado ya.
  veces_usado int not null default 0,
  reemplaza_a uuid references public.contenido_ejercicios(id) on delete set null,
  creado_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ── HOJAS ────────────────────────────────────────────────────────────────
-- Una hoja impresa. `codigo` es el que va en el pie del papel (H-260914-01):
-- la única pieza que une un folio corregido a mano con estos datos.
--
-- ESENCIAL Y EJEMPLOS SE GUARDAN COMO SNAPSHOT, no como referencia a otra
-- tabla. Un folio impreso en octubre tiene que seguir diciendo en junio lo que
-- decía cuando se imprimió; si el texto de teoría se retoca después, la hoja
-- que tiene el alumno en su carpeta y la que se ve en pantalla dejarían de ser
-- la misma, y entonces no se puede corregir ni discutir nada.
create table if not exists public.contenido_hojas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  codigo text not null,
  tema_id uuid references public.contenido_temas(id) on delete set null,
  -- EL TÍTULO GRANDE DE LA HOJA ES EL OBJETIVO, no el tema: "Sumar y restar
  -- números enteros", no "Números enteros". Un tema da para cuatro o cinco
  -- hojas y una hoja sin objetivo único no se puede montar ni medir.
  objetivo text not null,
  -- Snapshot de la cabecera, por lo mismo que esencial/ejemplos: el tema se
  -- puede renombrar, el centro se puede renombrar, y el papel no cambia.
  materia text not null default '',
  curso text not null default '',
  tema text not null default '',
  centro text not null default '',
  esencial jsonb,
  ejemplos jsonb,
  creada_por uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint contenido_hojas_codigo_unico unique (tenant_id, codigo)
);

-- ── HUECOS DE LA HOJA ────────────────────────────────────────────────────
-- LA HOJA ES UN OBJETO CON HUECOS NUMERADOS, y cada hueco apunta a un
-- ejercicio. Sin esto, cambiar la actividad 3 obliga a regenerar la hoja
-- entera, lo que cambia las otras cuatro y hace inútil el botón de "cambiar
-- este ejercicio".
--
-- El hueco guarda ADEMÁS el concepto y la dificultad con los que se pidió,
-- porque "otro al azar" tiene que ser otro DEL MISMO HUECO: mismo concepto y
-- misma dificultad. Si no, el profesor arregla una actividad que no le gusta y
-- de paso rompe la progresión de la hoja sin enterarse.
create table if not exists public.contenido_hoja_huecos (
  id uuid primary key default gen_random_uuid(),
  hoja_id uuid not null references public.contenido_hojas(id) on delete cascade,
  orden int not null check (orden > 0),
  ejercicio_id uuid not null references public.contenido_ejercicios(id) on delete restrict,
  concepto_id uuid references public.contenido_conceptos(id) on delete set null,
  dificultad int check (dificultad between 1 and 3),
  veces_cambiado int not null default 0,
  constraint contenido_hoja_huecos_orden_unico unique (hoja_id, orden)
);

-- ── ÍNDICES ──────────────────────────────────────────────────────────────
-- El catálogo se recorre siempre hacia abajo (tema → conceptos → arquetipos) y
-- se filtra siempre por centro incluyendo lo común, de ahí los índices por
-- padre y el de materia/curso.
create index if not exists idx_contenido_temas_materia
  on public.contenido_temas(materia, curso, comunidad);
create index if not exists idx_contenido_conceptos_tema
  on public.contenido_conceptos(tema_id, orden);
create index if not exists idx_contenido_errores_concepto
  on public.contenido_errores_tipo(concepto_id, orden);
create index if not exists idx_contenido_arquetipos_concepto
  on public.contenido_arquetipos(concepto_id) where estado = 'activo';

-- La consulta caliente al montar una hoja: "dame ejercicios aprobados de este
-- concepto con esta dificultad, empezando por los menos usados".
create index if not exists idx_contenido_ejercicios_disponibles
  on public.contenido_ejercicios(concepto_id, dificultad, veces_usado)
  where estado = 'aprobado';
create index if not exists idx_contenido_ejercicios_arquetipo
  on public.contenido_ejercicios(arquetipo_id);
create index if not exists idx_contenido_hojas_tenant
  on public.contenido_hojas(tenant_id, created_at desc);
create index if not exists idx_contenido_hoja_huecos_ejercicio
  on public.contenido_hoja_huecos(ejercicio_id);

-- ── RLS ──────────────────────────────────────────────────────────────────
-- El backend usa service_role (bypasa RLS) para todo — mismo criterio que el
-- resto del esquema (migraciones 093/094/097): estas políticas son la red de
-- seguridad por si algún día el frontend habla directamente con PostgREST, no
-- el mecanismo real de control de acceso, que vive en las rutas.
--
-- EL CATÁLOGO SE LEE, NO SE ESCRIBE desde el navegador. Cualquier miembro de un
-- centro puede leer lo común (tenant_id null) y lo suyo; escribir lo común no
-- lo puede hacer NADIE por esta vía —ninguna política lo permite—, solo el
-- backend con la service key. Un admin que pudiera editar una fila común
-- estaría editando el catálogo de todos los demás centros.
alter table public.contenido_temas enable row level security;
alter table public.contenido_conceptos enable row level security;
alter table public.contenido_errores_tipo enable row level security;
alter table public.contenido_arquetipos enable row level security;
alter table public.contenido_ejercicios enable row level security;
alter table public.contenido_hojas enable row level security;
alter table public.contenido_hoja_huecos enable row level security;

drop policy if exists contenido_temas_select on public.contenido_temas;
create policy contenido_temas_select on public.contenido_temas
for select to authenticated
using (tenant_id is null or public.has_active_role(tenant_id, array['admin', 'teacher']));

drop policy if exists contenido_temas_admin_write on public.contenido_temas;
create policy contenido_temas_admin_write on public.contenido_temas
for all to authenticated
using (tenant_id is not null and public.has_active_role(tenant_id, array['admin']))
with check (tenant_id is not null and public.has_active_role(tenant_id, array['admin']));

drop policy if exists contenido_conceptos_select on public.contenido_conceptos;
create policy contenido_conceptos_select on public.contenido_conceptos
for select to authenticated
using (tenant_id is null or public.has_active_role(tenant_id, array['admin', 'teacher']));

drop policy if exists contenido_conceptos_admin_write on public.contenido_conceptos;
create policy contenido_conceptos_admin_write on public.contenido_conceptos
for all to authenticated
using (tenant_id is not null and public.has_active_role(tenant_id, array['admin']))
with check (tenant_id is not null and public.has_active_role(tenant_id, array['admin']));

drop policy if exists contenido_errores_select on public.contenido_errores_tipo;
create policy contenido_errores_select on public.contenido_errores_tipo
for select to authenticated
using (tenant_id is null or public.has_active_role(tenant_id, array['admin', 'teacher']));

drop policy if exists contenido_errores_admin_write on public.contenido_errores_tipo;
create policy contenido_errores_admin_write on public.contenido_errores_tipo
for all to authenticated
using (tenant_id is not null and public.has_active_role(tenant_id, array['admin']))
with check (tenant_id is not null and public.has_active_role(tenant_id, array['admin']));

drop policy if exists contenido_arquetipos_select on public.contenido_arquetipos;
create policy contenido_arquetipos_select on public.contenido_arquetipos
for select to authenticated
using (tenant_id is null or public.has_active_role(tenant_id, array['admin', 'teacher']));

drop policy if exists contenido_arquetipos_admin_write on public.contenido_arquetipos;
create policy contenido_arquetipos_admin_write on public.contenido_arquetipos
for all to authenticated
using (tenant_id is not null and public.has_active_role(tenant_id, array['admin']))
with check (tenant_id is not null and public.has_active_role(tenant_id, array['admin']));

-- LOS EJERCICIOS SE LEEN SIN LA SOLUCIÓN. Esta política deja leer la fila
-- entera, y por eso el frontend NO debe hablar con esta tabla directamente: la
-- ruta del backend selecciona columnas y nunca devuelve `solucion` a una
-- pantalla de alumno. Si algún día se abre PostgREST al navegador, aquí hace
-- falta una vista sin esa columna antes que una política.
drop policy if exists contenido_ejercicios_select on public.contenido_ejercicios;
create policy contenido_ejercicios_select on public.contenido_ejercicios
for select to authenticated
using (tenant_id is null or public.has_active_role(tenant_id, array['admin', 'teacher']));

drop policy if exists contenido_ejercicios_admin_write on public.contenido_ejercicios;
create policy contenido_ejercicios_admin_write on public.contenido_ejercicios
for all to authenticated
using (tenant_id is not null and public.has_active_role(tenant_id, array['admin']))
with check (tenant_id is not null and public.has_active_role(tenant_id, array['admin']));

-- Las hojas sí son de quien las monta: un profesor las crea y las imprime.
drop policy if exists contenido_hojas_all on public.contenido_hojas;
create policy contenido_hojas_all on public.contenido_hojas
for all to authenticated
using (public.has_active_role(tenant_id, array['admin', 'teacher']))
with check (public.has_active_role(tenant_id, array['admin', 'teacher']));

-- Los huecos no tienen tenant_id propio a propósito: no hay hueco sin hoja, y
-- duplicar el tenant aquí sería una segunda verdad que se puede desincronizar.
-- El acceso se resuelve por la hoja.
drop policy if exists contenido_hoja_huecos_all on public.contenido_hoja_huecos;
create policy contenido_hoja_huecos_all on public.contenido_hoja_huecos
for all to authenticated
using (
  exists (
    select 1 from public.contenido_hojas h
    where h.id = contenido_hoja_huecos.hoja_id
      and public.has_active_role(h.tenant_id, array['admin', 'teacher'])
  )
)
with check (
  exists (
    select 1 from public.contenido_hojas h
    where h.id = contenido_hoja_huecos.hoja_id
      and public.has_active_role(h.tenant_id, array['admin', 'teacher'])
  )
);

-- ── COMENTARIOS ──────────────────────────────────────────────────────────
comment on table public.contenido_temas is
  'Temas del catálogo didáctico (materia + curso + nombre). tenant_id NULL = catálogo común a todos los centros; con tenant_id = tema propio de un centro. No apunta a subjects porque subjects es de un tenant y de instituto, y esto se comparte.';
comment on column public.contenido_temas.saberes is
  'Códigos de saberes básicos del currículo autonómico (p. ej. MAT.1.A.2.3, ORDEN ECD/1172/2022 de Aragón). Solo tienen sentido junto a comunidad.';
comment on column public.contenido_temas.orden is
  'Orden sugerido para pintar listas. NO es el orden del currículo: Aragón organiza los saberes por curso y no fija ningún orden de temas.';
comment on column public.contenido_conceptos.requiere_figura is
  'true = el concepto no se puede preguntar sin dibujo o gráfica. Queda FUERA de la generación automática: un modelo no lo produce de forma fiable.';
comment on table public.contenido_errores_tipo is
  'Cómo se falla en un concepto. Lo único que los libros de referencia no dan. Puede estar vacía: sin errores típicos la generación funciona, solo que no se pueden pedir ejercicios que provoquen un error concreto.';
comment on table public.contenido_arquetipos is
  'Tipos de pregunta ("dada la sucesión, halla el término general"). Unidad de reutilización: la IA genera instancias de un arquetipo y no se inventa el tipo de pregunta.';
comment on column public.contenido_arquetipos.veces_cambiado is
  'Cuántas veces un profesor ha pulsado "cambiar este ejercicio" sobre una instancia de este arquetipo. Revisión implícita: lo que se cambia tres veces es malo y se retira. Lo mantiene el backend.';
comment on table public.contenido_ejercicios is
  'Instancias concretas ya generadas. INMUTABLES una vez usadas: corregir un enunciado crea una fila nueva con reemplaza_a apuntando a la vieja, que pasa a estado retirado. Editar en sitio haría que los intentos ya registrados apuntaran a un texto que el alumno nunca vio.';
comment on column public.contenido_ejercicios.solucion is
  'La solución, que NO se imprime. Es el control de calidad: si al resolverlo no sale un número razonable, el ejercicio se descarta solo y se genera otro. Nunca se devuelve a una pantalla de alumno.';
comment on column public.contenido_ejercicios.veces_usado is
  'Cuántas hojas lo han incluido. Sirve para repartir la variedad y no repetirle lo mismo al mismo alumno.';
comment on table public.contenido_hojas is
  'Una hoja de ejercicios montada, con el código que va impreso en el pie (H-AAMMDD-NN). Cabecera, teoría y ejemplo se guardan como snapshot: el folio que tiene el alumno en la carpeta tiene que seguir diciendo lo mismo meses después.';
comment on column public.contenido_hojas.objetivo is
  'El título grande de la hoja, que es el OBJETIVO y no el tema ("Sumar y restar números enteros", no "Números enteros"). Un tema da para cuatro o cinco hojas.';
comment on table public.contenido_hoja_huecos is
  'Los huecos numerados de una hoja, cada uno apuntando a un ejercicio. Permiten cambiar una actividad sin regenerar la hoja. Guardan concepto y dificultad del hueco porque "otro al azar" tiene que ser otro del mismo concepto y la misma dificultad, o se rompe la progresión.';
