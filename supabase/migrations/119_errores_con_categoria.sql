-- 119_errores_con_categoria.sql
-- Los errores típicos dejan de ser una lista plana: cada uno lleva DE QUÉ CLASE
-- es. Y los ejercicios pueden llevar, por cada error, la respuesta equivocada
-- que ese error produce.
--
-- DE DÓNDE SALE ESTO. Jorge, 16/09/2026, al pasar su catálogo de errores de
-- enteros: *"yo no trataría estos 20 errores como una simple lista plana. La
-- distinción final es bastante importante: permitiría que el sistema detectase
-- que un alumno que hace −7 + 4 = +3 tiene un error de signo en suma con signos
-- distintos, mientras que otro que hace −7 + 4 = −4 tiene probablemente un
-- error de cálculo, aunque ambos hayan fallado el mismo ejercicio"*.
--
-- POR QUÉ LA CATEGORÍA NO ES UNA ETIQUETA DECORATIVA. Porque es lo único que
-- distingue "hay que volver a explicar el concepto" de "no hay que hacer nada".
-- Sin ella, el sistema reacciona igual ante un alumno que no entiende qué es un
-- número negativo y ante uno que lo entiende perfectamente y ha copiado mal un
-- signo — y al segundo le vuelve a explicar la teoría. Un tutor que te reexplica
-- lo que ya sabes porque has tenido un despiste es peor que uno que se calla:
-- pierdes la confianza en él y dejas de leerlo. La categoría es lo que permite
-- que el descuido NO genere ninguna acción.
--
-- Las siete clases son las de Jorge, tal cual:
--   conceptual     — no entiende qué es un negativo, el valor absoluto, el
--                    opuesto o su posición en la recta.
--   signo          — entiende el procedimiento, pero pierde o cambia un signo.
--   operacion      — aplica bien los signos y calcula mal. NO es un error de
--                    enteros: es de aritmética con naturales, y reenseñar
--                    enteros aquí no arregla nada.
--   procedimiento  — no sabe qué regla toca aplicar.
--   jerarquia      — conoce las operaciones y las hace en mal orden.
--   interpretacion — sabe calcular y traduce mal el enunciado a una operación.
--   descuido       — sabe hacerlo y falla una vez. No genera acción.
--
-- `predecible` SEPARA LO QUE SE PUEDE DIAGNOSTICAR DE LO QUE NO. Un error
-- predecible produce una respuesta equivocada que se puede CALCULAR de antemano:
-- si el ejercicio es −8 + 5, el error de "sumar los valores absolutos" da −13, y
-- ese −13 no lo produce ningún otro error de la lista. Un error no predecible
-- (descuido, cálculo) no tiene una respuesta característica: es el cajón de "la
-- respuesta está mal y no coincide con ninguno de los errores conocidos". Sin
-- esta distinción, el diagnóstico tendría que adivinar, y adivinar es
-- exactamente lo que no se puede hacer aquí (ver el `31%` inventado que se tiró
-- del diseño inicial: un porcentaje escrito por un modelo es una opinión con
-- aspecto de medición).

alter table public.contenido_errores_tipo
  add column if not exists categoria text not null default 'conceptual'
    check (categoria in (
      'conceptual', 'signo', 'operacion', 'procedimiento',
      'jerarquia', 'interpretacion', 'descuido'
    )),
  add column if not exists predecible boolean not null default true,
  -- El cálculo mal hecho y el bien hecho, tal como los escribe Jorge en su
  -- catálogo. Van en dos columnas y no dentro de `descripcion` para que el tutor
  -- pueda enseñar "así lo has hecho / así es" sin tener que trocear un párrafo,
  -- y para que el generador los pueda meter en el prompt tal cual.
  add column if not exists ejemplo_erroneo text,
  add column if not exists ejemplo_correcto text;

-- El `default 'conceptual'` es solo para que la columna se pueda añadir a una
-- tabla que ya existe. La tabla está vacía hoy, así que no clasifica nada mal;
-- cuando se siembre el catálogo, cada fila trae su categoría explícita.

