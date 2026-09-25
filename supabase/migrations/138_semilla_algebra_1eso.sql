-- 138_semilla_algebra_1eso.sql
-- EL QUINTO TEMA DEL CATÁLOGO: Álgebra, 1.º ESO de Matemáticas.
-- 1 tema, 8 conceptos, 11 errores típicos, 15 arquetipos y 6 objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0005NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO, sentido algebraico):
--   D.1 «Patrones, pautas y regularidades: … regla de formación en casos
--       sencillos» → secuencias;
--   D.2 «Modelización de situaciones de la vida cotidiana usando … el
--       lenguaje algebraico» → traducir y los problemas;
--   D.3 «Variable: comprensión del concepto…» → el valor numérico;
--   D.4 «Equivalencia de expresiones algebraicas…» → reducir; y
--       «Estrategias de búsqueda de soluciones en ecuaciones…» → ecuaciones.
--
-- EL CURRÍCULO Y EL AULA NO COINCIDEN, y manda el aula: D.4 habla de
-- «resolución mediante el uso de la tecnología», y en 1.º no se deja
-- calculadora (Jorge, 17/9, claude/algebra-1eso-metodo.md). Por eso todas
-- las ecuaciones tienen solución entera y pequeña, y el método de los
-- ejemplos es la transposición.
--
-- EL ALCANCE LO ELIGE EL PROFESOR: Jorge cerró el método pero no hasta
-- dónde llegan las ecuaciones en 1.º. Aquí van por objetivos de menos a
-- más (un paso; dos pasos y la x en los dos lados; paréntesis como
-- dificultad 3), y cada centro monta hojas del objetivo que dé.
--
-- LOS ERRORES: los 9 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000005', null, 'Matemáticas', '1.º ESO',
   'Álgebra', 'aragon', array['D.1', 'D.2', 'D.3', 'D.4'], 9)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000501', null, 'c0000000-0000-4000-8000-000000000005',
   'Lenguaje algebraico',
   'Traducir un enunciado a una expresión con letras: el doble de un número es 2x; el doble de la suma de un número y 3 es 2(x + 3).',
   'D.2', false, 1),
  ('c1000000-0000-4000-8000-000000000502', null, 'c0000000-0000-4000-8000-000000000005',
   'Valor numérico de una expresión',
   'Sustituir la letra por un número y calcular, respetando la jerarquía: 3x es 3 por x, y x² es x por x.',
   'D.3', false, 2),
  ('c1000000-0000-4000-8000-000000000503', null, 'c0000000-0000-4000-8000-000000000005',
   'Reducir expresiones algebraicas',
   'Sumar los términos semejantes (las x con las x, los números con los números) y quitar paréntesis multiplicando todos los términos de dentro.',
   'D.4', false, 3),
  ('c1000000-0000-4000-8000-000000000504', null, 'c0000000-0000-4000-8000-000000000005',
   'Secuencias y su regla',
   'En una secuencia lineal se suma siempre lo mismo; su regla es dn + b, y con ella se calcula cualquier término sin escribir los anteriores.',
   'D.1', false, 4),
  ('c1000000-0000-4000-8000-000000000505', null, 'c0000000-0000-4000-8000-000000000005',
   'Ecuaciones de un paso',
   'Una solución es el número que hace cierta la igualdad. x + a = b y ax = b se resuelven pasando un término al otro miembro con la operación contraria.',
   'D.4', false, 5),
  ('c1000000-0000-4000-8000-000000000506', null, 'c0000000-0000-4000-8000-000000000005',
   'Ecuaciones de primer grado',
   'ax + b = c y ax + b = cx + d: primero las x a un lado y los números al otro, después se despeja.',
   'D.4', false, 6),
  ('c1000000-0000-4000-8000-000000000507', null, 'c0000000-0000-4000-8000-000000000005',
   'Ecuaciones con paréntesis',
   'Se quita primero el paréntesis, multiplicando todos los términos de dentro, y después se resuelve como las demás.',
   'D.4', false, 7),
  ('c1000000-0000-4000-8000-000000000508', null, 'c0000000-0000-4000-8000-000000000005',
   'Problemas con ecuaciones',
   'Decidir qué es la x, escribir la ecuación que dice el enunciado, resolverla y contestar lo que se pregunta.',
   'D.2', false, 8)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000501', null, 'c1000000-0000-4000-8000-000000000501',
   'Olvidar el paréntesis en "el doble de la suma"',
   'Traduce la frase palabra por palabra y el doble se queda solo en la x.',
   'interpretacion', true, 'hipotesis', 'El doble de la suma de un número y 3: 2x + 3', '2(x + 3)', 1),
  ('c2000000-0000-4000-8000-000000000502', null, 'c1000000-0000-4000-8000-000000000502',
   'Pegar el coeficiente y el número',
   'Lee 3x como un número de dos cifras al sustituir.',
   'conceptual', true, 'hipotesis', '3x con x = 4: 34', '3 · 4 = 12', 2),
  ('c2000000-0000-4000-8000-000000000503', null, 'c1000000-0000-4000-8000-000000000503',
   'Juntar términos que no son semejantes',
   'Suma las x con los números como si fueran lo mismo.',
   'conceptual', true, 'hipotesis', '3x + 5 = 8x', '3x + 5 no se puede reducir más', 3),
  ('c2000000-0000-4000-8000-000000000504', null, 'c1000000-0000-4000-8000-000000000503',
   'Multiplicar solo el primer término del paréntesis',
   'Al quitar el paréntesis, el número de fuera multiplica a la x y se olvida del resto.',
   'procedimiento', true, 'hipotesis', '2(x + 3) = 2x + 3', '2(x + 3) = 2x + 6', 4),
  ('c2000000-0000-4000-8000-000000000505', null, 'c1000000-0000-4000-8000-000000000505',
   'Pasar un término sin cambiarle el signo',
   'Lo cambia de lado pero no de operación.',
   'signo', true, 'hipotesis', 'x + 6 = 14 → x = 14 + 6 = 20', 'x = 14 − 6 = 8', 5),
  ('c2000000-0000-4000-8000-000000000506', null, 'c1000000-0000-4000-8000-000000000505',
   'Pasar restando lo que multiplica',
   'Aplica a un coeficiente la regla de los términos que suman.',
   'procedimiento', true, 'hipotesis', '3x = 12 → x = 12 − 3 = 9', 'x = 12 : 3 = 4', 6),
  ('c2000000-0000-4000-8000-000000000507', null, 'c1000000-0000-4000-8000-000000000506',
   'Dividir antes de pasar el término',
   'En ax + b = c divide solo el segundo miembro entre a y después pasa b.',
   'procedimiento', true, 'hipotesis', '3x + 6 = 15 → x = 15 : 3 − 6 = −1', '3x = 9, x = 3', 7),
  ('c2000000-0000-4000-8000-000000000508', null, 'c1000000-0000-4000-8000-000000000507',
   'Quitar el paréntesis de una ecuación multiplicando solo el primer término',
   'El mismo error de reducir expresiones, dentro de una ecuación.',
   'procedimiento', true, 'hipotesis', '2(x + 3) = 14 → 2x + 3 = 14', '2x + 6 = 14', 8),
  ('c2000000-0000-4000-8000-000000000509', null, 'c1000000-0000-4000-8000-000000000502',
   'Calcular x² como el doble de x',
   'Confunde elevar al cuadrado con multiplicar por dos.',
   'conceptual', true, 'hipotesis', 'x² con x = 5: 10', '5² = 25', 9),
  ('c2000000-0000-4000-8000-000000000510', null, 'c1000000-0000-4000-8000-000000000506',
   'Método bien, cuenta mal',
   'Transpone bien y se equivoca en una operación con enteros. No es un error de álgebra.',
   'operacion', false, 'estructural', '3x = 12 − 5 = 6', '3x = 7', 10),
  ('c2000000-0000-4000-8000-000000000511', null, 'c1000000-0000-4000-8000-000000000506',
   'Descuido: pierde un signo al copiar',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '2x − 3 = 7 copiado como 2x + 3 = 7', '2x − 3 = 7', 11)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000501', null, 'c1000000-0000-4000-8000-000000000501',
   'Traduce el enunciado al lenguaje algebraico',
   'De 6 a 8 frases escritas a mano, siempre con la pareja "el doble de un número, más k" / "el doble de la suma de un número y k". Hay formas equivalentes correctas (x + 5 y 5 + x): se corrige mirando, no comparando texto.',
   'El doble de la suma de un número y 3: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000502', null, 'c1000000-0000-4000-8000-000000000502',
   'Calcula el valor numérico de la expresión',
   'De 6 a 8: ax + b y alguna x² + b, con la x casi siempre positiva y alguna negativa.',
   '3x − 2 para x = 4: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000503', null, 'c1000000-0000-4000-8000-000000000503',
   'Reduce sumando los términos semejantes',
   'De 5 a 7 expresiones de tres o cuatro términos, con x y sin x mezclados y en orden sorteado.',
   '3x + 5 − x + 2 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000504', null, 'c1000000-0000-4000-8000-000000000503',
   'Quita el paréntesis y reduce',
   'De 4 a 6: a(x ± b) ± cx ± d.',
   '2(x + 3) + 4x − 1 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000505', null, 'c1000000-0000-4000-8000-000000000504',
   'Escribe los dos términos siguientes de la secuencia',
   'De 4 a 6 secuencias lineales de cuatro términos; alguna baja.',
   '3, 7, 11, 15, ___, ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000506', null, 'c1000000-0000-4000-8000-000000000504',
   'Calcula un término lejano de la secuencia',
   'De 3 a 4: el término 10, 20, 30, 50 o 100, que no se alcanza contando.',
   '3, 7, 11, 15, … El término 20: ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000507', null, 'c1000000-0000-4000-8000-000000000504',
   'Escribe la regla de la secuencia (el término n)',
   'De 3 a 4 secuencias lineales; la regla es dn + b con b distinto de 0.',
   '3, 7, 11, 15, … Término n: ___', 'ejercicio', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000508', null, 'c1000000-0000-4000-8000-000000000505',
   'Comprueba si el número es solución de la ecuación',
   'De 5 a 7, mitad sí y mitad no, con ecuaciones ax + b = c.',
   '¿Es x = 3 solución de 2x + 1 = 7? ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000509', null, 'c1000000-0000-4000-8000-000000000505',
   'Resuelve ecuaciones de un paso con sumas y restas',
   'De 6 a 8: x + a = b, x − a = b y a + x = b, con solución entera entre −5 y 15.',
   'x + 6 = 14', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000510', null, 'c1000000-0000-4000-8000-000000000505',
   'Resuelve ecuaciones de un paso con productos y cocientes',
   'De 6 a 8: ax = b y x/a = b, con solución entera.',
   '3x = 12 / x/4 = 5', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000511', null, 'c1000000-0000-4000-8000-000000000506',
   'Resuelve ecuaciones de la forma ax + b = c',
   'De 5 a 7 con solución entera, a veces negativa.',
   '3x + 5 = 20', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000512', null, 'c1000000-0000-4000-8000-000000000506',
   'Resuelve ecuaciones con la x en los dos miembros',
   'De 4 a 6: ax + b = cx + d con a mayor que c y solución entera.',
   '5x − 3 = 2x + 9', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000513', null, 'c1000000-0000-4000-8000-000000000507',
   'Resuelve ecuaciones con paréntesis',
   'De 3 a 4: a(x ± b) = c y a(x ± b) = cx + d, con solución entera.',
   '2(x + 3) = 14', 'ejercicio', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000514', null, 'c1000000-0000-4000-8000-000000000508',
   'Resuelve problemas de un número con una ecuación',
   'De 2 a 3, de contextos distintos (sumar a un número, el doble menos, cuadernos, la mitad más). Enunciados escritos a mano.',
   'El triple de un número menos 5 es 16. ¿Qué número es?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000515', null, 'c1000000-0000-4000-8000-000000000508',
   'Resuelve problemas de repartos y relaciones con una ecuación',
   'De 2 a 3, de contextos distintos (consecutivos, edades, rectángulo, cromos, hucha): hay que decidir qué es la x y contestar las dos cantidades.',
   'Ana tiene 5 años más que su hermano y entre los dos suman 29. ¿Cuántos años tiene cada uno?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000501', null, 'c0000000-0000-4000-8000-000000000005',
   'Usar el lenguaje algebraico y el valor numérico',
   'Traducir enunciados a expresiones algebraicas y calcular su valor numérico.',
   2, 1),
  ('c4000000-0000-4000-8000-000000000502', null, 'c0000000-0000-4000-8000-000000000005',
   'Reducir expresiones algebraicas',
   'Sumar términos semejantes y quitar paréntesis.',
   1, 2),
  ('c4000000-0000-4000-8000-000000000503', null, 'c0000000-0000-4000-8000-000000000005',
   'Encontrar la regla de una secuencia',
   'Continuar secuencias lineales, calcular términos lejanos y escribir su regla.',
   1, 3),
  ('c4000000-0000-4000-8000-000000000504', null, 'c0000000-0000-4000-8000-000000000005',
   'Resolver ecuaciones de un paso',
   'Comprobar soluciones y resolver ecuaciones con una sola operación.',
   2, 4),
  ('c4000000-0000-4000-8000-000000000505', null, 'c0000000-0000-4000-8000-000000000005',
   'Resolver ecuaciones de primer grado',
   'Resolver ecuaciones de dos pasos, con la x en los dos miembros y con paréntesis.',
   3, 5),
  ('c4000000-0000-4000-8000-000000000506', null, 'c0000000-0000-4000-8000-000000000005',
   'Resolver problemas con ecuaciones',
   'Plantear y resolver problemas mediante una ecuación de primer grado.',
   2, 6)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000501', 'c1000000-0000-4000-8000-000000000501'),
  ('c4000000-0000-4000-8000-000000000501', 'c1000000-0000-4000-8000-000000000502'),
  ('c4000000-0000-4000-8000-000000000502', 'c1000000-0000-4000-8000-000000000503'),
  ('c4000000-0000-4000-8000-000000000503', 'c1000000-0000-4000-8000-000000000504'),
  ('c4000000-0000-4000-8000-000000000504', 'c1000000-0000-4000-8000-000000000505'),
  ('c4000000-0000-4000-8000-000000000505', 'c1000000-0000-4000-8000-000000000506'),
  ('c4000000-0000-4000-8000-000000000505', 'c1000000-0000-4000-8000-000000000507'),
  ('c4000000-0000-4000-8000-000000000506', 'c1000000-0000-4000-8000-000000000508')
on conflict (objetivo_id, concepto_id) do nothing;
