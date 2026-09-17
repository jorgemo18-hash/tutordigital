-- 120_semilla_enteros_1eso.sql
-- EL PRIMER TEMA DEL CATÁLOGO: Números enteros, 1.º ESO de Matemáticas.
-- 1 tema, 12 conceptos, 15 errores típicos y 34 arquetipos.
--
-- Es una migración de DATOS, no de esquema — salvo dos columnas que este
-- contenido necesita y que se añaden aquí porque no tienen sentido sin él (ver
-- abajo). Todo entra como CATÁLOGO COMÚN (`tenant_id` NULL): la suma de enteros
-- se falla igual en Huesca que en Teruel.
--
-- DE DÓNDE SALE CADA COSA, porque no todo tiene el mismo respaldo:
--
--   Los CONCEPTOS y los ARQUETIPOS salen de cinco materiales reales que pasó
--   Jorge el 16/09 (ficha del IES Val Miñor vía edu.xunta.gal, ficha del CEIP
--   Ntra. Sra. de las Maravillas de Murcia, cuadernillo del IES Oja, y el
--   capítulo 4 de Marea Verde), cruzados con los saberes básicos oficiales.
--   Los materiales son referencia de NIVEL Y ESTILO: no se copia ni se
--   parafrasea ni un enunciado.
--
--   Los ERRORES los pasó Jorge, y no todos valen lo mismo. Nueve los ha
--   confirmado él como los que ve en clase; cuatro son hipótesis de una lista
--   que le generó otro modelo y que él no confirmó; dos no son errores de
--   enteros sino las clases residuales. Esa diferencia se guarda en la columna
--   `evidencia` que se añade aquí, y no es burocracia: dentro de seis meses
--   nadie se acordará de cuál era cuál, y no es lo mismo reexplicar un concepto
--   porque un profesor ha visto fallar a treinta alumnos que porque una lista
--   lo decía.
--
--   Los SABERES son los de verdad, del anexo oficial de Matemáticas de la
--   ORDEN ECD/1172/2022 de Aragón (`[02.26] Matemáticas.pdf`, sección
--   `III.2.1. Matemáticas 1º de ESO`), que Jorge descargó el 17/09. La notación
--   real es `A.2.`, `A.3.` — dentro de cada sentido y sin numerar las viñetas.
--   Los códigos `MAT.1.A.2.3` que aparecían en el comentario de la hoja de
--   muestra NO EXISTEN: eran el bloque real más un número inventado y un
--   prefijo que Aragón no usa. Se corrigen en el commit siguiente.

-- ── DOS COLUMNAS QUE ESTE CONTENIDO NECESITA ─────────────────────────────

-- POR QUÉ EL SABER VA EN EL CONCEPTO Y NO SOLO EN EL TEMA. `contenido_temas`
-- ya tiene `saberes` (el tema de enteros toca A.2, A.3 y A.6). Pero una hoja no
-- cubre el tema entero: la de "sumar y restar enteros" solo toca A.3. Si la
-- hoja heredara los saberes del tema, diría que cubre A.2 y A.6 sin tocarlos —
-- una exageración pequeña, del tipo que se descubre justo cuando un jefe de
-- estudios lo comprueba. Con el saber en el concepto, los saberes de una hoja
-- son la unión de los de sus conceptos, y eso sí es verdad.
alter table public.contenido_conceptos
  add column if not exists saber text;

comment on column public.contenido_conceptos.saber is
  'Saber básico oficial al que corresponde este concepto, en la notación real del anexo autonómico (p. ej. "A.3" = Sentido de las operaciones en la ORDEN ECD/1172/2022 de Aragón). NULL = todavía sin contrastar. Los saberes de una hoja son la unión de los de sus conceptos, nunca los del tema entero.';

-- `evidencia`: CÓMO DE FUNDADO ESTÁ CADA ERROR.
--   observado   — un profesor lo ha visto fallar en sus alumnos.
--   hipotesis   — sale de una lista o de la bibliografía, sin confirmar en aula.
--   estructural — no es una creencia equivocada sino una clase residual (el
--                 cálculo mal hecho, el despiste). No se confirma ni se refuta:
--                 existe por construcción.
-- Un error `hipotesis` no debería disparar las mismas acciones que uno
-- `observado` hasta que alguien lo confirme.
alter table public.contenido_errores_tipo
  add column if not exists evidencia text not null default 'hipotesis'
    check (evidencia in ('observado', 'hipotesis', 'estructural'));

