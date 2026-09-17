-- 123 — EL OBJETIVO: la unidad común de los tres generadores.
--
-- Hoy el catálogo es `tema → conceptos → arquetipos → ejercicios`, y en
-- `contenido_hojas` el objetivo es un **campo de texto libre**. Eso aguanta
-- mientras solo exista el generador de hojas, y se rompe en cuanto entran
-- los otros dos, porque los tres hablan de lo mismo:
--
--   Programación didáctica  = una secuencia de objetivos en el calendario
--   Guion de clase          = lo que se hace en 55 min para uno o dos
--   Hoja de ejercicios      = la práctica en papel de UN objetivo
--   Dominio de un alumno    = qué objetivos domina (no qué temas)
--
-- Con el objetivo como texto libre, cada generador se lo escribiría con sus
-- palabras y no habría forma de cruzar "lo que programé" con "lo que di" con
-- "lo que le mandé" con "lo que sabe". Serían tres documentos bonitos y
-- desconectados. De ahí que esto sea lo ÚNICO del modelo de datos que había
-- que decidir antes de escribir el generador (ver claude/plan-recursos.md).
--
-- POR QUÉ ENTRE EL TEMA Y LOS CONCEPTOS, y no como una etiqueta del
-- concepto: un objetivo agrupa varios conceptos Y un concepto sirve a varios
-- objetivos. "Resta como suma del opuesto" se trabaja al sumar y restar, y
-- otra vez al quitar paréntesis. Es una relación de muchos a muchos de
-- verdad, no una jerarquía, y por eso lleva su tabla puente.

create table if not exists public.contenido_objetivos (
  id uuid primary key default gen_random_uuid(),

  -- Nullable = objetivo del catálogo común, igual que en temas y conceptos
  -- (migración 118). Un centro puede añadir los suyos; el común no se toca.
  tenant_id uuid references public.tenants(id) on delete cascade,

  tema_id uuid not null references public.contenido_temas(id) on delete cascade,

  nombre text not null,
  descripcion text,

  -- LO QUE HACE POSIBLE LA PROGRAMACIÓN. Sin una estimación de sesiones por
  -- objetivo, un generador de programaciones tiene que inventarse el
  -- calendario, y una programación con fechas inventadas no sirve ni para
  -- Inspección ni para dar clase. El tope de 20 es un guardarraíl contra un
  -- dedazo, no una regla pedagógica.
  sesiones_estimadas integer not null default 1
    check (sesiones_estimadas between 1 and 20),

  -- Criterios de evaluación oficiales (en Aragón, CE.M.1 … CE.M.9). Se
  -- guardan aquí y NO en el concepto porque el criterio se evalúa al nivel
  -- del objetivo, que es como lo pide el currículo.
  --
  -- NACE VACÍO A PROPÓSITO, incluso en la semilla de enteros: no he
  -- verificado contra el anexo oficial qué criterios corresponden a cada
  -- objetivo, y rellenarlo "a ojo" es exactamente el error de los códigos de
  -- saberes inventados que hubo que corregir el 17/09. La columna queda
  -- lista; se llena cuando se lea el anexo, no antes.
  criterios text[] not null default '{}',

  orden integer not null default 0,
  created_at timestamptz not null default now()
);

-- Dos objetivos del mismo tema no pueden ocupar el mismo puesto: el orden ES
-- la secuencia didáctica, y un empate lo dejaría al azar de la consulta.
-- `nulls not distinct` porque el catálogo común tiene tenant_id NULL y sin
-- eso la restricción no miraría esas filas (PostgreSQL 15+; es la misma
-- trampa que se documentó en la migración 120).
create unique index if not exists contenido_objetivos_orden_idx
  on public.contenido_objetivos (tenant_id, tema_id, orden)
  nulls not distinct;

create index if not exists contenido_objetivos_tema_idx
  on public.contenido_objetivos (tema_id, orden);