comment on column public.contenido_errores_tipo.categoria is
  'De qué clase es el error, y por tanto qué hay que hacer con él: conceptual (reexplicar), signo, operacion (no es de este tema, es de cálculo), procedimiento (qué regla toca), jerarquia, interpretacion (traducir el enunciado), descuido (no hacer nada). Sin esto el sistema reexplica la teoría a quien solo ha tenido un despiste.';
comment on column public.contenido_errores_tipo.predecible is
  'true = este error produce una respuesta equivocada que se puede calcular de antemano, así que se puede diagnosticar viendo lo que escribió el alumno. false = es el cajón residual (descuido, cálculo): la respuesta está mal y no coincide con ningún error conocido.';
comment on column public.contenido_errores_tipo.ejemplo_erroneo is
  'El cálculo tal como lo hace el alumno que comete este error (p. ej. "-8 + 5 = -13").';
comment on column public.contenido_errores_tipo.ejemplo_correcto is
  'El mismo cálculo bien hecho (p. ej. "-8 + 5 = -3").';

-- ── LOS DISTRACTORES: qué respuesta da cada error en CADA ejercicio ───────
--
-- POR QUÉ ESTA TABLA EXISTE HOY, ESTANDO VACÍA, y no se crea más adelante junto
-- con el registro de intentos. Porque un ejercicio es INMUTABLE una vez usado
-- (ver la migración 118): si el generador produce quinientos ejercicios sin sus
-- distractores, no se les pueden añadir después — habría que generar filas
-- nuevas, y las filas nuevas pierden el vínculo con los intentos ya registrados
-- sobre las viejas. O el distractor nace con el ejercicio, o no nace. Y el
-- generador es el paso siguiente.
--
-- POR QUÉ UNA TABLA Y NO UN CAMPO DENTRO DE `solucion` (que es jsonb y cabría).
-- Por dos razones concretas:
--   1. "¿Cuántos intentos han caído en el error de sumar valores absolutos, en
--      todo el centro?" es una consulta que aquí es un join y dentro de un jsonb
--      es recorrer todos los ejercicios uno a uno.
--   2. Un `error_id` escrito dentro de un jsonb no tiene clave foránea: el día
--      que se retire un error, el jsonb sigue apuntándole y nadie se enteraría.
--      Es la misma mentira silenciosa que un `ficha_url` que guarda una ruta.
--
-- NO HAY UNIQUE SOBRE (ejercicio_id, respuesta), Y ES A PROPÓSITO. Dos errores
-- distintos pueden dar la misma respuesta equivocada en el mismo ejercicio: en
-- 5 − (−3), tanto "no veo el signo del número" como "restar siempre hace más
-- pequeño" llevan a 2. Prohibirlo sería prohibir un ejercicio legítimo. Lo que
-- pasa es que ese ejercicio NO SIRVE para distinguir esos dos errores, y eso es
-- una regla de calidad del generador —preferir ejercicios cuyos distractores no
-- choquen—, no una restricción de la base de datos. Cuando choquen, el
-- diagnóstico dirá "es uno de estos dos" en vez de elegir a cara o cruz.
create table if not exists public.contenido_ejercicio_errores (
  id uuid primary key default gen_random_uuid(),
  ejercicio_id uuid not null references public.contenido_ejercicios(id) on delete cascade,
  error_id uuid not null references public.contenido_errores_tipo(id) on delete cascade,
  -- La respuesta que escribiría un alumno con este error en ESTE ejercicio.
  -- Texto y no número: hay ejercicios cuya respuesta es "-3" y otros cuya
  -- respuesta es "-8 < -3" o una lista de apartados.
  respuesta text not null,
  -- Cuál de los apartados (a, b, c…), cuando el ejercicio tiene varios. NULL =
  -- el ejercicio es uno solo.
  apartado int check (apartado is null or apartado > 0),
  created_at timestamptz not null default now(),
  -- `NULLS NOT DISTINCT` NO ES UN ADORNO, ES UN ARREGLO. Con el UNIQUE normal
  -- esta restricción NO servía para nada en el caso más común: en SQL dos NULL
  -- no son iguales entre sí, así que un ejercicio sin apartados (apartado NULL)
  -- admitía dos distractores del MISMO error con respuestas distintas — y
  -- entonces el diagnóstico elige uno de los dos a cara o cruz. Comprobado en un
  -- PostgreSQL de prueba: con el UNIQUE de toda la vida, la fila duplicada
  -- entraba sin queja. Requiere PostgreSQL 15 o superior; producción va por
  -- 17.6 (consultado, no supuesto).
  constraint contenido_ejercicio_errores_unico
    unique nulls not distinct (ejercicio_id, error_id, apartado)
);