comment on column public.contenido_errores_tipo.evidencia is
  'Cómo de fundado está el error: observado (un profesor lo ha visto en sus alumnos), hipotesis (de una lista o de la bibliografía, sin confirmar), estructural (clase residual: cálculo o despiste, existe por construcción). Un error hipotesis no debe disparar las mismas acciones que uno observado.';

-- ── QUE NO SE PUEDA DUPLICAR EL CATÁLOGO ─────────────────────────────────
-- Hasta ahora nada impedía meter dos veces el concepto "Valor absoluto" en el
-- mismo tema. Con una pantalla de administración eso pasa el primer día, y un
-- concepto duplicado parte en dos los intentos de un alumno: la mitad del
-- historial apunta a un concepto y la mitad al otro, y el dominio calculado
-- sale mal sin que nada avise.
--
-- `NULLS NOT DISTINCT` otra vez, y por el mismo motivo que en la 119: el
-- `tenant_id` del catálogo común es NULL, y con el UNIQUE normal dos NULL no se
-- consideran iguales, así que la restricción no protegería justo las filas
-- comunes, que son todas las de esta migración. Requiere PostgreSQL 15+;
-- producción va por 17.6.
alter table public.contenido_temas
  drop constraint if exists contenido_temas_unico;
alter table public.contenido_temas
  add constraint contenido_temas_unico
  unique nulls not distinct (tenant_id, comunidad, materia, curso, nombre);

alter table public.contenido_conceptos
  drop constraint if exists contenido_conceptos_unico;
alter table public.contenido_conceptos
  add constraint contenido_conceptos_unico
  unique nulls not distinct (tenant_id, tema_id, nombre);

alter table public.contenido_errores_tipo
  drop constraint if exists contenido_errores_tipo_unico;
alter table public.contenido_errores_tipo
  add constraint contenido_errores_tipo_unico
  unique nulls not distinct (tenant_id, concepto_id, nombre);

alter table public.contenido_arquetipos
  drop constraint if exists contenido_arquetipos_unico;
alter table public.contenido_arquetipos
  add constraint contenido_arquetipos_unico
  unique nulls not distinct (tenant_id, concepto_id, nombre);

-- ── LA SEMILLA ───────────────────────────────────────────────────────────
-- IDENTIFICADORES FIJOS, y no `gen_random_uuid()`, para que esta migración se
-- pueda ejecutar dos veces sin duplicar nada (`on conflict (id) do nothing`) y
-- para que se lea de un vistazo a qué concepto pertenece cada fila:
--   c0…001  el tema          c2…NN  los errores
--   c1…NN   los conceptos    c3…NN  los arquetipos

-- SOLO A.2 Y A.3, Y NO A.6, aunque haya problemas de deudas y balances. A.6 es
-- "interpretación de información numérica en contextos financieros", y lo que
-- hace el alumno en esos problemas es OPERAR con enteros en un contexto de
-- dinero — el saber que practica es A.3 y el dinero es el decorado. Reclamar
-- A.6 dejaría un saber en el tema que ningún concepto de dentro cubre, que es
-- justo el tipo de afirmación que no se puede defender cuando alguien la
-- comprueba. Si algún día queremos A.6 de verdad, hará falta un concepto propio
-- de interpretar información financiera, y no es de este tema.
insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000001', null, 'Matemáticas', '1.º ESO',
   'Números enteros', 'aragon', array['A.2', 'A.3'], 4)
on conflict (id) do nothing;

