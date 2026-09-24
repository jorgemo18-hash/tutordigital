-- 135_semilla_divisibilidad_1eso.sql
-- EL SEGUNDO TEMA DEL CATÁLOGO: Divisibilidad, 1.º ESO de Matemáticas.
-- 1 tema, 8 conceptos, 11 errores típicos, 17 arquetipos y 6 objetivos.
--
-- Solo DATOS: no toca el esquema. Todo entra como CATÁLOGO COMÚN
-- (`tenant_id` NULL), igual que Números enteros (migraciones 120 y 123). Se
-- puede ejecutar dos veces: identificadores fijos y `on conflict do nothing`.
--
-- DE DÓNDE SALE CADA COSA, porque no todo tiene el mismo respaldo:
--
--   El SABER es el de verdad: A.4 «Relaciones» del anexo de Matemáticas de
--   1.º ESO de Aragón (ORDEN ECD/1172/2022), cuya primera viñeta dice
--   literalmente «Factores, múltiplos y divisores. Factorización en números
--   primos para resolver problemas: estrategias y herramientas». Los ocho
--   conceptos caen ahí, y ninguno en otro saber.
--
--   Los CONCEPTOS y los ARQUETIPOS siguen el reparto habitual del tema en los
--   materiales de 1.º ESO (múltiplos y divisores, criterios, primos,
--   descomposición, m.c.d. y m.c.m., problemas). Los criterios son los de
--   2, 3, 5 y 10: el 9 y el 11 salen en unos libros y en otros no.
--
--   Los ERRORES son TODOS `hipotesis`. A diferencia de los de enteros, que
--   Jorge confirmó como los que ve en clase, estos salen de la bibliografía y
--   de lo que se repite en los materiales: nadie los ha visto todavía en
--   nuestros alumnos. La columna `evidencia` lo dice para que no disparen las
--   mismas acciones que un error observado hasta que alguien los confirme.
--
--   Cada arquetipo tiene su generador en
--   server/lib/generadorEjercicios/generadores/divisibilidad/, y un test
--   (catalogoDeBaterias.test.mjs) comprueba que el nombre de cada uno está
--   aquí LITERAL y con su concepto.
--
-- IDENTIFICADORES, con la misma forma que los de enteros y el tema en la
-- tercera cifra por la cola (…0002NN):
--   c0…002    el tema            c2…002NN  los errores
--   c1…002NN  los conceptos      c3…002NN  los arquetipos
--                                c4…002NN  los objetivos

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000002', null, 'Matemáticas', '1.º ESO',
   'Divisibilidad', 'aragon', array['A.4'], 3)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000201', null, 'c0000000-0000-4000-8000-000000000002',
   'Múltiplos de un número',
   'Los que se obtienen multiplicando el número por 1, 2, 3… Una serie que va de n en n. Hay infinitos.',
   'A.4', false, 1),
  ('c1000000-0000-4000-8000-000000000202', null, 'c0000000-0000-4000-8000-000000000002',
   'Divisores de un número',
   'Los que lo dividen de forma exacta. Siempre están el 1 y el propio número, y se encuentran por parejas. La relación es la inversa de la de múltiplo: si a es múltiplo de b, b es divisor de a.',
   'A.4', false, 2),
  ('c1000000-0000-4000-8000-000000000203', null, 'c0000000-0000-4000-8000-000000000002',
   'Criterios de divisibilidad por 2, 3, 5 y 10',
   'Saber si un número es divisible sin dividir: por 2, 5 y 10 se mira la última cifra; por 3, la suma de todas las cifras.',
   'A.4', false, 3),
  ('c1000000-0000-4000-8000-000000000204', null, 'c0000000-0000-4000-8000-000000000002',
   'Números primos y compuestos',
   'Primo: solo tiene dos divisores, el 1 y él mismo. Compuesto: tiene más. El 1 no es ni una cosa ni otra.',
   'A.4', false, 4),
  ('c1000000-0000-4000-8000-000000000205', null, 'c0000000-0000-4000-8000-000000000002',
   'Descomposición en factores primos',
   'Escribir un número como producto de primos, con potencias para los repetidos, dividiendo por el primo más pequeño posible hasta llegar a 1.',
   'A.4', false, 5),
  ('c1000000-0000-4000-8000-000000000206', null, 'c0000000-0000-4000-8000-000000000002',
   'Máximo común divisor',
   'El mayor divisor que tienen en común dos o más números. Por descomposición: los factores comunes con el menor exponente.',
   'A.4', false, 6),
  ('c1000000-0000-4000-8000-000000000207', null, 'c0000000-0000-4000-8000-000000000002',
   'Mínimo común múltiplo',
   'El menor múltiplo, distinto de cero, que tienen en común dos o más números. Por descomposición: los factores comunes y no comunes con el mayor exponente.',
   'A.4', false, 7),
  ('c1000000-0000-4000-8000-000000000208', null, 'c0000000-0000-4000-8000-000000000002',
   'Problemas de m.c.d. y m.c.m.',
   'Reconocer en un enunciado cuál de los dos hace falta: coincidir otra vez o repartir en múltiplos comunes (m.c.m.); partir en trozos o grupos iguales lo más grandes posible (m.c.d.).',
   'A.4', false, 8)
