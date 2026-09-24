-- 136_semilla_potencias_raices_1eso.sql
-- EL TERCER TEMA DEL CATÁLOGO: Potencias y raíces, 1.º ESO de Matemáticas.
-- 1 tema, 7 conceptos, 10 errores típicos, 14 arquetipos y 4 objetivos.
--
-- Solo DATOS, catálogo común (`tenant_id` NULL), idempotente. Mismo formato
-- que la 135 (Divisibilidad); el tema va en la tercera cifra por la cola de
-- cada identificador (…0003NN).
--
-- LOS SABERES, del anexo de Matemáticas de 1.º ESO de Aragón (ORDEN
-- ECD/1172/2022):
--   A.2 «Números grandes y pequeños: notación exponencial y científica…»
--       → potencias de 10 y notación científica (conceptos 2 y 3);
--   A.3 «Propiedades de las operaciones (… potenciación)» → potencias y sus
--       propiedades (1, 4 y 5); y «Relaciones inversas entre las operaciones
--       (… elevar al cuadrado y extraer la raíz cuadrada)» → raíces (6 y 7).
--
-- LO QUE SE QUEDA FUERA, A PROPÓSITO:
--   - los números PEQUEÑOS en notación científica (3,4 · 10⁻⁴): necesitan
--     exponentes negativos, que no se han dado cuando se ve este tema;
--   - las operaciones combinadas con potencias y raíces: el motor de
--     expresiones no tiene todavía la raíz, y una combinada sin raíces ya
--     está en el tema de enteros.
--
-- LOS ERRORES: todos `hipotesis` (de la bibliografía y los materiales, no
-- vistos aún en nuestros alumnos), salvo los dos estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000003', null, 'Matemáticas', '1.º ESO',
   'Potencias y raíces', 'aragon', array['A.2', 'A.3'], 2)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000301', null, 'c0000000-0000-4000-8000-000000000003',
   'Potencias de base natural',
   'Una potencia es un producto de factores iguales: la base es el factor y el exponente, cuántas veces se repite. No es la base por el exponente.',
   'A.3', false, 1),
  ('c1000000-0000-4000-8000-000000000302', null, 'c0000000-0000-4000-8000-000000000003',
   'Potencias de 10 y descomposición polinómica',
   '10 elevado a n es un 1 seguido de n ceros. Cualquier número se escribe como suma de sus cifras por potencias de 10.',
   'A.2', false, 2),
  ('c1000000-0000-4000-8000-000000000303', null, 'c0000000-0000-4000-8000-000000000003',
   'Notación científica de números grandes',
   'Un número entre 1 y 10 por una potencia de 10. El exponente es cuántos lugares se mueve la coma, no cuántas cifras tiene el número.',
   'A.2', false, 3),
  ('c1000000-0000-4000-8000-000000000304', null, 'c0000000-0000-4000-8000-000000000003',
   'Producto y cociente de potencias de la misma base',
   'Con la misma base, el producto suma los exponentes y el cociente los resta. La base no cambia.',
   'A.3', false, 4),
  ('c1000000-0000-4000-8000-000000000305', null, 'c0000000-0000-4000-8000-000000000003',
   'Potencia de una potencia',
   'Elevar una potencia a otro exponente multiplica los exponentes.',
   'A.3', false, 5),
  ('c1000000-0000-4000-8000-000000000306', null, 'c0000000-0000-4000-8000-000000000003',
   'Raíz cuadrada exacta',
   'El número que multiplicado por sí mismo da el radicando. Es la operación inversa de elevar al cuadrado.',
   'A.3', false, 6),
  ('c1000000-0000-4000-8000-000000000307', null, 'c0000000-0000-4000-8000-000000000003',
   'Raíz cuadrada entera y resto',
   'Si el número no es un cuadrado, la raíz entera es el mayor número cuyo cuadrado no lo pasa, y el resto es lo que falta hasta el número desde ese cuadrado.',
   'A.3', false, 7)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000301', null, 'c1000000-0000-4000-8000-000000000301',
   'Multiplicar la base por el exponente',
   'Lee la potencia como un producto de la base por el exponente.',
   'conceptual', true, 'hipotesis', '2⁵ = 10', '2⁵ = 2 · 2 · 2 · 2 · 2 = 32', 1),
  ('c2000000-0000-4000-8000-000000000302', null, 'c1000000-0000-4000-8000-000000000304',
   'Multiplicar los exponentes en el producto de potencias',
   'Confunde la regla del producto con la de la potencia de una potencia.',
   'procedimiento', true, 'hipotesis', '3⁴ · 3² = 3⁸', '3⁴ · 3² = 3⁶', 2),
  ('c2000000-0000-4000-8000-000000000303', null, 'c1000000-0000-4000-8000-000000000304',
   'Multiplicar también las bases en el producto de potencias',
   'Suma bien los exponentes, pero multiplica las bases, que deberían quedarse igual.',
   'procedimiento', true, 'hipotesis', '3⁴ · 3² = 9⁶', '3⁴ · 3² = 3⁶', 3),
  ('c2000000-0000-4000-8000-000000000304', null, 'c1000000-0000-4000-8000-000000000304',
   'Dividir los exponentes en el cociente de potencias',
   'Aplica al cociente la división en vez de la resta. Parece funcionar cuando un exponente es múltiplo del otro.',
   'procedimiento', true, 'hipotesis', '5⁸ : 5² = 5⁴', '5⁸ : 5² = 5⁶', 4),
  ('c2000000-0000-4000-8000-000000000305', null, 'c1000000-0000-4000-8000-000000000305',
   'Sumar los exponentes en la potencia de una potencia',
   'Confunde la potencia de una potencia con el producto de potencias.',
   'procedimiento', true, 'hipotesis', '(2³)⁴ = 2⁷', '(2³)⁴ = 2¹²', 5),
  ('c2000000-0000-4000-8000-000000000306', null, 'c1000000-0000-4000-8000-000000000303',
   'Poner de exponente el número de cifras',
   'En notación científica cuenta todas las cifras del número en vez de los lugares que se mueve la coma.',
   'procedimiento', true, 'hipotesis', '4 500 000 = 4,5 · 10⁷', '4 500 000 = 4,5 · 10⁶', 6),
  ('c2000000-0000-4000-8000-000000000307', null, 'c1000000-0000-4000-8000-000000000306',
   'Confundir la raíz cuadrada con la mitad',
   'Divide entre 2 en vez de buscar el número que multiplicado por sí mismo da el radicando.',
   'conceptual', true, 'hipotesis', '√16 = 8', '√16 = 4', 7),
  ('c2000000-0000-4000-8000-000000000308', null, 'c1000000-0000-4000-8000-000000000307',
   'Calcular el resto restando la raíz y no su cuadrado',
   'Encuentra bien la raíz entera y luego resta la raíz al número.',
   'procedimiento', true, 'hipotesis', '√50: raíz 7, resto 43', '√50: raíz 7, resto 50 − 49 = 1', 8),
  ('c2000000-0000-4000-8000-000000000309', null, 'c1000000-0000-4000-8000-000000000301',
   'Método bien, cálculo mal',
   'Aplica bien la propiedad y se equivoca multiplicando. No es un error de potencias.',
   'operacion', false, 'estructural', '3⁴ = 3 · 3 · 3 · 3 = 71', '3⁴ = 81', 9),
  ('c2000000-0000-4000-8000-000000000310', null, 'c1000000-0000-4000-8000-000000000301',
   'Descuido: copia mal un exponente',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '2⁵ · 2³ = 2⁹', '2⁵ · 2³ = 2⁸', 10)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  -- Potencias
  ('c3000000-0000-4000-8000-000000000301', null, 'c1000000-0000-4000-8000-000000000301',
   'Escribe el producto como una potencia',
   'De 5 a 7 productos de factores iguales, de 2 a 7 factores, con alguno de base 10.',
   '7 · 7 · 7 · 7 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000302', null, 'c1000000-0000-4000-8000-000000000301',
   'Calcula el valor de la potencia',
   'De 6 a 8 potencias que salen de cabeza (sin calculadora), siempre una de exponente 1 y una de base 10. Casi nunca 2², donde el error de multiplicar base por exponente no se ve.',
   '3⁴ = ___ / 10⁵ = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000303', null, 'c1000000-0000-4000-8000-000000000301',
   'Halla la base o el exponente que falta',
   'De 4 a 6, la mitad con el hueco en el exponente y la mitad en la base. La operación inversa.',
   '2^□ = 32 / □³ = 125', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000314', null, 'c1000000-0000-4000-8000-000000000301',
   'Compara las potencias con <, > o =',
   'De 4 a 6 parejas, la mitad con base y exponente cambiados (2⁵ y 5²): quien multiplica base por exponente ve dos números iguales. Alguna pareja igual de verdad (2⁴ = 4²). Hasta 2000.',
   '2⁵ ___ 5² / 3⁴ ___ 4³', 'ejercicio', 2, false, 'activo'),
  -- Potencias de 10 y notación científica
  ('c3000000-0000-4000-8000-000000000304', null, 'c1000000-0000-4000-8000-000000000302',
   'Pasa de potencia de 10 a número y al revés',
   'De 5 a 7, mitad en cada sentido, exponentes del 2 al 9.',
   '10⁶ = ___ / 100 000 = 10^□', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000305', null, 'c1000000-0000-4000-8000-000000000302',
   'Escribe el número con potencias de 10',
   'De 3 a 4 números de 4 a 6 cifras, siempre con algún 0 en medio. Las unidades sin potencia.',
   '30 507 = 3 · 10⁴ + 5 · 10² + 7', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000306', null, 'c1000000-0000-4000-8000-000000000303',
   'Pasa a notación científica y al revés',
   'De 4 a 6, mitad en cada sentido. Solo números grandes (exponente del 3 al 9); los pequeños necesitan exponentes negativos y no entran. Mantisa de 1 a 3 cifras.',
   '4 500 000 = ___ / 3,07 · 10⁵ = ___', 'ejercicio', 2, false, 'activo'),
  -- Propiedades
  ('c3000000-0000-4000-8000-000000000307', null, 'c1000000-0000-4000-8000-000000000304',
   'Escribe el producto como una sola potencia',
   'De 5 a 7 productos de dos potencias de la misma base. El resultado como potencia, no su valor.',
   '3⁴ · 3² = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000308', null, 'c1000000-0000-4000-8000-000000000304',
   'Escribe el cociente como una sola potencia',
   'De 5 a 7, la mitad con el exponente de arriba múltiplo del de abajo (donde dividir exponentes parece funcionar). Resultado con exponente 2 o más.',
   '5⁸ : 5² = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000309', null, 'c1000000-0000-4000-8000-000000000305',
   'Escribe la potencia de una potencia como una sola potencia',
   'De 4 a 6. Nunca exponentes 2 y 2 (sumar y multiplicar dan lo mismo).',
   '(2³)⁴ = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000310', null, 'c1000000-0000-4000-8000-000000000305',
   'Aplica las propiedades de las potencias en una misma expresión',
   'De 3 a 4 expresiones con producto, cociente y potencia de potencia de la misma base. Exponente final del 2 al 12. El ejemplo va paso a paso.',
   '(2³)² · 2⁴ : 2⁵ = ___', 'ejercicio', 3, false, 'activo'),
  -- Raíces
  ('c3000000-0000-4000-8000-000000000311', null, 'c1000000-0000-4000-8000-000000000306',
   'Calcula la raíz cuadrada exacta',
   'De 6 a 8 cuadrados perfectos: del 3² al 15² y alguno de decenas redondas (√3600). Nunca √4, donde la mitad y la raíz coinciden.',
   '√144 = ___ / √4900 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000312', null, 'c1000000-0000-4000-8000-000000000307',
   'Di entre qué dos números naturales está la raíz',
   'De 4 a 6 números que no son cuadrados, hasta el 250.',
   '√70 está entre ___ y ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000313', null, 'c1000000-0000-4000-8000-000000000307',
   'Calcula la raíz cuadrada entera y el resto',
   'De 4 a 6 números que no son cuadrados, hasta el 250.',
   '√50: raíz ___, resto ___', 'ejercicio', 2, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000301', null, 'c0000000-0000-4000-8000-000000000003',
   'Calcular potencias de números naturales',
   'Escribir productos de factores iguales como potencias, calcular su valor y hallar la base o el exponente que falta.',
   2, 1),
  ('c4000000-0000-4000-8000-000000000302', null, 'c0000000-0000-4000-8000-000000000003',
   'Usar las potencias de 10 y la notación científica',
   'Pasar de potencia de 10 a número, descomponer un número en potencias de 10 y escribir números grandes en notación científica.',
   2, 2),
  ('c4000000-0000-4000-8000-000000000303', null, 'c0000000-0000-4000-8000-000000000003',
   'Operar con potencias de la misma base',
   'Aplicar el producto, el cociente y la potencia de una potencia, por separado y juntos.',
   2, 3),
  ('c4000000-0000-4000-8000-000000000304', null, 'c0000000-0000-4000-8000-000000000003',
   'Calcular raíces cuadradas',
   'Calcular raíces cuadradas exactas, la raíz entera y su resto, y situar una raíz entre dos naturales.',
   1, 4)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000301', 'c1000000-0000-4000-8000-000000000301'),
  ('c4000000-0000-4000-8000-000000000302', 'c1000000-0000-4000-8000-000000000302'),
  ('c4000000-0000-4000-8000-000000000302', 'c1000000-0000-4000-8000-000000000303'),
  ('c4000000-0000-4000-8000-000000000303', 'c1000000-0000-4000-8000-000000000304'),
  ('c4000000-0000-4000-8000-000000000303', 'c1000000-0000-4000-8000-000000000305'),
  ('c4000000-0000-4000-8000-000000000304', 'c1000000-0000-4000-8000-000000000306'),
  ('c4000000-0000-4000-8000-000000000304', 'c1000000-0000-4000-8000-000000000307')
on conflict (objetivo_id, concepto_id) do nothing;