-- Los 12 conceptos. `orden` va de lo definicional a lo operativo, que es como
-- lo presentan los cinco materiales — pero NO es el orden del currículo, que no
-- fija ninguno.
insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000001', null, 'c0000000-0000-4000-8000-000000000001',
   'Situaciones que piden un número con signo',
   'Traducir un enunciado de la vida real a un número con signo: plantas de sótano, grados bajo cero, deudas, altitudes, fechas antes de Cristo. Es saber LEER el signo, distinto de saber qué es un entero.',
   'A.2', false, 1),
  ('c1000000-0000-4000-8000-000000000002', null, 'c0000000-0000-4000-8000-000000000001',
   'El conjunto Z: positivos, negativos y el cero',
   'Qué es un número entero, que +3 se escribe 3, y que el cero no es ni positivo ni negativo.',
   'A.2', false, 2),
  ('c1000000-0000-4000-8000-000000000003', null, 'c0000000-0000-4000-8000-000000000001',
   'Valor absoluto',
   'La distancia al cero. Siempre positivo o cero.',
   'A.2', false, 3),
  ('c1000000-0000-4000-8000-000000000004', null, 'c0000000-0000-4000-8000-000000000001',
   'Opuesto de un entero',
   'Mismo valor absoluto y signo contrario. op(-a) = +a.',
   'A.2', false, 4),
  ('c1000000-0000-4000-8000-000000000005', null, 'c0000000-0000-4000-8000-000000000001',
   'Orden y comparación de enteros',
   'Entre dos negativos es mayor el de MENOR valor absoluto. El saber A.4 nombra la comparación solo de fracciones, decimales y porcentajes, así que el orden de enteros se sostiene en A.2 (formas de representación).',
   'A.2', false, 5),
  ('c1000000-0000-4000-8000-000000000006', null, 'c0000000-0000-4000-8000-000000000001',
   'Representación en la recta numérica',
   'A.2 lo nombra expresamente: "Diferentes formas de representación de números enteros, fraccionarios y decimales, INCLUIDA LA RECTA NUMÉRICA". Es contenido obligatorio y no se puede generar sin dibujo: queda fuera de la generación automática hasta que existan los renderizadores SVG propios.',
   'A.2', true, 6),
  ('c1000000-0000-4000-8000-000000000007', null, 'c0000000-0000-4000-8000-000000000001',
   'Suma de enteros del mismo y de distinto signo',
   'Mismo signo: se suman los valores absolutos y se mantiene el signo. Distinto signo: se restan y se pone el signo del de mayor valor absoluto.',
   'A.3', false, 7),
  ('c1000000-0000-4000-8000-000000000008', null, 'c0000000-0000-4000-8000-000000000001',
   'Resta como suma del opuesto',
   'a - b = a + (-b). Y su consecuencia, que A.3 pide entender como "efecto de las operaciones": restar un negativo AUMENTA el resultado.',
   'A.3', false, 8),
  ('c1000000-0000-4000-8000-000000000009', null, 'c0000000-0000-4000-8000-000000000001',
   'Eliminación de paréntesis y signos',
   'Los cuatro casos: +(+a), +(-a), -(+a), -(-a). Y que un menos delante de un paréntesis cambia TODOS los signos de dentro. Los cuatro materiales le dedican sección propia y es donde se concentra la mitad de los errores.',
   'A.3', false, 9),
  ('c1000000-0000-4000-8000-000000000010', null, 'c0000000-0000-4000-8000-000000000001',
   'Producto y cociente: la regla de los signos',
   'Mismo signo da positivo, distinto signo da negativo. En producto y en división igual.',
   'A.3', false, 10),
  ('c1000000-0000-4000-8000-000000000011', null, 'c0000000-0000-4000-8000-000000000001',
   'Potencias de base entera',
   'Base negativa con exponente par da positivo; con exponente impar, negativo. Está cubierto por A.3, que nombra la POTENCIACIÓN entre las propiedades de las operaciones "con números naturales, enteros, fraccionarios y decimales". El tema "Potencias y raíces" es otro tema distinto, con los naturales.',
   'A.3', false, 11),
  ('c1000000-0000-4000-8000-000000000012', null, 'c0000000-0000-4000-8000-000000000001',
   'Jerarquía de operaciones con enteros',
   'Paréntesis, luego multiplicaciones y divisiones de izquierda a derecha, luego sumas y restas. OJO: ningún saber básico de 1.º ESO nombra la jerarquía. Lo más cercano es "cálculos de manera eficiente" de A.3, así que el saber va asignado como IMPLÍCITO: se enseña en los cinco materiales y en todos los libros, pero no se puede citar un texto literal del currículo.',
   'A.3', false, 12)
on conflict (id) do nothing;