create index if not exists idx_contenido_ejercicio_errores_ejercicio
  on public.contenido_ejercicio_errores(ejercicio_id);
-- "Enséñame los ejercicios que provocan este error", que es como se monta una
-- hoja de refuerzo dirigida a un error concreto.
create index if not exists idx_contenido_ejercicio_errores_error
  on public.contenido_ejercicio_errores(error_id);

alter table public.contenido_ejercicio_errores enable row level security;

-- Se lee junto con el ejercicio y se resuelve por él: esta tabla no tiene
-- tenant_id propio, igual que los huecos de una hoja, porque no hay distractor
-- sin ejercicio y duplicar el tenant sería una segunda verdad desincronizable.
--
-- OJO: esto NO se puede servir a una pantalla de alumno. Un distractor es media
-- solución — dice cuál es la respuesta equivocada más probable, y de ahí a la
-- correcta hay un paso. La ruta del backend que sirve una hoja no selecciona
-- esta tabla; solo la lee el diagnóstico y la zona docente.
drop policy if exists contenido_ejercicio_errores_select on public.contenido_ejercicio_errores;
create policy contenido_ejercicio_errores_select on public.contenido_ejercicio_errores
for select to authenticated
using (
  exists (
    select 1 from public.contenido_ejercicios e
    where e.id = contenido_ejercicio_errores.ejercicio_id
      and (e.tenant_id is null or public.has_active_role(e.tenant_id, array['admin', 'teacher']))
  )
);

drop policy if exists contenido_ejercicio_errores_admin_write on public.contenido_ejercicio_errores;
create policy contenido_ejercicio_errores_admin_write on public.contenido_ejercicio_errores
for all to authenticated
using (
  exists (
    select 1 from public.contenido_ejercicios e
    where e.id = contenido_ejercicio_errores.ejercicio_id
      and e.tenant_id is not null
      and public.has_active_role(e.tenant_id, array['admin'])
  )
)
with check (
  exists (
    select 1 from public.contenido_ejercicios e
    where e.id = contenido_ejercicio_errores.ejercicio_id
      and e.tenant_id is not null
      and public.has_active_role(e.tenant_id, array['admin'])
  )
);

comment on table public.contenido_ejercicio_errores is
  'Por cada ejercicio y cada error predecible, la respuesta equivocada que ese error produce. Es lo que permite diagnosticar POR QUÉ falló un alumno y no solo QUE falló. Nace con el ejercicio porque los ejercicios son inmutables: añadirlo después obligaría a regenerarlos y se perdería el vínculo con los intentos ya registrados. Nunca se sirve a una pantalla de alumno: un distractor es media solución.';
comment on column public.contenido_ejercicio_errores.respuesta is
  'Lo que escribiría el alumno con este error. Texto, no número: hay respuestas que son "-3" y otras que son "-8 < -3" o una lista.';
comment on column public.contenido_ejercicio_errores.apartado is
  'Apartado del ejercicio al que corresponde (1 = a), 2 = b)…). NULL si el ejercicio no tiene apartados.';