-- La tabla puente. Sin columnas de más: si el generador necesita algún día
-- pesar un concepto dentro del objetivo, se añade entonces con un dato real
-- delante, no adivinando ahora cuál sería.
create table if not exists public.contenido_objetivo_conceptos (
  objetivo_id uuid not null references public.contenido_objetivos(id) on delete cascade,
  concepto_id uuid not null references public.contenido_conceptos(id) on delete cascade,
  primary key (objetivo_id, concepto_id)
);

create index if not exists contenido_objetivo_conceptos_concepto_idx
  on public.contenido_objetivo_conceptos (concepto_id);

-- La hoja apunta al objetivo Y SIGUE GUARDANDO SU TEXTO.
--
-- No es redundancia: es la misma regla que ya gobierna `esencial` y
-- `ejemplos` (migración 118). El folio impreso no puede cambiar porque
-- alguien renombre el objetivo tres meses después. `objetivo` es la copia de
-- lo que se imprimió; `objetivo_id` es con qué se generó.
--
-- Nullable: todas las hojas anteriores a esta migración no tienen objetivo
-- del catálogo, y `on delete set null` porque borrar un objetivo del
-- catálogo no puede borrar el rastro de una hoja que ya se repartió.
alter table public.contenido_hojas
  add column if not exists objetivo_id uuid references public.contenido_objetivos(id) on delete set null;

create index if not exists contenido_hojas_objetivo_idx
  on public.contenido_hojas (objetivo_id)
  where objetivo_id is not null;

-- ── RLS: mismo criterio que la migración 118 ──────────────────────────────
-- El catálogo común (tenant_id NULL) se LEE pero no se escribe desde el
-- navegador; un centro solo escribe lo suyo.

alter table public.contenido_objetivos enable row level security;
alter table public.contenido_objetivo_conceptos enable row level security;

drop policy if exists contenido_objetivos_select on public.contenido_objetivos;
create policy contenido_objetivos_select on public.contenido_objetivos
for select to authenticated
using (tenant_id is null or public.has_active_role(tenant_id, array['admin', 'teacher']));

drop policy if exists contenido_objetivos_admin_write on public.contenido_objetivos;
create policy contenido_objetivos_admin_write on public.contenido_objetivos
for all to authenticated
using (tenant_id is not null and public.has_active_role(tenant_id, array['admin']))
with check (tenant_id is not null and public.has_active_role(tenant_id, array['admin']));

-- La puente se lee a través de su objetivo: así el aislamiento lo decide UNA
-- política y no dos que puedan desincronizarse.
drop policy if exists contenido_objetivo_conceptos_select on public.contenido_objetivo_conceptos;
create policy contenido_objetivo_conceptos_select on public.contenido_objetivo_conceptos
for select to authenticated
using (exists (
  select 1 from public.contenido_objetivos o
  where o.id = contenido_objetivo_conceptos.objetivo_id
    and (o.tenant_id is null or public.has_active_role(o.tenant_id, array['admin', 'teacher']))
));

drop policy if exists contenido_objetivo_conceptos_admin_write on public.contenido_objetivo_conceptos;
create policy contenido_objetivo_conceptos_admin_write on public.contenido_objetivo_conceptos
for all to authenticated
using (exists (
  select 1 from public.contenido_objetivos o
  where o.id = contenido_objetivo_conceptos.objetivo_id
    and o.tenant_id is not null and public.has_active_role(o.tenant_id, array['admin'])
))
with check (exists (
  select 1 from public.contenido_objetivos o
  where o.id = contenido_objetivo_conceptos.objetivo_id
    and o.tenant_id is not null and public.has_active_role(o.tenant_id, array['admin'])
));

