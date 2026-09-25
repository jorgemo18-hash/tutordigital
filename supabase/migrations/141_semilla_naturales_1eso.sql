-- 141_semilla_naturales_1eso.sql
-- EL OCTAVO TEMA DEL CATÁLOGO: Números naturales, 1.º ESO de Matemáticas.
-- 1 tema, 6 conceptos, 10 errores típicos, 12 arquetipos y 5 objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0008NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO):
--   A.1 Conteo: «Estrategias variadas de recuento sistemático…» y
--       «Adaptación del conteo al tamaño de los números…»;
--   A.2 «Realización de estimaciones con la precisión requerida»;
--   A.3 «Estrategias de cálculo mental con números naturales…»,
--       «Propiedades de las operaciones…», «Relaciones inversas entre las
--       operaciones» (la prueba de la división) y «Operaciones … en
--       situaciones contextualizadas».
--
-- LO QUE NO ESTÁ, y por qué:
--   - las operaciones combinadas y la jerarquía: ya las genera el tema de
--     enteros, naturales incluidos;
--   - leer y escribir números grandes en letra: los libros lo hacen, pero
--     el anexo de 1.º no lo nombra (sí «el tamaño de los números», que es
--     lo que trabaja el valor de cada cifra);
--   - la combinatoria con fórmulas: el recuento es con árbol o lista, como
--     dice A.1, «estrategias de recuento sistemático».
--
-- LOS ERRORES: los 8 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000008', null, 'Matemáticas', '1.º ESO',
   'Números naturales', 'aragon', array['A.1', 'A.2', 'A.3'], 1)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000801', null, 'c0000000-0000-4000-8000-000000000008',
   'El sistema de numeración decimal',
   'Cada cifra vale según su posición: en 3 745 210, el 4 vale 40 000.',
   'A.1', false, 1),
  ('c1000000-0000-4000-8000-000000000802', null, 'c0000000-0000-4000-8000-000000000008',
   'Redondear y estimar',
   'Redondear mirando la cifra siguiente, y estimar una operación redondeando antes de operar.',
   'A.2', false, 2),
  ('c1000000-0000-4000-8000-000000000803', null, 'c0000000-0000-4000-8000-000000000008',
   'La división y su prueba',
   'Dividendo, divisor, cociente y resto: D = d · c + r, con el resto menor que el divisor.',
   'A.3', false, 3),
  ('c1000000-0000-4000-8000-000000000804', null, 'c0000000-0000-4000-8000-000000000008',
   'Propiedades y cálculo mental',
   'La distributiva, sacar factor común y los trucos de cálculo mental (por 5, 9, 11, 25, 99).',
   'A.3', false, 4),
  ('c1000000-0000-4000-8000-000000000805', null, 'c0000000-0000-4000-8000-000000000008',
   'Recuento sistemático',
   'Contar las posibilidades con un diagrama de árbol o una lista ordenada, y decidir si importa el orden.',
   'A.1', false, 5),
  ('c1000000-0000-4000-8000-000000000806', null, 'c0000000-0000-4000-8000-000000000008',
   'Problemas con números naturales',
   'Problemas de varias operaciones y de división en los que hay que decidir qué hacer con el resto.',
   'A.3', false, 6)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000801', null, 'c1000000-0000-4000-8000-000000000802',
   'Redondear cortando',
   'Pone a cero las cifras que sobran sin mirar la siguiente.',
   'procedimiento', true, 'hipotesis', '4 870 a los millares: 4 000', '5 000', 1),
  ('c2000000-0000-4000-8000-000000000802', null, 'c1000000-0000-4000-8000-000000000801',
   'Confundir la cifra con su valor',
   'Contesta la cifra sin tener en cuenta la posición.',
   'conceptual', true, 'hipotesis', 'En 3 745 210, el 4 vale 4', '40 000', 2),
  ('c2000000-0000-4000-8000-000000000803', null, 'c1000000-0000-4000-8000-000000000803',
   'Olvidar el resto en la prueba de la división',
   'Calcula el dividendo multiplicando divisor por cociente, sin sumar el resto.',
   'procedimiento', true, 'hipotesis', 'd = 12, c = 15, r = 7: D = 180', 'D = 187', 3),
  ('c2000000-0000-4000-8000-000000000804', null, 'c1000000-0000-4000-8000-000000000804',
   'Aplicar la distributiva solo al primer sumando',
   'Multiplica el primer término del paréntesis y copia el segundo.',
   'procedimiento', true, 'hipotesis', '7 · (10 + 3) = 70 + 3 = 73', '70 + 21 = 91', 4),
  ('c2000000-0000-4000-8000-000000000805', null, 'c1000000-0000-4000-8000-000000000805',
   'Sumar las opciones en vez de multiplicarlas',
   'Cuenta las opciones de cada elección y las suma.',
   'conceptual', true, 'hipotesis', '3 primeros y 4 segundos: 7 menús', '12 menús', 5),
  ('c2000000-0000-4000-8000-000000000806', null, 'c1000000-0000-4000-8000-000000000805',
   'Contar dos veces lo que es lo mismo',
   'Cuenta con orden cuando el orden no importa (el saludo de Ana a Luis y el de Luis a Ana).',
   'conceptual', true, 'hipotesis', '5 amigos se dan la mano: 20 saludos', '10', 6),
  ('c2000000-0000-4000-8000-000000000807', null, 'c1000000-0000-4000-8000-000000000806',
   'No pensar qué hacer con el resto',
   'Contesta el cociente tal cual aunque la pregunta pida contar lo que sobra o redondear hacia arriba.',
   'interpretacion', true, 'hipotesis', '230 alumnos en autobuses de 55: 4 autobuses', '5 autobuses', 7),
  ('c2000000-0000-4000-8000-000000000808', null, 'c1000000-0000-4000-8000-000000000804',
   'Aplicar el truco de cálculo mental a medias',
   'Por 5 multiplica por 10 y no divide entre 2; por 99 multiplica por 100 y no resta.',
   'procedimiento', true, 'hipotesis', '46 · 5 = 460', '460 : 2 = 230', 8),
  ('c2000000-0000-4000-8000-000000000809', null, 'c1000000-0000-4000-8000-000000000806',
   'Método bien, cuenta mal',
   'Elige bien las operaciones y se equivoca en una de ellas.',
   'operacion', false, 'estructural', '48 · 12 = 566', '576', 9),
  ('c2000000-0000-4000-8000-000000000810', null, 'c1000000-0000-4000-8000-000000000801',
   'Descuido: copia mal un número',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '3 745 copiado como 3 754', '3 745', 10)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000801', null, 'c1000000-0000-4000-8000-000000000801',
   'Di cuánto vale una cifra según su posición',
   'De 6 a 8 números de 5 a 7 cifras, todas distintas.',
   'En 3 745 210, el 4 vale ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000802', null, 'c1000000-0000-4000-8000-000000000802',
   'Redondea el número natural',
   'De 6 a 8, a las decenas, centenas o millares; la mitad hacia arriba.',
   '4 870 a los millares: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000803', null, 'c1000000-0000-4000-8000-000000000802',
   'Estima el resultado redondeando antes de operar',
   'De 4 a 6: sumas y restas redondeando a las centenas y productos redondeando a las decenas.',
   '489 + 312 ≈ ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000804', null, 'c1000000-0000-4000-8000-000000000803',
   'Divide y comprueba con la prueba de la división',
   'De 4 a 6 divisiones con resto, entre una y dos cifras.',
   '347 : 12 → cociente ___, resto ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000805', null, 'c1000000-0000-4000-8000-000000000803',
   'Halla el término que falta en una división',
   'De 4 a 6: el dividendo, el divisor, o si un resto es posible.',
   'Divisor 12, cociente 15, resto 7. Dividendo: ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000806', null, 'c1000000-0000-4000-8000-000000000804',
   'Calcula de cabeza con estrategias',
   'De 6 a 8, un truco distinto en cada uno: por 5, 9, 11, 25, 99 y entre 5.',
   '46 · 5 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000807', null, 'c1000000-0000-4000-8000-000000000804',
   'Calcula aplicando la propiedad distributiva',
   'De 5 a 7, con el primer sumando redondo.',
   '7 · (100 − 2) = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000808', null, 'c1000000-0000-4000-8000-000000000804',
   'Calcula sacando factor común',
   'De 4 a 6; lo que queda dentro del paréntesis suma (o resta) un número redondo.',
   '8 · 25 + 8 · 75 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000809', null, 'c1000000-0000-4000-8000-000000000805',
   'Cuenta las combinaciones posibles con un diagrama de árbol',
   'De 3 a 4 situaciones distintas (menús, ropa, helados, candados, caminos).',
   'Un menú tiene 3 primeros, 4 segundos y 2 postres. ¿Cuántos menús distintos hay?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000810', null, 'c1000000-0000-4000-8000-000000000805',
   'Cuenta parejas decidiendo si importa el orden',
   'De 3 a 4: saludos, partidos, parejas y copas (sin orden) y números de dos cifras (con orden).',
   '5 amigos se dan la mano. ¿Cuántos apretones hay?', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000811', null, 'c1000000-0000-4000-8000-000000000806',
   'Resuelve problemas de varias operaciones con números naturales',
   'De 3 a 4, de contextos distintos.',
   'Van de excursión 64 alumnos; la entrada cuesta 9 € y el autobús 350 €. ¿Cuánto cuesta?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000812', null, 'c1000000-0000-4000-8000-000000000806',
   'Resuelve problemas de división interpretando el resto',
   'De 3 a 4: unas veces hay que sumar uno al cociente, otras no, y otras se pregunta el resto.',
   '230 alumnos en autobuses de 55 plazas. ¿Cuántos autobuses?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000801', null, 'c0000000-0000-4000-8000-000000000008',
   'Usar el sistema de numeración, redondear y estimar',
   'El valor de cada cifra, redondear y estimar operaciones.',
   2, 1),
  ('c4000000-0000-4000-8000-000000000802', null, 'c0000000-0000-4000-8000-000000000008',
   'Dividir y usar la prueba de la división',
   'Dividir, comprobar y hallar el término que falta.',
   1, 2),
  ('c4000000-0000-4000-8000-000000000803', null, 'c0000000-0000-4000-8000-000000000008',
   'Calcular de forma eficiente con las propiedades',
   'Distributiva, factor común y cálculo mental.',
   2, 3),
  ('c4000000-0000-4000-8000-000000000804', null, 'c0000000-0000-4000-8000-000000000008',
   'Contar de forma sistemática',
   'Diagramas de árbol y listas ordenadas.',
   1, 4),
  ('c4000000-0000-4000-8000-000000000805', null, 'c0000000-0000-4000-8000-000000000008',
   'Resolver problemas con números naturales',
   'Problemas de varias operaciones y de división con resto.',
   2, 5)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000801', 'c1000000-0000-4000-8000-000000000801'),
  ('c4000000-0000-4000-8000-000000000801', 'c1000000-0000-4000-8000-000000000802'),
  ('c4000000-0000-4000-8000-000000000802', 'c1000000-0000-4000-8000-000000000803'),
  ('c4000000-0000-4000-8000-000000000803', 'c1000000-0000-4000-8000-000000000804'),
  ('c4000000-0000-4000-8000-000000000804', 'c1000000-0000-4000-8000-000000000805'),
  ('c4000000-0000-4000-8000-000000000805', 'c1000000-0000-4000-8000-000000000806')
on conflict (objetivo_id, concepto_id) do nothing;