on conflict (id) do nothing;

-- ── LOS 11 ERRORES TÍPICOS ───────────────────────────────────────────────
-- Todos hipótesis (ver arriba). Los ocho primeros son PREDECIBLES: dan una
-- respuesta que se puede calcular antes de que el alumno la escriba, y el
-- generador la guarda como respuesta-trampa (errores/trampasDivisibilidad.js).
-- El 9 no: un factor no primo puede quedarse de muchas maneras. Los dos
-- últimos son las clases residuales, como en enteros.
insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000201', null, 'c1000000-0000-4000-8000-000000000202',
   'Confundir múltiplo y divisor',
   'Contesta a la pregunta al revés: lee "a es múltiplo de b" como "a es divisor de b". Las dos palabras describen la misma división desde lados opuestos.',
   'conceptual', true, 'hipotesis', '¿Es 7 divisor de 63? No, 7 no se puede dividir entre 63.', '¿Es 7 divisor de 63? Sí: 63 : 7 = 9, exacta.', 1),
  ('c2000000-0000-4000-8000-000000000202', null, 'c1000000-0000-4000-8000-000000000202',
   'Olvidar el 1 y el propio número entre los divisores',
   'Da los divisores "de dentro" y se deja los dos extremos, que son divisores de cualquier número.',
   'procedimiento', true, 'hipotesis', 'Divisores de 12: 2, 3, 4, 6', 'Divisores de 12: 1, 2, 3, 4, 6, 12', 2),
  ('c2000000-0000-4000-8000-000000000203', null, 'c1000000-0000-4000-8000-000000000203',
   'Aplicar al 3 el criterio de la última cifra',
   'Usa para el 3 la regla del 2 y del 5: mira si acaba en 0, 3, 6 o 9 en vez de sumar las cifras.',
   'conceptual', true, 'hipotesis', '123 acaba en 3: divisible por 3. 213 también… y 23 también.', '2 + 3 = 5: 23 no es divisible por 3.', 3),
  ('c2000000-0000-4000-8000-000000000204', null, 'c1000000-0000-4000-8000-000000000204',
   'Creer que un número impar es primo',
   'Descarta los pares y da por primo todo lo demás, sin probar con 3, 7 u 11.',
   'conceptual', true, 'hipotesis', '91 es primo', '91 = 7 · 13: compuesto', 4),
  ('c2000000-0000-4000-8000-000000000205', null, 'c1000000-0000-4000-8000-000000000206',
   'Confundir el m.c.d. con el m.c.m.',
   'Calcula uno cuando se pide el otro, o en un problema elige la cuenta equivocada. Es el más importante del tema: los problemas solo miden esto.',
   'conceptual', true, 'hipotesis', 'Dos autobuses cada 12 y 18 minutos: coinciden a los 6 minutos.', 'Coinciden a los 36 minutos: m.c.m.(12, 18) = 36.', 5),
  ('c2000000-0000-4000-8000-000000000206', null, 'c1000000-0000-4000-8000-000000000206',
   'Coger los factores comunes con el mayor exponente en el m.c.d.',
   'Mezcla las dos reglas: elige bien los comunes, pero con el exponente del m.c.m.',
   'procedimiento', true, 'hipotesis', 'm.c.d.(24, 36) = 2³ · 3² = 72', 'm.c.d.(24, 36) = 2² · 3 = 12', 6),
  ('c2000000-0000-4000-8000-000000000207', null, 'c1000000-0000-4000-8000-000000000207',
   'Calcular el m.c.m. multiplicando los dos números',
   'Da un múltiplo común, pero no el menor: solo coincide cuando no tienen ningún factor en común.',
   'procedimiento', true, 'hipotesis', 'm.c.m.(12, 18) = 216', 'm.c.m.(12, 18) = 36', 7),
  ('c2000000-0000-4000-8000-000000000208', null, 'c1000000-0000-4000-8000-000000000205',
   'Calcular la potencia multiplicando la base por el exponente',
   'Lee 2³ como 2 · 3. Aparece al volver de la descomposición al número.',
   'operacion', true, 'hipotesis', '2³ · 5 = 6 · 5 = 30', '2³ · 5 = 8 · 5 = 40', 8),
  ('c2000000-0000-4000-8000-000000000209', null, 'c1000000-0000-4000-8000-000000000205',
   'Dejar en la descomposición un factor que no es primo',
   'Para de dividir antes de tiempo o divide por un compuesto, y en el resultado queda un 4, un 9 o un 15.',
   'procedimiento', false, 'hipotesis', '60 = 4 · 15', '60 = 2² · 3 · 5', 9),
  ('c2000000-0000-4000-8000-000000000210', null, 'c1000000-0000-4000-8000-000000000205',
   'Método bien, división mal',
   'Sigue bien el procedimiento y se equivoca en una división o una multiplicación. NO es un error de divisibilidad: reexplicar el tema aquí no arregla nada.',
   'operacion', false, 'estructural', '84 : 2 = 44', '84 : 2 = 42', 10),
  ('c2000000-0000-4000-8000-000000000211', null, 'c1000000-0000-4000-8000-000000000205',
   'Descuido: pierde un factor al copiar',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '360 = 2³ · 3²', '360 = 2³ · 3² · 5', 11)
