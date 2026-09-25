-- 140_semilla_decimales_1eso.sql
-- EL SÉPTIMO TEMA DEL CATÁLOGO: Números decimales, 1.º ESO de Matemáticas.
-- 1 tema, 8 conceptos, 12 errores típicos, 15 arquetipos y 5 objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0007NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO):
--   A.2 «Números enteros, fraccionarios y decimales … en la expresión de
--       cantidades», «Diferentes formas de representación…» y «Realización
--       de estimaciones con la precisión requerida» (redondear);
--   A.3 «Operaciones con … decimales en situaciones contextualizadas» y
--       «Efecto de las operaciones aritméticas con … expresiones
--       decimales» (multiplicar por 0,5 hace más pequeño);
--   A.4 «Comparación y ordenación de fracciones, decimales y porcentajes».
--
-- LA ARITMÉTICA ES EXACTA: cada decimal es un entero y su número de cifras
-- decimales, nunca la coma flotante de JavaScript (0,1 + 0,2 = 0,3).
--
-- LO QUE SE QUEDA FUERA, y por qué:
--   - los decimales en la recta numérica: necesitan figura, y la recta del
--     tema de enteros no tiene todavía marcas decimales;
--   - los decimales periódicos y su fracción generatriz: la secuencia
--     habitual los deja para 2.º, y el anexo de 1.º no los nombra;
--   - las divisiones con cociente aproximado: todas son exactas, para que
--     la hoja se corrija sin discutir cuántas cifras sacar.
--
-- LOS ERRORES: los 10 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000007', null, 'Matemáticas', '1.º ESO',
   'Números decimales', 'aragon', array['A.2', 'A.3', 'A.4'], 5)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000701', null, 'c0000000-0000-4000-8000-000000000007',
   'Valor posicional de los decimales',
   'Detrás de la coma, décimas, centésimas y milésimas. Leer, escribir con cifras y descomponer: cinco centésimas es 0,05.',
   'A.2', false, 1),
  ('c1000000-0000-4000-8000-000000000702', null, 'c0000000-0000-4000-8000-000000000007',
   'Fracciones y decimales',
   'Una fracción decimal se escribe moviendo la coma (7/100 = 0,07); las demás, dividiendo (3/4 = 0,75).',
   'A.2', false, 2),
  ('c1000000-0000-4000-8000-000000000703', null, 'c0000000-0000-4000-8000-000000000007',
   'Comparar y ordenar decimales',
   'Se comparan con el mismo número de cifras decimales, completando con ceros: 3,4 = 3,400 > 3,125.',
   'A.4', false, 3),
  ('c1000000-0000-4000-8000-000000000704', null, 'c0000000-0000-4000-8000-000000000007',
   'Aproximar y redondear',
   'Para redondear se mira la cifra siguiente: si es 5 o más, se sube uno.',
   'A.2', false, 4),
  ('c1000000-0000-4000-8000-000000000705', null, 'c0000000-0000-4000-8000-000000000007',
   'Sumar y restar decimales',
   'Coma debajo de coma, completando con ceros; a un entero se le pone la coma y los ceros que hagan falta.',
   'A.3', false, 5),
  ('c1000000-0000-4000-8000-000000000706', null, 'c0000000-0000-4000-8000-000000000007',
   'Multiplicar y dividir decimales',
   'Por 10, 100 o 1000 se mueve la coma. Al multiplicar, tantos decimales como los dos factores juntos. Para dividir entre un decimal, se multiplican los dos por la unidad seguida de ceros.',
   'A.3', false, 6),
  ('c1000000-0000-4000-8000-000000000707', null, 'c0000000-0000-4000-8000-000000000007',
   'El efecto de multiplicar y dividir',
   'Multiplicar por un número menor que 1 da un resultado más pequeño, y dividir entre él, más grande.',
   'A.3', false, 7),
  ('c1000000-0000-4000-8000-000000000708', null, 'c0000000-0000-4000-8000-000000000007',
   'Problemas con decimales',
   'Compras, medidas y repartos: decidir la operación y hacerla con decimales.',
   'A.3', false, 8)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000701', null, 'c1000000-0000-4000-8000-000000000703',
   'Creer que más cifras decimales es más grande',
   'Compara las partes decimales como si fueran números enteros.',
   'conceptual', true, 'hipotesis', '3,125 > 3,4; 0,50 > 0,5', '3,125 < 3,4; 0,50 = 0,5', 1),
  ('c2000000-0000-4000-8000-000000000702', null, 'c1000000-0000-4000-8000-000000000701',
   'Confundir las posiciones decimales',
   'Escribe la parte decimal sin los ceros que le tocan, o confunde décimas y centésimas.',
   'conceptual', true, 'hipotesis', 'Tres unidades y cinco centésimas: 3,5', '3,05', 2),
  ('c2000000-0000-4000-8000-000000000703', null, 'c1000000-0000-4000-8000-000000000704',
   'Redondear cortando',
   'Quita las cifras que sobran sin mirar la siguiente.',
   'procedimiento', true, 'hipotesis', '3,47 a las décimas: 3,4', '3,5', 3),
  ('c2000000-0000-4000-8000-000000000704', null, 'c1000000-0000-4000-8000-000000000705',
   'Alinear a la derecha y no por la coma',
   'Coloca los números como si fueran enteros.',
   'procedimiento', true, 'hipotesis', '2,5 + 1,25 = 1,50', '3,75', 4),
  ('c2000000-0000-4000-8000-000000000705', null, 'c1000000-0000-4000-8000-000000000705',
   'Al restar a un entero, bajar los decimales',
   'Resta las partes enteras y deja las cifras decimales como están.',
   'procedimiento', true, 'hipotesis', '5 − 1,25 = 4,25', '3,75', 5),
  ('c2000000-0000-4000-8000-000000000706', null, 'c1000000-0000-4000-8000-000000000706',
   'Poner los decimales de un solo factor',
   'Al multiplicar, deja en el resultado los decimales del factor que más tiene.',
   'procedimiento', true, 'hipotesis', '0,3 · 0,2 = 0,6', '0,06', 6),
  ('c2000000-0000-4000-8000-000000000707', null, 'c1000000-0000-4000-8000-000000000706',
   'Por 10 añadir un cero; entre 10, mover la coma al revés',
   'Aplica la regla de los enteros (añadir ceros) o mueve la coma hacia el lado equivocado.',
   'procedimiento', true, 'hipotesis', '3,4 · 10 = 3,40; 3,4 : 10 = 34', '34; 0,34', 7),
  ('c2000000-0000-4000-8000-000000000708', null, 'c1000000-0000-4000-8000-000000000706',
   'Dividir entre un decimal sin mover la coma del dividendo',
   'Quita la coma del divisor y deja el dividendo igual.',
   'procedimiento', true, 'hipotesis', '8 : 0,4 = 8 : 4 = 2', '80 : 4 = 20', 8),
  ('c2000000-0000-4000-8000-000000000709', null, 'c1000000-0000-4000-8000-000000000707',
   'Creer que multiplicar siempre hace más grande',
   'Y que dividir siempre hace más pequeño, también con números menores que 1.',
   'conceptual', true, 'hipotesis', '8 · 0,5 es mayor que 8', 'menor: es la mitad', 9),
  ('c2000000-0000-4000-8000-000000000710', null, 'c1000000-0000-4000-8000-000000000702',
   'Escribir la fracción con la coma entre numerador y denominador',
   'Lee la raya de fracción como si fuera la coma.',
   'conceptual', true, 'hipotesis', '3/4 = 3,4', '0,75', 10),
  ('c2000000-0000-4000-8000-000000000711', null, 'c1000000-0000-4000-8000-000000000706',
   'Método bien, cuenta mal',
   'Coloca bien la coma y se equivoca en una operación con enteros. No es un error de decimales.',
   'operacion', false, 'estructural', '1,6 · 2,1 = 3,26', '3,36', 11),
  ('c2000000-0000-4000-8000-000000000712', null, 'c1000000-0000-4000-8000-000000000705',
   'Descuido: pierde la coma al copiar',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '2,5 copiado como 25', '2,5', 12)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000701', null, 'c1000000-0000-4000-8000-000000000701',
   'Di qué cifra ocupa cada posición decimal',
   'De 6 a 8 números con tres decimales y cuatro cifras distintas.',
   '3,472: centésimas, ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000702', null, 'c1000000-0000-4000-8000-000000000701',
   'Escribe con cifras el número decimal',
   'De 4 a 6 números en letra; la mitad con ceros detrás de la coma (cinco centésimas).',
   'Tres unidades y cinco centésimas: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000703', null, 'c1000000-0000-4000-8000-000000000701',
   'Descompón el número decimal en unidades, décimas, centésimas y milésimas',
   'De 4 a 6 números con dos o tres decimales, a menudo con un cero en medio.',
   '4,305 = 4 U + 3 d + 5 m', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000704', null, 'c1000000-0000-4000-8000-000000000702',
   'Escribe la fracción como número decimal',
   'De 6 a 8: la mitad fracciones decimales (7/100) y la mitad sencillas (3/4, 1/8).',
   '7/100 = ___; 3/4 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000705', null, 'c1000000-0000-4000-8000-000000000703',
   'Compara los números decimales con <, > o =',
   'De 6 a 8 parejas; casi todas con la misma parte entera y el de más cifras NO mayor, y una del tipo 0,5 y 0,50.',
   '3,4 □ 3,125', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000706', null, 'c1000000-0000-4000-8000-000000000703',
   'Ordena los números decimales de menor a mayor',
   'De 2 a 3 listas de cinco números con la misma parte entera y distinto número de cifras decimales.',
   '4,7; 4,052; 4,14; 4,6; 4,28', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000707', null, 'c1000000-0000-4000-8000-000000000704',
   'Redondea el número decimal',
   'De 5 a 7, a las unidades, décimas o centésimas; la mitad hacia arriba, alguna con un 9 que se lleva una.',
   '2,96 a las décimas: ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000708', null, 'c1000000-0000-4000-8000-000000000705',
   'Suma números decimales',
   'De 6 a 8 sumas con distinto número de decimales en cada sumando.',
   '2,5 + 1,25 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000709', null, 'c1000000-0000-4000-8000-000000000705',
   'Resta números decimales',
   'De 6 a 8; un tercio restan a un número entero.',
   '5 − 1,25 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000710', null, 'c1000000-0000-4000-8000-000000000706',
   'Multiplica y divide por 10, 100 y 1000',
   'De 6 a 8, mitad por y mitad entre.',
   '3,4 · 100 = ___; 3,4 : 100 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000711', null, 'c1000000-0000-4000-8000-000000000706',
   'Multiplica números decimales',
   'De 5 a 7, decimal por entero y decimal por decimal, con un factor de una o dos cifras.',
   '0,3 · 0,2 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000712', null, 'c1000000-0000-4000-8000-000000000706',
   'Divide números decimales',
   'De 5 a 7, todas exactas: la mitad un decimal entre un entero y la mitad entre un decimal.',
   '18,6 : 4 = ___; 8 : 0,4 = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000713', null, 'c1000000-0000-4000-8000-000000000707',
   'Decide sin calcular si el resultado es mayor o menor',
   'De 6 a 8, mitad con un número menor que 1 y mitad con uno mayor, multiplicando y dividiendo.',
   '8 · 0,5 es ___ que 8', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000714', null, 'c1000000-0000-4000-8000-000000000708',
   'Resuelve problemas de compras y medidas con decimales',
   'De 3 a 4, de contextos distintos: la vuelta de una compra, precio por kilo, saltos, cuerdas, gasolina.',
   'Compras un zumo de 1,20 €, un bocadillo de 2,35 € y una fruta de 0,75 €. Pagas con 5 €. ¿Cuánto te devuelven?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000715', null, 'c1000000-0000-4000-8000-000000000708',
   'Resuelve problemas de repartos con decimales',
   'De 3 a 4, de contextos distintos: pagar a partes iguales, vasos de una botella, etapas, trozos de cinta, precio de una unidad.',
   '¿Cuántos vasos de 0,25 litros se llenan con una botella de 1,5 litros?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000701', null, 'c0000000-0000-4000-8000-000000000007',
   'Leer, escribir y descomponer números decimales',
   'El valor de cada cifra, escribir con cifras y pasar fracciones a decimal.',
   2, 1),
  ('c4000000-0000-4000-8000-000000000702', null, 'c0000000-0000-4000-8000-000000000007',
   'Comparar, ordenar y redondear números decimales',
   'Comparar con el mismo número de cifras decimales y redondear mirando la cifra siguiente.',
   2, 2),
  ('c4000000-0000-4000-8000-000000000703', null, 'c0000000-0000-4000-8000-000000000007',
   'Sumar y restar números decimales',
   'Coma debajo de coma, también restando a un entero.',
   1, 3),
  ('c4000000-0000-4000-8000-000000000704', null, 'c0000000-0000-4000-8000-000000000007',
   'Multiplicar y dividir números decimales',
   'Por la unidad seguida de ceros, multiplicar, dividir y el efecto de hacerlo con números menores que 1.',
   3, 4),
  ('c4000000-0000-4000-8000-000000000705', null, 'c0000000-0000-4000-8000-000000000007',
   'Resolver problemas con números decimales',
   'Compras, medidas y repartos.',
   2, 5)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000701', 'c1000000-0000-4000-8000-000000000701'),
  ('c4000000-0000-4000-8000-000000000701', 'c1000000-0000-4000-8000-000000000702'),
  ('c4000000-0000-4000-8000-000000000702', 'c1000000-0000-4000-8000-000000000703'),
  ('c4000000-0000-4000-8000-000000000702', 'c1000000-0000-4000-8000-000000000704'),
  ('c4000000-0000-4000-8000-000000000703', 'c1000000-0000-4000-8000-000000000705'),
  ('c4000000-0000-4000-8000-000000000704', 'c1000000-0000-4000-8000-000000000706'),
  ('c4000000-0000-4000-8000-000000000704', 'c1000000-0000-4000-8000-000000000707'),
  ('c4000000-0000-4000-8000-000000000705', 'c1000000-0000-4000-8000-000000000708')
on conflict (objetivo_id, concepto_id) do nothing;