-- ── LOS 15 ERRORES TÍPICOS ───────────────────────────────────────────────
-- Nueve confirmados por Jorge, cuatro hipótesis, dos estructurales.
--
-- EL ORDEN IMPORTA POCO PERO EL PRIMERO SÍ: "confundir el signo del número con
-- el signo de la operación" es la raíz de la mitad de los demás. El signo menos
-- significa dos cosas distintas y en 8 - (-5) aparecen las dos a la vez.
insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000001', null, 'c1000000-0000-4000-8000-000000000008',
   'Confundir el signo del número con el signo de la operación',
   'El signo menos indica que un número es negativo o que se está restando, y en una resta de un negativo aparecen las dos cosas a la vez. El alumno solo ve una.',
   'conceptual', true, 'observado', '8 - (-5) = 8 - 5 = 3', '8 - (-5) = 8 + 5 = 13', 1),
  ('c2000000-0000-4000-8000-000000000002', null, 'c1000000-0000-4000-8000-000000000007',
   'Sumar los valores absolutos cuando los signos son distintos',
   'Con signos diferentes hay que RESTAR los valores absolutos, no sumarlos.',
   'conceptual', true, 'observado', '-8 + 5 = -13', '-8 + 5 = -3', 2),
  ('c2000000-0000-4000-8000-000000000003', null, 'c1000000-0000-4000-8000-000000000007',
   'Elegir mal el signo cuando los signos son distintos',
   'La resta de valores absolutos está bien hecha pero el signo del resultado es el equivocado. Es un error de signo, no conceptual: el procedimiento lo tiene.',
   'signo', true, 'observado', '-9 + 4 = +5', '-9 + 4 = -5', 3),
  ('c2000000-0000-4000-8000-000000000004', null, 'c1000000-0000-4000-8000-000000000005',
   'Ordenar los negativos por su valor absoluto',
   'Aplicar a los negativos el orden de los naturales: "-8 es mayor porque 8 es mayor que 3".',
   'conceptual', true, 'observado', '-8 > -3', '-8 < -3', 4),
  ('c2000000-0000-4000-8000-000000000005', null, 'c1000000-0000-4000-8000-000000000010',
   'Confundir la regla de los signos en producto y cociente',
   'Menos por menos da MÁS, y lo mismo en la división. El alumno la aplica al revés.',
   'procedimiento', true, 'observado', '(-4) . (-3) = -12', '(-4) . (-3) = +12', 5),
  ('c2000000-0000-4000-8000-000000000006', null, 'c1000000-0000-4000-8000-000000000008',
   'Pensar que restar siempre hace el resultado menor',
   'Con enteros, restar un negativo aumenta el resultado. Es el "efecto de las operaciones" que A.3 pide entender expresamente.',
   'conceptual', true, 'observado', '5 - (-3) = 2', '5 - (-3) = 8', 6),
  ('c2000000-0000-4000-8000-000000000007', null, 'c1000000-0000-4000-8000-000000000009',
   'No cambiar el signo al quitar un paréntesis precedido de una resta',
   'Cambia solo el primer término de dentro del paréntesis, o ninguno, cuando hay que cambiar todos.',
   'procedimiento', true, 'observado', '8 - (-3 + 5) = 8 - 3 + 5', '8 - (-3 + 5) = 8 + 3 - 5', 7),
  ('c2000000-0000-4000-8000-000000000008', null, 'c1000000-0000-4000-8000-000000000012',
   'Operar de izquierda a derecha sin respetar la jerarquía',
   'Hace las operaciones en el orden en que aparecen escritas.',
   'jerarquia', true, 'observado', '3 + 4 . (-2) = 7 . (-2) = -14', '3 + 4 . (-2) = 3 + (-8) = -5', 8),
  ('c2000000-0000-4000-8000-000000000009', null, 'c1000000-0000-4000-8000-000000000001',
   'Confundir "más negativo" con "más positivo" al traducir un enunciado',
   'Sabe calcular, pero "baja 5 grados" o "pierde 5 puntos" lo traduce con el signo contrario. No es un fallo de cálculo, es de interpretación del contexto.',
   'interpretacion', true, 'observado',
   'Si 2 ºC baja 5 ºC: 2 + 5 = 7', 'Si 2 ºC baja 5 ºC: 2 + (-5) = -3', 9),
  -- ── Hipótesis: de la lista, sin confirmar en aula ──
  -- Esta se mantiene EN CONTRA de la selección de Jorge, y a propósito: no es
  -- la misma que la primera. En -7 + (-2), quien no ve el signo del número
  -- escribe -5; quien aplica "menos y menos es más" escribe +9. Son respuestas
  -- distintas, así que son errores distintos y el diagnóstico los separa.
  ('c2000000-0000-4000-8000-000000000010', null, 'c1000000-0000-4000-8000-000000000007',
   'Aplicar la regla de los signos a la suma',
   'Trae la regla del producto a una suma: "menos y menos es más". No es un despiste — el alumno cree que está aplicando una regla que le han enseñado, y por eso no se corrige repitiendo ejercicios sino poniendo las dos reglas una al lado de la otra.',
   'conceptual', true, 'hipotesis', '-7 + (-2) = +9', '-7 + (-2) = -9', 10),
  ('c2000000-0000-4000-8000-000000000011', null, 'c1000000-0000-4000-8000-000000000003',
   'Confundir el valor absoluto con el valor del número',
   'No quita el signo, o cree que el valor absoluto puede ser negativo.',
   'conceptual', true, 'hipotesis', '|-7| = -7', '|-7| = 7', 11),
  ('c2000000-0000-4000-8000-000000000012', null, 'c1000000-0000-4000-8000-000000000004',
   'Confundir el opuesto con el propio número o con el valor absoluto',
   'Deja el opuesto de un negativo como negativo, o responde el valor absoluto.',
   'conceptual', true, 'hipotesis', 'El opuesto de -6 es -6', 'El opuesto de -6 es +6', 12),
  ('c2000000-0000-4000-8000-000000000013', null, 'c1000000-0000-4000-8000-000000000002',
   'Creer que el cero es positivo o negativo',
   'También aparece como creer que -0 y +0 son números distintos.',
   'conceptual', true, 'hipotesis', 'El 0 es positivo; -0 no es lo mismo que +0',
   'El 0 no es ni positivo ni negativo, y -0 = 0 = +0', 13),
  -- ── Estructurales: las dos clases residuales ──
  -- No son creencias equivocadas y no se pueden predecir: son el cajón de "la
  -- respuesta está mal y no coincide con ninguno de los errores conocidos".
  -- Tienen que existir para que el diagnóstico no fuerce una explicación.
  ('c2000000-0000-4000-8000-000000000014', null, 'c1000000-0000-4000-8000-000000000007',
   'Signos bien, cálculo mal',
   'Aplica bien la regla y se equivoca en la aritmética. NO es un error de enteros: es de cálculo con naturales, y reexplicar los enteros aquí no arregla nada.',
   'operacion', false, 'estructural', '-8 + 13 = 6', '-8 + 13 = 5', 14),
  ('c2000000-0000-4000-8000-000000000015', null, 'c1000000-0000-4000-8000-000000000007',
   'Descuido: pierde un signo al copiar',
   'Sabe hacerlo y normalmente lo hace bien. No debe generar ninguna acción: reexplicar la teoría a quien ha tenido un despiste es la forma más rápida de que deje de leer al tutor.',
   'descuido', false, 'estructural', '-7 + (-4) = -7 + 4 = -3', '-7 + (-4) = -11', 15)