on conflict (id) do nothing;

-- ── LOS 17 ARQUETIPOS ────────────────────────────────────────────────────
-- Misma escala de dificultad que en enteros: 1 = aplicar la definición,
-- 2 = combinar dos pasos o invertir, 3 = razonar antes de calcular.
insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  -- Múltiplos y divisores
  ('c3000000-0000-4000-8000-000000000201', null, 'c1000000-0000-4000-8000-000000000201',
   'Escribe los tres múltiplos siguientes',
   'De 4 a 6 series de tres múltiplos consecutivos de un número del 3 al 15, empezando en cualquier múltiplo (no siempre en el propio número). Un número distinto por serie. Nunca se pregunta por el 0.',
   '18, 24, 30, ___, ___, ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000202', null, 'c1000000-0000-4000-8000-000000000202',
   'Contesta sí o no: múltiplo, divisor, divisible',
   'De 6 a 8 preguntas, mitad sí y mitad no, con las tres formas (múltiplo de, divisor de, divisible por). Divisores del 6 al 19 y nunca 10, para que haya que dividir. Los no, cerca de un múltiplo.',
   '¿Es 91 múltiplo de 13? ___ / ¿Es 8 divisor de 92? ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000203', null, 'c1000000-0000-4000-8000-000000000201',
   'Escribe los múltiplos comprendidos entre dos números',
   'De 3 a 4. Los extremos no son múltiplos, para que "entre" no tenga dudas. De 3 a 6 múltiplos por apartado.',
   'Los múltiplos de 7 entre 30 y 60: ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000204', null, 'c1000000-0000-4000-8000-000000000202',
   'Halla todos los divisores de un número',
   'De 3 a 4 números del 12 al 100 con 6 a 12 divisores. El ejemplo enseña el método de las parejas.',
   'Divisores de 36: ___', 'ejercicio', 2, false, 'activo'),
  -- Criterios
  ('c3000000-0000-4000-8000-000000000205', null, 'c1000000-0000-4000-8000-000000000203',
   'Indica por cuáles de 2, 3, 5 y 10 es divisible',
   'De 5 a 7 números de tres o cuatro cifras. Siempre uno divisible por 3 que no acaba en 0, 3, 6 ni 9, y otro que acaba en 3 o en 9 y no lo es. Alguno que no sea divisible por ninguno.',
   '2127: ___ / 1493: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000206', null, 'c1000000-0000-4000-8000-000000000203',
   'Escribe todas las cifras que hacen divisible el número',
   'De 3 a 4 números con una cifra tapada (nunca la primera). Divisible por 3, por 2 y por 3, o por 3 y por 5. Hay que dar todas las cifras que valen.',
   '4□2, divisible por 3: ___', 'ejercicio', 2, false, 'activo'),
  -- Primos
  ('c3000000-0000-4000-8000-000000000207', null, 'c1000000-0000-4000-8000-000000000204',
   'Clasifica en primo o compuesto',
   'De 6 a 8 números del 11 al 221. Siempre dos impares compuestos que no acaban en 5 (51, 91, 119…) y dos primos. Sin el 1.',
   '91: ___ / 97: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000208', null, 'c1000000-0000-4000-8000-000000000204',
   'Escribe los números primos comprendidos entre dos números',
   'De 2 a 3 tramos de 15 a 30 números, hasta el 120 (con 2, 3, 5 y 7 basta para cribar). De 3 a 7 primos por tramo.',
   'Los primos entre 40 y 60: ___', 'ejercicio', 2, false, 'activo'),
  -- Descomposición
  ('c3000000-0000-4000-8000-000000000209', null, 'c1000000-0000-4000-8000-000000000205',
   'Descompón en factores primos',
   'De 4 a 6 números del 12 al 600 con al menos tres factores, alguno repetido y ninguno mayor que 13. El resultado se escribe con potencias.',
   '360 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000210', null, 'c1000000-0000-4000-8000-000000000205',
   'Escribe el número que tiene esta descomposición',
   'De 4 a 6: dos o tres primos distintos hasta el 11, algún exponente mayor que 1, resultado hasta 1000.',
   '2³ · 5 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000211', null, 'c1000000-0000-4000-8000-000000000205',
   'Decide si es divisor mirando la descomposición',
   'De 3 a 4 parejas dadas ya descompuestas. Hay síes y noes de los dos tipos: un exponente que se pasa y un primo que no está.',
   '¿Es 2² · 3 divisor de 2³ · 3² · 5? ___', 'ejercicio', 3, false, 'activo'),
  -- m.c.d. y m.c.m.
  ('c3000000-0000-4000-8000-000000000212', null, 'c1000000-0000-4000-8000-000000000206',
   'Calcula el máximo común divisor de dos números',
   'De 3 a 5 parejas del 12 al 180, con m.c.d. de 4 o más y sin que uno divida al otro. Por descomposición.',
   'm.c.d.(24, 36) = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000213', null, 'c1000000-0000-4000-8000-000000000207',
   'Calcula el mínimo común múltiplo de dos números',
   'De 3 a 5 parejas del 4 al 60, con algún factor común, sin que uno divida al otro y m.c.m. hasta 600. Por descomposición.',
   'm.c.m.(12, 18) = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000214', null, 'c1000000-0000-4000-8000-000000000207',
   'Calcula el m.c.d. y el m.c.m. de tres números',
   'De 2 a 3 ternas del 6 al 90, con m.c.d. mayor que 1 y m.c.m. hasta 1000. Las dos cosas en el mismo apartado.',
   '12, 18 y 30: m.c.d. = ___ ; m.c.m. = ___', 'ejercicio', 3, false, 'activo'),
  -- Problemas
  ('c3000000-0000-4000-8000-000000000215', null, 'c1000000-0000-4000-8000-000000000208',
   'Resuelve problemas de mínimo común múltiplo',
   'De 2 a 3, de contextos distintos (autobuses, faros, bolsas, vueltas a un circuito). Enunciados escritos a mano; el código pone los números.',
   'Dos autobuses pasan cada 12 y cada 18 minutos. ¿Cuándo vuelven a coincidir?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000216', null, 'c1000000-0000-4000-8000-000000000208',
   'Resuelve problemas de máximo común divisor',
   'De 2 a 3, de contextos distintos (cuerdas, bandejas, losetas, grupos). M.c.d. de 6 o más.',
   'Dos cuerdas de 48 y 60 cm, en trozos iguales lo más largos posible. ¿Cuánto mide cada trozo?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000217', null, 'c1000000-0000-4000-8000-000000000208',
   'Decide si hace falta el m.c.d. o el m.c.m. y resuelve',
   'De 2 a 3, alternando las dos clases. Es donde se ve el error de confundirlos: la respuesta-trampa es la de la otra cuenta.',
   'Un problema de coincidir y otro de repartir, sin decir cuál es cuál.', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

-- ── LOS 6 OBJETIVOS ──────────────────────────────────────────────────────
-- `criterios` nace vacío por la misma razón que en enteros (ver la 123): no
-- se ha leído en el anexo qué criterio corresponde a cada objetivo.
insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000201', null, 'c0000000-0000-4000-8000-000000000002',
   'Calcular múltiplos y divisores',
   'Obtener múltiplos de un número, hallar todos sus divisores y reconocer la relación de divisibilidad entre dos números.',
   2, 1),
  ('c4000000-0000-4000-8000-000000000202', null, 'c0000000-0000-4000-8000-000000000002',
   'Aplicar los criterios de divisibilidad',
   'Decidir sin dividir si un número es divisible por 2, 3, 5 o 10.',
   1, 2),
  ('c4000000-0000-4000-8000-000000000203', null, 'c0000000-0000-4000-8000-000000000002',
   'Distinguir números primos y compuestos',
   'Reconocer si un número es primo o compuesto y encontrar los primos de un tramo.',
   1, 3),
  ('c4000000-0000-4000-8000-000000000204', null, 'c0000000-0000-4000-8000-000000000002',
   'Descomponer en factores primos',
   'Descomponer un número en factores primos con potencias, reconstruirlo y usar la descomposición para decidir divisibilidades.',
   1, 4),
  ('c4000000-0000-4000-8000-000000000205', null, 'c0000000-0000-4000-8000-000000000002',
   'Calcular el m.c.d. y el m.c.m.',
   'Calcular el máximo común divisor y el mínimo común múltiplo de dos o tres números por descomposición.',
   2, 5),
  ('c4000000-0000-4000-8000-000000000206', null, 'c0000000-0000-4000-8000-000000000002',
   'Resolver problemas de m.c.d. y m.c.m.',
   'Reconocer en un enunciado si hace falta el m.c.d. o el m.c.m. y resolverlo.',
   2, 6)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000201', 'c1000000-0000-4000-8000-000000000201'),
  ('c4000000-0000-4000-8000-000000000201', 'c1000000-0000-4000-8000-000000000202'),
  ('c4000000-0000-4000-8000-000000000202', 'c1000000-0000-4000-8000-000000000203'),
  ('c4000000-0000-4000-8000-000000000203', 'c1000000-0000-4000-8000-000000000204'),
  ('c4000000-0000-4000-8000-000000000204', 'c1000000-0000-4000-8000-000000000205'),
  ('c4000000-0000-4000-8000-000000000205', 'c1000000-0000-4000-8000-000000000206'),
  ('c4000000-0000-4000-8000-000000000205', 'c1000000-0000-4000-8000-000000000207'),
  ('c4000000-0000-4000-8000-000000000206', 'c1000000-0000-4000-8000-000000000206'),
  ('c4000000-0000-4000-8000-000000000206', 'c1000000-0000-4000-8000-000000000207'),
  ('c4000000-0000-4000-8000-000000000206', 'c1000000-0000-4000-8000-000000000208')
on conflict (objetivo_id, concepto_id) do nothing;
