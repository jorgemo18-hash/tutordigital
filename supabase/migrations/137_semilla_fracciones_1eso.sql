-- 137_semilla_fracciones_1eso.sql
-- EL CUARTO TEMA DEL CATÁLOGO: Fracciones, 1.º ESO de Matemáticas.
-- 1 tema, 8 conceptos, 15 errores típicos, 17 arquetipos y 7 objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0004NN. Mismo
-- formato que la 135 y la 136.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO):
--   A.2 «Diferentes formas de representación de números … fraccionarios»
--       → equivalentes y simplificar;
--   A.3 «Operaciones con números enteros, fraccionarios o decimales en
--       situaciones contextualizadas» → la fracción de una cantidad, las
--       cuatro operaciones y los problemas; las combinadas, en «propiedades
--       de las operaciones» (ningún saber nombra la jerarquía: implícito,
--       como en enteros);
--   A.4 «Comparación y ordenación de fracciones, decimales y porcentajes»
--       → comparar y ordenar.
--
-- LO QUE SE QUEDA FUERA: representar una fracción con un dibujo (tarta,
-- rectángulo) y situarla en la recta. Los dos necesitan figura, y la figura
-- la dibuja nuestro código (como la recta de los enteros): va aparte. Y las
-- fracciones negativas, que son de 2.º.
--
-- LOS ERRORES: los 13 predecibles son `hipotesis` (de la bibliografía y los
-- materiales, no vistos aún en nuestros alumnos); los dos últimos son los
-- estructurales de siempre.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000004', null, 'Matemáticas', '1.º ESO',
   'Fracciones', 'aragon', array['A.2', 'A.3', 'A.4'], 7)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000401', null, 'c0000000-0000-4000-8000-000000000004',
   'Fracción de una cantidad',
   'Los a/b de N: se divide N entre el denominador y se multiplica por el numerador. Y al revés: conocida la parte, hallar el total.',
   'A.3', false, 1),
  ('c1000000-0000-4000-8000-000000000402', null, 'c0000000-0000-4000-8000-000000000004',
   'Fracciones equivalentes',
   'Representan la misma cantidad. Se obtienen multiplicando o dividiendo numerador y denominador por el mismo número, y se reconocen por los productos cruzados.',
   'A.2', false, 2),
  ('c1000000-0000-4000-8000-000000000403', null, 'c0000000-0000-4000-8000-000000000004',
   'Simplificación y fracción irreducible',
   'Simplificar es dividir numerador y denominador por un divisor común; la fracción irreducible se obtiene dividiendo por su m.c.d.',
   'A.2', false, 3),
  ('c1000000-0000-4000-8000-000000000404', null, 'c0000000-0000-4000-8000-000000000004',
   'Comparación y ordenación de fracciones',
   'Con el mismo denominador, mayor la de mayor numerador; con el mismo numerador, mayor la de menor denominador; si no, a común denominador.',
   'A.4', false, 4),
  ('c1000000-0000-4000-8000-000000000405', null, 'c0000000-0000-4000-8000-000000000004',
   'Suma y resta de fracciones',
   'Con el mismo denominador se suman los numeradores; con distinto, primero se reduce a común denominador (el m.c.m.). El resultado se simplifica.',
   'A.3', false, 5),
  ('c1000000-0000-4000-8000-000000000406', null, 'c0000000-0000-4000-8000-000000000004',
   'Producto y cociente de fracciones',
   'El producto multiplica numeradores y denominadores; dividir es multiplicar por la inversa de la segunda. La fracción de una fracción es su producto.',
   'A.3', false, 6),
  ('c1000000-0000-4000-8000-000000000407', null, 'c0000000-0000-4000-8000-000000000004',
   'Operaciones combinadas con fracciones',
   'La misma jerarquía que con los números naturales: paréntesis, después productos y cocientes, después sumas y restas.',
   'A.3', false, 7),
  ('c1000000-0000-4000-8000-000000000408', null, 'c0000000-0000-4000-8000-000000000004',
   'Problemas con fracciones',
   'Traducir un enunciado a una fracción de una cantidad, a lo que queda, o al total del que se conoce una parte.',
   'A.3', false, 8)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000401', null, 'c1000000-0000-4000-8000-000000000405',
   'Sumar numeradores y denominadores',
   'Suma las fracciones como dos parejas de números sueltos.',
   'procedimiento', true, 'hipotesis', '1/2 + 1/3 = 2/5', '1/2 + 1/3 = 3/6 + 2/6 = 5/6', 1),
  ('c2000000-0000-4000-8000-000000000402', null, 'c1000000-0000-4000-8000-000000000405',
   'Poner el denominador común sin cambiar los numeradores',
   'Calcula bien el denominador común pero deja los numeradores como estaban.',
   'procedimiento', true, 'hipotesis', '1/2 + 1/3 = 2/6', '1/2 + 1/3 = 3/6 + 2/6 = 5/6', 2),
  ('c2000000-0000-4000-8000-000000000403', null, 'c1000000-0000-4000-8000-000000000405',
   'No simplificar el resultado',
   'Llega a una fracción correcta pero no la simplifica.',
   'procedimiento', true, 'hipotesis', '1/8 + 1/8 = 2/8', '1/8 + 1/8 = 2/8 = 1/4', 3),
  ('c2000000-0000-4000-8000-000000000404', null, 'c1000000-0000-4000-8000-000000000405',
   'Sumar el entero al numerador',
   'No escribe el entero como fracción con el mismo denominador.',
   'procedimiento', true, 'hipotesis', '2 + 3/4 = 5/4', '2 + 3/4 = 8/4 + 3/4 = 11/4', 4),
  ('c2000000-0000-4000-8000-000000000405', null, 'c1000000-0000-4000-8000-000000000406',
   'Multiplicar en cruz',
   'Aplica al producto la regla de la división.',
   'procedimiento', true, 'hipotesis', '2/3 · 4/5 = 10/12', '2/3 · 4/5 = 8/15', 5),
  ('c2000000-0000-4000-8000-000000000406', null, 'c1000000-0000-4000-8000-000000000406',
   'Dividir sin invertir',
   'Multiplica numeradores y denominadores en línea, como en el producto.',
   'procedimiento', true, 'hipotesis', '2/3 : 4/5 = 8/15', '2/3 : 4/5 = 2/3 · 5/4 = 5/6', 6),
  ('c2000000-0000-4000-8000-000000000407', null, 'c1000000-0000-4000-8000-000000000406',
   'Invertir la primera fracción al dividir',
   'Sabe que hay que invertir, pero invierte la que no es.',
   'procedimiento', true, 'hipotesis', '2/3 : 4/5 = 3/2 · 4/5 = 6/5', '2/3 : 4/5 = 2/3 · 5/4 = 5/6', 7),
  ('c2000000-0000-4000-8000-000000000408', null, 'c1000000-0000-4000-8000-000000000404',
   'Creer que con más denominador la fracción es mayor',
   'Compara los denominadores como números sueltos: más partes le parece más, cuando son partes más pequeñas.',
   'conceptual', true, 'hipotesis', '1/5 > 1/3', '1/5 < 1/3', 8),
  ('c2000000-0000-4000-8000-000000000409', null, 'c1000000-0000-4000-8000-000000000401',
   'Calcular la fracción de una cantidad al revés',
   'Divide entre el numerador y multiplica por el denominador.',
   'procedimiento', true, 'hipotesis', '2/3 de 60 = 60 : 2 · 3 = 90', '2/3 de 60 = 60 : 3 · 2 = 40', 9),
  ('c2000000-0000-4000-8000-000000000410', null, 'c1000000-0000-4000-8000-000000000402',
   'Obtener fracciones equivalentes sumando',
   'Suma el mismo número arriba y abajo en vez de multiplicar.',
   'conceptual', true, 'hipotesis', '2/3 = 4/5', '2/3 = 4/6', 10),
  ('c2000000-0000-4000-8000-000000000411', null, 'c1000000-0000-4000-8000-000000000403',
   'Simplificar solo una vez',
   'Divide por un divisor común y se para, sin llegar a la irreducible.',
   'procedimiento', true, 'hipotesis', '36/48 = 18/24', '36/48 = 3/4', 11),
  ('c2000000-0000-4000-8000-000000000412', null, 'c1000000-0000-4000-8000-000000000407',
   'Operar de izquierda a derecha sin jerarquía',
   'Hace las operaciones en el orden en que están escritas.',
   'jerarquia', true, 'hipotesis', '1/2 + 1/2 · 1/2 = 1 · 1/2 = 1/2', '1/2 + 1/2 · 1/2 = 1/2 + 1/4 = 3/4', 12),
  ('c2000000-0000-4000-8000-000000000413', null, 'c1000000-0000-4000-8000-000000000408',
   'Dar lo gastado en vez de lo que queda',
   'Resuelve bien la fracción de la cantidad pero contesta a otra pregunta.',
   'interpretacion', true, 'hipotesis', 'Le quedan 60 páginas (son las que ha leído).', 'Ha leído 60; le quedan 150 − 60 = 90.', 13),
  ('c2000000-0000-4000-8000-000000000414', null, 'c1000000-0000-4000-8000-000000000405',
   'Método bien, cálculo mal',
   'Sigue bien el procedimiento y se equivoca en una multiplicación o en el m.c.m. No es un error de fracciones.',
   'operacion', false, 'estructural', '3/4 = 9/16 al pasar a dieciseisavos', '3/4 = 12/16', 14),
  ('c2000000-0000-4000-8000-000000000415', null, 'c1000000-0000-4000-8000-000000000405',
   'Descuido: copia mal un número',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '2/7 + 3/7 = 5/9', '2/7 + 3/7 = 5/7', 15)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000401', null, 'c1000000-0000-4000-8000-000000000401',
   'Calcula la fracción de una cantidad',
   'De 6 a 8, fracciones propias irreducibles con denominador del 2 al 12 y la cantidad múltiplo del denominador, hasta 240.',
   '2/3 de 60 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000402', null, 'c1000000-0000-4000-8000-000000000401',
   'Halla el número del que se conoce una fracción',
   'De 3 a 5: los a/b de un número son N. La operación inversa, la que piden los problemas del total.',
   'Los 3/5 de un número son 24. El número es ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000403', null, 'c1000000-0000-4000-8000-000000000402',
   'Completa la fracción equivalente',
   'De 5 a 7, mitad amplificando y mitad simplificando, con el hueco arriba o abajo.',
   '2/3 = □/12 / 12/18 = 2/□', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000404', null, 'c1000000-0000-4000-8000-000000000402',
   '¿Son equivalentes? Contesta sí o no',
   'De 6 a 8 parejas, mitad y mitad. Las que no lo son se han construido sumando lo mismo arriba y abajo (2/3 y 4/5).',
   '2/3 y 8/12: ___ / 2/3 y 4/5: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000405', null, 'c1000000-0000-4000-8000-000000000403',
   'Simplifica hasta la fracción irreducible',
   'De 4 a 6, con el m.c.d. compuesto (4, 6, 8, 9, 12…): dividir una sola vez no basta.',
   '36/48 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000406', null, 'c1000000-0000-4000-8000-000000000404',
   'Compara las fracciones con <, > o =',
   'De 6 a 8 parejas de los tres tipos (mismo denominador, mismo numerador, distintos), con al menos dos de mismo numerador.',
   '3/7 ___ 3/5 / 2/9 ___ 5/9', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000407', null, 'c1000000-0000-4000-8000-000000000404',
   'Ordena las fracciones de menor a mayor',
   'De 2 a 3 listas de cuatro fracciones con denominadores distintos y denominador común de hasta 60.',
   '5/6, 3/4, 4/5, 1/3', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000408', null, 'c1000000-0000-4000-8000-000000000405',
   'Suma y resta fracciones con el mismo denominador',
   'De 6 a 8, más sumas que restas, resultado positivo y en alguna simplificable.',
   '3/8 + 1/8 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000409', null, 'c1000000-0000-4000-8000-000000000405',
   'Suma y resta fracciones con distinto denominador',
   'De 5 a 7, con denominador común (m.c.m.) hasta 36 y resultado positivo. El ejemplo enseña el paso a común denominador.',
   '1/2 + 1/3 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000410', null, 'c1000000-0000-4000-8000-000000000405',
   'Suma o resta un número entero y una fracción',
   'De 4 a 6: 2 + 3/4, 3 − 2/5. El entero, del 1 al 4.',
   '2 + 3/4 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000411', null, 'c1000000-0000-4000-8000-000000000406',
   'Multiplica fracciones',
   'De 6 a 8 productos de dos fracciones propias, nunca iguales ni inversas. Resultado simplificado.',
   '2/3 · 4/5 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000412', null, 'c1000000-0000-4000-8000-000000000406',
   'Divide fracciones',
   'De 6 a 8 cocientes de dos fracciones propias, nunca iguales ni inversas. El ejemplo enseña la inversa de la segunda.',
   '2/3 : 4/5 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000413', null, 'c1000000-0000-4000-8000-000000000406',
   'Calcula la fracción de una fracción',
   'De 4 a 6: "2/3 de 9/10", que es un producto dicho con palabras.',
   '2/3 de 9/10 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000414', null, 'c1000000-0000-4000-8000-000000000407',
   'Resuelve operaciones combinadas con fracciones',
   'De 3 a 4 con tres fracciones, una suma o resta y un producto o cociente sin paréntesis, de forma que el orden importe. Resultado positivo.',
   '1/2 + 3/4 · 2/3 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000415', null, 'c1000000-0000-4000-8000-000000000407',
   'Resuelve operaciones combinadas con fracciones y paréntesis',
   'De 2 a 3 con tres fracciones y un paréntesis que cambia el orden. Resultado positivo.',
   '(1/2 + 1/3) · 3/5 = ___', 'ejercicio', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000416', null, 'c1000000-0000-4000-8000-000000000408',
   'Resuelve problemas de la fracción de una cantidad',
   'De 2 a 3, de contextos distintos (clase, depósito, paga, huerto). Enunciados escritos a mano; el código pone los números.',
   'En una clase de 24 alumnos, los 3/8 van en autobús. ¿Cuántos van en autobús?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000417', null, 'c1000000-0000-4000-8000-000000000408',
   'Resuelve problemas de lo que queda y del total',
   'De 2 a 3, de contextos distintos de los de la otra batería (libro, viaje, gastos, ahorro): lo que queda después de una fracción, lo que queda tras dos gastos, y el total del que se conoce una parte.',
   'Un libro tiene 150 páginas y Sara ha leído los 2/5. ¿Cuántas le quedan?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000401', null, 'c0000000-0000-4000-8000-000000000004',
   'Calcular la fracción de una cantidad',
   'Calcular la fracción de una cantidad y, al revés, el total del que se conoce una fracción.',
   1, 1),
  ('c4000000-0000-4000-8000-000000000402', null, 'c0000000-0000-4000-8000-000000000004',
   'Reconocer fracciones equivalentes y simplificar',
   'Obtener y reconocer fracciones equivalentes, y simplificar hasta la irreducible.',
   2, 2),
  ('c4000000-0000-4000-8000-000000000403', null, 'c0000000-0000-4000-8000-000000000004',
   'Comparar y ordenar fracciones',
   'Comparar dos fracciones y ordenar varias, eligiendo la estrategia según sus términos.',
   1, 3),
  ('c4000000-0000-4000-8000-000000000404', null, 'c0000000-0000-4000-8000-000000000004',
   'Sumar y restar fracciones',
   'Sumar y restar fracciones con igual y con distinto denominador, y con un entero.',
   2, 4),
  ('c4000000-0000-4000-8000-000000000405', null, 'c0000000-0000-4000-8000-000000000004',
   'Multiplicar y dividir fracciones',
   'Multiplicar y dividir fracciones, y calcular la fracción de una fracción.',
   2, 5),
  ('c4000000-0000-4000-8000-000000000406', null, 'c0000000-0000-4000-8000-000000000004',
   'Resolver operaciones combinadas con fracciones',
   'Aplicar la jerarquía de operaciones en expresiones con fracciones, con y sin paréntesis.',
   2, 6),
  ('c4000000-0000-4000-8000-000000000407', null, 'c0000000-0000-4000-8000-000000000004',
   'Resolver problemas con fracciones',
   'Resolver problemas de la fracción de una cantidad, de lo que queda y del total.',
   2, 7)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000401', 'c1000000-0000-4000-8000-000000000401'),
  ('c4000000-0000-4000-8000-000000000402', 'c1000000-0000-4000-8000-000000000402'),
  ('c4000000-0000-4000-8000-000000000402', 'c1000000-0000-4000-8000-000000000403'),
  ('c4000000-0000-4000-8000-000000000403', 'c1000000-0000-4000-8000-000000000404'),
  ('c4000000-0000-4000-8000-000000000404', 'c1000000-0000-4000-8000-000000000405'),
  ('c4000000-0000-4000-8000-000000000405', 'c1000000-0000-4000-8000-000000000406'),
  ('c4000000-0000-4000-8000-000000000406', 'c1000000-0000-4000-8000-000000000407'),
  ('c4000000-0000-4000-8000-000000000407', 'c1000000-0000-4000-8000-000000000401'),
  ('c4000000-0000-4000-8000-000000000407', 'c1000000-0000-4000-8000-000000000408')
on conflict (objetivo_id, concepto_id) do nothing;