-- ── Semilla: los seis objetivos de Números enteros ────────────────────────
--
-- UUIDs fijos siguiendo la convención de la migración 120 (c0… tema, c1…
-- conceptos, c2… errores, c3… arquetipos): los objetivos son **c4…**. Fijos
-- para que la semilla se pueda volver a aplicar sin duplicar y para poder
-- referirlos desde otra migración.
--
-- `sesiones_estimadas` suma 9, que es lo que el tema ocupa en una
-- programación real de 1.º ESO. No es una constante universal: cada centro
-- puede ajustarlo en su copia.

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000001', null, 'c0000000-0000-4000-8000-000000000001',
   'Reconocer y ordenar números enteros',
   'Identificar situaciones que piden un número con signo, distinguir positivos, negativos y el cero, y comparar y ordenar enteros, incluida su representación en la recta.',
   1, 1),
  ('c4000000-0000-4000-8000-000000000002', null, 'c0000000-0000-4000-8000-000000000001',
   'Valor absoluto y opuesto',
   'Calcular el valor absoluto y el opuesto de un entero, y distinguir el signo del número del signo de la operación.',
   1, 2),
  ('c4000000-0000-4000-8000-000000000003', null, 'c0000000-0000-4000-8000-000000000001',
   'Sumar y restar enteros',
   'Sumar enteros del mismo y de distinto signo, y entender la resta como la suma del opuesto.',
   2, 3),
  ('c4000000-0000-4000-8000-000000000004', null, 'c0000000-0000-4000-8000-000000000001',
   'Quitar paréntesis y signos',
   'Eliminar paréntesis precedidos de signo, apoyándose en la resta como suma del opuesto.',
   1, 4),
  ('c4000000-0000-4000-8000-000000000005', null, 'c0000000-0000-4000-8000-000000000001',
   'Multiplicar, dividir y elevar a potencias',
   'Aplicar la regla de los signos en el producto y el cociente, y calcular potencias de base entera distinguiendo el efecto del exponente par o impar.',
   2, 5),
  ('c4000000-0000-4000-8000-000000000006', null, 'c0000000-0000-4000-8000-000000000001',
   'Resolver operaciones combinadas',
   'Aplicar la jerarquía de operaciones en expresiones con enteros que mezclan paréntesis, potencias y las cuatro operaciones.',
   2, 6)
on conflict (id) do nothing;

-- El mapeo objetivo → conceptos. Lo interesante son las filas REPETIDAS:
--
--   - "Resta como suma del opuesto" (c1…008) está en el objetivo 3 y en el 4,
--     porque es lo que explica por qué −(−3) = +3.
--   - "Eliminación de paréntesis" (c1…009) y "Regla de los signos" (c1…010)
--     vuelven a aparecer en operaciones combinadas.
--
-- Eso es exactamente el motivo de que esto sea una tabla puente y no una
-- columna `objetivo_id` en el concepto.
insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  -- 1. Reconocer y ordenar
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001'),
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002'),
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005'),
  ('c4000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000006'),
  -- 2. Valor absoluto y opuesto
  ('c4000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000003'),
  ('c4000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000004'),
  -- 3. Sumar y restar
  ('c4000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000007'),
  ('c4000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000008'),
  -- 4. Paréntesis y signos (reaprovecha el 008)
  ('c4000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000009'),
  ('c4000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000008'),
  -- 5. Multiplicar, dividir, potencias
  ('c4000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000010'),
  ('c4000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000011'),
  -- 6. Operaciones combinadas (reaprovecha el 009 y el 010)
  ('c4000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000012'),
  ('c4000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000009'),
  ('c4000000-0000-4000-8000-000000000006', 'c1000000-0000-4000-8000-000000000010')
on conflict (objetivo_id, concepto_id) do nothing;

comment on table public.contenido_objetivos is
  'Objetivos de aprendizaje: la unidad común de los tres generadores (programación, guion de clase y hoja de ejercicios) y la unidad en la que se medirá el dominio de un alumno. Entre el tema y los conceptos.';

comment on column public.contenido_objetivos.sesiones_estimadas is
  'Sesiones de clase que ocupa el objetivo. Es lo que permite a la programación repartir el curso en el calendario sin inventarse las fechas.';

comment on column public.contenido_objetivos.criterios is
  'Criterios de evaluación oficiales (CE.M.n en Aragón). Vacío mientras no se verifiquen contra el anexo: rellenarlos de memoria es cómo aparecieron los códigos de saberes inventados.';

comment on table public.contenido_objetivo_conceptos is
  'Qué conceptos trabaja cada objetivo. Muchos a muchos: un concepto sirve a varios objetivos (p. ej. la resta como suma del opuesto se usa al restar y al quitar paréntesis).';