on conflict (id) do nothing;

-- ── LOS 34 ARQUETIPOS ────────────────────────────────────────────────────
-- El arquetipo es el TIPO de pregunta, no el ejercicio. La IA genera
-- instancias; no se inventa el tipo, que es donde se va de madre.
--
-- La dificultad no es a ojo: 1 = aplicar la definición directamente,
-- 2 = combinar dos pasos o invertir la operación, 3 = anidado, o hay que
-- razonar antes de calcular. `ejemplo` lleva un caso real de nuestro nivel,
-- porque la dificultad etiquetada "a ojo" por un modelo es un desastre y se
-- corrige enseñándole cómo es un refuerzo NUESTRO.
insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  -- Definiciones
  ('c3000000-0000-4000-8000-000000000001', null, 'c1000000-0000-4000-8000-000000000001',
   'Asocia un entero a cada enunciado cotidiano',
   'Lista de 6 a 8 situaciones de la vida diaria, cada una con su hueco. Mezcla contextos: dinero, temperatura, plantas de un edificio, altitud, fechas. Al menos dos deben ser positivas para que no se conteste todo con negativos.',
   'El termómetro marca tres grados bajo cero ___ / Tengo el coche en el segundo sótano ___',
   'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000002', null, 'c1000000-0000-4000-8000-000000000003',
   'Calcula el valor absoluto',
   'Lista de 6 a 8 valores absolutos, mezclando positivos y negativos, con algún número de dos o tres cifras. Incluye |0| en algún apartado.',
   '|-15| = ___ / |0| = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000003', null, 'c1000000-0000-4000-8000-000000000004',
   'Escribe el opuesto',
   'Lista de 6 a 8, mezclando positivos y negativos. Incluye el 0 en alguno.',
   'El opuesto de -8 es ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000004', null, 'c1000000-0000-4000-8000-000000000004',
   'Expresiones encadenadas de opuesto y valor absoluto',
   'Enunciados en palabras que encadenan las dos definiciones, para que haya que aplicarlas en orden. De 4 a 6 apartados. No uses más de dos encadenamientos por apartado.',
   'El opuesto del valor absoluto de -4 / El opuesto del opuesto de -2',
   'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000005', null, 'c1000000-0000-4000-8000-000000000002',
   'Verdadero o falso sobre las definiciones, justificando con un ejemplo',
   'De 2 a 4 afirmaciones sobre qué es un entero, el cero, el opuesto o el valor absoluto. Que al menos una sea verdadera: una batería donde todas son falsas se contesta por patrón. Pide siempre justificar con un ejemplo, no solo marcar.',
   '"-(-a) es siempre positivo." Verdadero o falso. Justifica con un ejemplo.',
   'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000006', null, 'c1000000-0000-4000-8000-000000000005',
   'Completa con el signo > o <',
   'De 6 a 8 parejas. Al menos la mitad deben ser dos negativos, que es donde está el error; incluye alguna pareja con el 0.',
   '-3 ___ -8 / 0 ___ -5', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000007', null, 'c1000000-0000-4000-8000-000000000005',
   'Ordena una lista de menor a mayor',
   'Una lista de 6 a 10 enteros mezclando signos y magnitudes, con al menos dos negativos de dos o tres cifras para que no valga ordenar "a ojo".',
   '-18, 45, -9, 35, -56, 118, -219', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000008', null, 'c1000000-0000-4000-8000-000000000005',
   'Series numéricas: escribe los tres términos siguientes',
   'De 4 a 5 series que cruzan el cero hacia los negativos. La regla debe ser de paso constante o de diferencia creciente sencilla — nada que requiera adivinar. Cubre el saber A.4, "patrones y regularidades numéricas".',
   '6, 4, 2, 0, -2, ___, ___, ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000009', null, 'c1000000-0000-4000-8000-000000000006',
   'Representa estos números en la recta numérica',
   'FUERA DE LA GENERACIÓN AUTOMÁTICA de momento: necesita dibujar la recta y un modelo no lo hace de forma fiable. Cuando existan los renderizadores SVG propios, la IA solo aportará {de, a, marcar:[...]} y el dibujo lo hará nuestro código.',
   'Representa sobre una recta: 2, -3, 5, -4, -7', 'ejercicio', 1, true, 'activo'),
  -- Sumas y restas
  ('c3000000-0000-4000-8000-000000000010', null, 'c1000000-0000-4000-8000-000000000007',
   'Suma dos enteros del mismo signo',
   'De 6 a 9 apartados. Mezcla las dos escrituras: con paréntesis explícito y sin él.',
   '-6 + (-1) = ___ / -4 - 6 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000011', null, 'c1000000-0000-4000-8000-000000000007',
   'Suma dos enteros de distinto signo',
   'De 6 a 9 apartados. Reparte a mitades cuál de los dos tiene mayor valor absoluto, para que el signo del resultado no sea siempre el mismo.',
   '-12 + 5 = ___ / 3 + (-6) = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000012', null, 'c1000000-0000-4000-8000-000000000008',
   'Resta dos enteros escritos con paréntesis',
   'De 6 a 8 apartados cubriendo los cuatro casos de signos: (+)-(+), (+)-(-), (-)-(+), (-)-(-). Es la batería que aísla el error de no ver el signo del número.',
   '(-19) - (-21) = ___ / (+40) - (-15) = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000013', null, 'c1000000-0000-4000-8000-000000000007',
   'Cadena de sumas y restas sin paréntesis',
   'De 4 a 7 términos, sin paréntesis, con el resultado siempre entero de una o dos cifras. De 3 a 4 apartados.',
   '-6 + 7 - 4 - 2 + 1 - 9 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000014', null, 'c1000000-0000-4000-8000-000000000007',
   'La misma cadena resuelta por los dos métodos',
   'Pide resolver la misma expresión paso a paso Y agrupando positivos y negativos, en dos columnas. Es el arquetipo del cuadernillo del IES Oja y no es repetición: hace visible que el resultado no depende del camino.',
   '2 - 4 - 5 + 8: paso a paso ___ / agrupando ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000015', null, 'c1000000-0000-4000-8000-000000000007',
   'Halla el término que falta',
   'De 4 a 6 igualdades con un hueco en uno de los sumandos. Cubre el saber A.3, "relaciones inversas entre las operaciones", que el currículo pide expresamente. Varía la posición del hueco: no siempre el segundo término.',
   '6 + ___ = 3 / ___ + (-5) = -7', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000016', null, 'c1000000-0000-4000-8000-000000000009',
   'Elimina los paréntesis y calcula',
   'Un solo nivel de paréntesis, de 3 a 4 apartados. Al menos dos con un signo menos delante del paréntesis, que es lo que se está practicando.',
   '-7 - (8 - 10) = ___ / -(-3 + 10) + 7 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000017', null, 'c1000000-0000-4000-8000-000000000009',
   'Calcula con corchetes anidados',
   'Paréntesis dentro de corchetes, de 2 a 4 apartados. Máximo dos niveles: con tres la hoja se convierte en un examen de paciencia.',
   '6 - (5 - 3) - [7 - (-1 - 4)] = ___', 'ejercicio', 3, false, 'activo'),
  -- Producto, cociente y potencias
  ('c3000000-0000-4000-8000-000000000018', null, 'c1000000-0000-4000-8000-000000000010',
   'Multiplica dos enteros',
   'De 6 a 8 apartados cubriendo las cuatro combinaciones de signos. Productos de la tabla de multiplicar, sin números grandes: lo que se practica es el signo, no la multiplicación.',
   '(-3) . 5 = ___ / (-2) . (-3) = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000019', null, 'c1000000-0000-4000-8000-000000000010',
   'Divide dos enteros',
   'De 6 a 8 apartados con las cuatro combinaciones de signos. La división debe ser SIEMPRE exacta: un cociente decimal convierte el ejercicio en otro tema.',
   '-35 : (-5) = ___ / 8 : (-2) = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000020', null, 'c1000000-0000-4000-8000-000000000010',
   'Cadena de productos y cocientes donde importa el orden',
   'De 3 a 4 apartados con tres o cuatro factores, incluyendo alguno donde el paréntesis cambia el resultado respecto a operar de izquierda a derecha. Todas las divisiones exactas.',
   '-18 : (-3) . (-2) = ___ / -18 : [(-3) . (-2)] = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000021', null, 'c1000000-0000-4000-8000-000000000010',
   'Halla el factor que falta',
   'De 4 a 6 igualdades con un hueco en un factor o en el divisor. Cubre "relaciones inversas" de A.3 por el lado del producto.',
   '___ . (-4) = 12 / -36 : ___ = 9', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000022', null, 'c1000000-0000-4000-8000-000000000011',
   'Calcula potencias de base entera',
   'De 5 a 8 apartados. Incluye siempre al menos una base negativa con exponente par y otra con impar, y alguna potencia de -1 y de +1 con exponente grande, que es donde se ve si ha entendido la regla o la está calculando.',
   '(-3)^2 = ___ / (-2)^3 = ___ / (-1)^2375 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000023', null, 'c1000000-0000-4000-8000-000000000011',
   'Distingue (-3)^2 de -3^2, justificando',
   'Dos o tres parejas de expresiones que solo se diferencian en el paréntesis, pidiendo el resultado de cada una y por qué son distintas. Es razonamiento, no cálculo.',
   'Calcula (-3)^2 y -3^2. ¿Por qué no dan lo mismo?', 'ejercicio', 3, false, 'activo'),
  -- Jerarquía
  ('c3000000-0000-4000-8000-000000000024', null, 'c1000000-0000-4000-8000-000000000012',
   'Operación combinada de un nivel',
   'De 3 a 4 apartados que mezclen sumas o restas con un producto o un cociente, sin paréntesis. El objetivo es que el orden importe: si da lo mismo operar de izquierda a derecha, el ejercicio no sirve.',
   '4 + 5 - 6 . 2 + 7 - 10 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000025', null, 'c1000000-0000-4000-8000-000000000012',
   'Subraya la operación que tiene preferencia y calcula',
   'De 4 a 6 expresiones en las que primero hay que señalar qué se opera antes y luego resolver. Hace explícito el proceso en vez de solo el resultado, y por eso distingue al que sabe la regla del que acierta por suerte.',
   '2 - (7 - 5) . 4 = ___ / 17 - 5 . 3 + 6 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000026', null, 'c1000000-0000-4000-8000-000000000012',
   'Operación combinada con paréntesis y corchetes',
   'De 2 a 4 apartados con dos niveles y las cuatro operaciones. Todas las divisiones exactas y el resultado entero.',
   '2 . [8 - 4 . (10 - 6) - (-3 - 2)] = ___', 'ejercicio', 3, false, 'activo'),
  -- Razonamiento sobre el efecto de las operaciones (saber A.3)
  ('c3000000-0000-4000-8000-000000000027', null, 'c1000000-0000-4000-8000-000000000008',
   'Verdadero o falso sobre el efecto de las operaciones',
   'De 2 a 3 afirmaciones sobre qué le hace una operación al resultado ("restar lo hace más pequeño", "multiplicar lo hace más grande"), pidiendo un contraejemplo. Cubre el saber A.3, "efecto de las operaciones aritméticas con números enteros", y ataca de frente el error de que restar siempre disminuye.',
   '"Si a un número le restas otro, el resultado siempre es más pequeño." ¿Verdadero o falso? Pon un ejemplo.',
   'ejercicio', 2, false, 'activo'),
  -- Problemas
  ('c3000000-0000-4000-8000-000000000028', null, 'c1000000-0000-4000-8000-000000000001',
   'Ascensor: subir y bajar desde un sótano',
   'Dos o tres movimientos encadenados partiendo de una planta de sótano, preguntando la planta final. Que en algún momento se pase por encima y por debajo del cero.',
   'Estaba en el sótano 5 y el ascensor ha subido 7 plantas. ¿En qué planta estoy? Si ahora bajo 8, ¿dónde estoy?',
   'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000029', null, 'c1000000-0000-4000-8000-000000000001',
   'Termómetro: variaciones sucesivas a lo largo de un día',
   'Una temperatura inicial bajo cero y tres o cuatro subidas y bajadas, preguntando la final. Los enunciados deben decir "subió" y "bajó", nunca el signo, para que haya que traducirlo.',
   'Amaneció a dos grados bajo cero. A mediodía había subido 8 grados, por la tarde 3 más, y de noche bajó 5.',
   'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000030', null, 'c1000000-0000-4000-8000-000000000008',
   'Diferencia de temperatura entre dos sitios',
   'Dos temperaturas, una de ellas bajo cero, preguntando la diferencia. Es la resta de un negativo escondida en un contexto: el alumno tiene que darse cuenta de que hay que restar.',
   'En la nave hace 12 ºC y en la cámara frigorífica 15 ºC bajo cero. ¿Cuál es la diferencia?',
   'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000031', null, 'c1000000-0000-4000-8000-000000000001',
   'Deuda y ahorro: balance de dinero',
   'Una deuda, un ingreso y uno o dos gastos, preguntando cuánto queda. El dinero es el contexto: el saber que se practica es la operación con enteros (A.3), no la educación financiera. Cantidades de dos o tres cifras y resultado entero en euros.',
   'Debe 75 EUR del ordenador. Ha ahorrado 127 EUR y paga. Luego se compra un CD de 13 EUR. ¿Cuánto le queda?',
   'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000032', null, 'c1000000-0000-4000-8000-000000000008',
   'Fechas antes de Cristo: cuántos años vivió',
   'REGLA OBLIGATORIA: las DOS fechas han de ser antes de Cristo. Nunca cruces de a.C. a d.C., porque el año 0 no existe y la cuenta lleva un año menos — un modelo suma las dos cifras y falla casi siempre. Con las dos fechas a.C. la resta es directa y no hay trampa. Es el arquetipo donde se ve si el alumno ha entendido la resta de enteros o la ha copiado.',
   'Arquímedes nació el año -287 y murió el año -212. Ana dice que hay que hacer 287-212 y Bruno que -212-(-287). ¿Quién lo plantea bien? ¿Por qué dan lo mismo?',
   'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000033', null, 'c1000000-0000-4000-8000-000000000010',
   'Balance anual de un negocio',
   'Varios periodos con pérdidas o ganancias mensuales, preguntando el balance del año. Obliga a multiplicar un negativo por el número de meses y luego sumar. Cantidades redondas para que la cuenta no tape el razonamiento.',
   'Enero-mayo: pérdidas de 2.475 EUR al mes. Junio-agosto: ganancias de 8.230 EUR al mes. ¿Cuál fue el balance del año?',
   'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000034', null, 'c1000000-0000-4000-8000-000000000001',
   'Altitud y profundidad: distancia entre dos niveles',
   'Un objeto por encima y otro por debajo del nivel del mar, preguntando la distancia que los separa. La resta de un negativo, otra vez, en un contexto distinto al del termómetro.',
   'Un avión vuela a 4.000 m y un submarino está a 60 m bajo el nivel del mar. ¿Qué distancia los separa?',
   'problema', 2, false, 'activo')
on conflict (id) do nothing;
