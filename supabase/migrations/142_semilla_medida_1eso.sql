-- 142_semilla_medida_1eso.sql
-- EL NOVENO TEMA DEL CATÁLOGO: Sistema métrico decimal, 1.º ESO de
-- Matemáticas. 1 tema, 6 conceptos, 8 errores típicos, 10 arquetipos y 5
-- objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0009NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO, sentido de la medida):
--   B.1 Magnitud: «Atributos mensurables de los objetos…» y «Estrategias
--       de elección de las unidades y operaciones adecuadas en problemas
--       que impliquen medida»;
--   B.3 Estimación y relaciones: «Formulación de conjeturas sobre medidas…
--       basadas en estimaciones».
--   B.2 (ángulos, longitud de la circunferencia, áreas de figuras) NO está
--   aquí: es de geometría, y necesita figuras.
--
-- LA ARITMÉTICA ES LA DE LOS DECIMALES (exacta); los objetos de "estima" y
-- "elige la unidad" están escritos a mano con su medida real aproximada.
--
-- LO QUE SE QUEDA FUERA, y por qué:
--   - el volumen y su relación con la capacidad (1 dm³ = 1 L): la
--     secuencia habitual lo deja para 2.º, con los cuerpos geométricos;
--   - el tiempo (horas, minutos): no es decimal, y el anexo no lo nombra.
--
-- LOS ERRORES: los 6 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000009', null, 'Matemáticas', '1.º ESO',
   'Sistema métrico decimal', 'aragon', array['B.1', 'B.3'], 6)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000901', null, 'c0000000-0000-4000-8000-000000000009',
   'Magnitudes y unidades',
   'Longitud, masa, capacidad y superficie, y la unidad que conviene para cada objeto.',
   'B.1', false, 1),
  ('c1000000-0000-4000-8000-000000000902', null, 'c0000000-0000-4000-8000-000000000009',
   'Cambios de unidad',
   'En la escalera, cada escalón hacia abajo es por 10 y hacia arriba entre 10: se mueve la coma.',
   'B.1', false, 2),
  ('c1000000-0000-4000-8000-000000000903', null, 'c0000000-0000-4000-8000-000000000009',
   'Forma compleja e incompleja',
   'Pasar 3 km 4 hm 5 m a una sola unidad (3405 m) y sumar medidas en unidades distintas.',
   'B.1', false, 3),
  ('c1000000-0000-4000-8000-000000000904', null, 'c0000000-0000-4000-8000-000000000009',
   'Unidades de superficie',
   'En superficie cada escalón es por 100. Las medidas agrarias: 1 ha = 1 hm², 1 a = 1 dam².',
   'B.1', false, 4),
  ('c1000000-0000-4000-8000-000000000905', null, 'c0000000-0000-4000-8000-000000000009',
   'Estimación de medidas',
   'Decidir qué medida es razonable comparando con algo conocido.',
   'B.3', false, 5),
  ('c1000000-0000-4000-8000-000000000906', null, 'c0000000-0000-4000-8000-000000000009',
   'Problemas de medida',
   'Pasar a la misma unidad antes de operar.',
   'B.1', false, 6)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000901', null, 'c1000000-0000-4000-8000-000000000902',
   'Mover la coma al revés',
   'Divide cuando va a una unidad más pequeña, o multiplica cuando va a una más grande.',
   'procedimiento', true, 'hipotesis', '3,5 km = 0,0035 m', '3500 m', 1),
  ('c2000000-0000-4000-8000-000000000902', null, 'c1000000-0000-4000-8000-000000000902',
   'Contar mal los escalones',
   'Mueve la coma un lugar de menos.',
   'procedimiento', true, 'hipotesis', '3,5 km = 350 m', '3500 m', 2),
  ('c2000000-0000-4000-8000-000000000903', null, 'c1000000-0000-4000-8000-000000000904',
   'En superficie, un lugar por escalón',
   'Aplica la escalera de la longitud a la superficie.',
   'conceptual', true, 'hipotesis', '2 m² = 20 dm²', '200 dm²', 3),
  ('c2000000-0000-4000-8000-000000000904', null, 'c1000000-0000-4000-8000-000000000903',
   'Sumar medidas sin pasarlas a la misma unidad',
   'Suma los números tal cual aunque vayan en unidades distintas.',
   'conceptual', true, 'hipotesis', '2,5 km + 350 m = 352,5 m', '2850 m', 4),
  ('c2000000-0000-4000-8000-000000000905', null, 'c1000000-0000-4000-8000-000000000902',
   'Comparar los números sin mirar la unidad',
   'Cree que la medida con el número más grande es la mayor.',
   'conceptual', true, 'hipotesis', '3,2 kg < 3050 g', '3,2 kg = 3200 g > 3050 g', 5),
  ('c2000000-0000-4000-8000-000000000906', null, 'c1000000-0000-4000-8000-000000000903',
   'Juntar las cifras de la forma compleja',
   'Escribe las cifras seguidas sin poner los ceros de los escalones que faltan.',
   'procedimiento', true, 'hipotesis', '3 km 4 hm 5 m = 345 m', '3405 m', 6),
  ('c2000000-0000-4000-8000-000000000907', null, 'c1000000-0000-4000-8000-000000000906',
   'Método bien, cuenta mal',
   'Pasa bien a la misma unidad y se equivoca en una operación.',
   'operacion', false, 'estructural', '5500 : 500 = 10', '11', 7),
  ('c2000000-0000-4000-8000-000000000908', null, 'c1000000-0000-4000-8000-000000000902',
   'Descuido: copia mal la unidad',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', 'dam copiado como dm', 'dam', 8)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000901', null, 'c1000000-0000-4000-8000-000000000901',
   'Elige la unidad adecuada para medir',
   'De 6 a 8 objetos cotidianos con opciones separadas por escalones: solo una es razonable.',
   'Para medir la altura de una puerta: mm, cm, m, km', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000902', null, 'c1000000-0000-4000-8000-000000000905',
   'Estima la medida razonable de un objeto',
   'De 4 a 6 objetos con tres medidas separadas por 10.',
   'La altura de una puerta: 0,2 m / 2 m / 20 m', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000903', null, 'c1000000-0000-4000-8000-000000000902',
   'Cambia de unidad de longitud, masa o capacidad',
   'De 6 a 8, de uno a tres escalones, con decimales.',
   '3,5 km = ___ m', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000904', null, 'c1000000-0000-4000-8000-000000000902',
   'Compara medidas expresadas en unidades distintas',
   'De 5 a 7 parejas; el número más grande suele ser la medida más pequeña.',
   '3,2 kg □ 3050 g', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000905', null, 'c1000000-0000-4000-8000-000000000903',
   'Pasa una medida de forma compleja a incompleja',
   'De 4 a 6, con un escalón saltado en medio.',
   '3 km 4 hm 5 m = ___ m', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000906', null, 'c1000000-0000-4000-8000-000000000903',
   'Suma medidas expresadas en unidades distintas',
   'De 4 a 6 sumas de dos medidas a dos o tres escalones.',
   '2,5 km + 350 m = ___ m', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000907', null, 'c1000000-0000-4000-8000-000000000904',
   'Cambia de unidad de superficie',
   'De 5 a 7, de uno a dos escalones (100 por escalón).',
   '2,5 m² = ___ dm²', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000908', null, 'c1000000-0000-4000-8000-000000000904',
   'Pasa de hectáreas y áreas a metros cuadrados y al revés',
   'De 3 a 4, en contexto (fincas, parques, campos).',
   'Una finca mide 3,5 ha. ¿Cuántos m² son?', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000909', null, 'c1000000-0000-4000-8000-000000000906',
   'Resuelve problemas pasando a la misma unidad',
   'De 3 a 4, de contextos distintos: vasos de una garrafa, vueltas a una pista, paquetes, cuerdas, botellas.',
   '¿Cuántos vasos de 250 mL se llenan con 2 L?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000910', null, 'c1000000-0000-4000-8000-000000000906',
   'Resuelve problemas de medida y precio en dos pasos',
   'De 3 a 4, de contextos distintos: precio por kilo o por metro y cantidad en gramos o centímetros, goteos en mL por minuto, peso de un folio.',
   'El queso cuesta 16 € el kilo. ¿Cuánto cuestan 250 g?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000901', null, 'c0000000-0000-4000-8000-000000000009',
   'Elegir unidades y estimar medidas',
   'La unidad adecuada y la medida razonable.',
   1, 1),
  ('c4000000-0000-4000-8000-000000000902', null, 'c0000000-0000-4000-8000-000000000009',
   'Cambiar de unidad de longitud, masa y capacidad',
   'La escalera y comparar medidas.',
   2, 2),
  ('c4000000-0000-4000-8000-000000000903', null, 'c0000000-0000-4000-8000-000000000009',
   'Pasar de forma compleja a incompleja y sumar medidas',
   'Una sola unidad y sumas en unidades distintas.',
   1, 3),
  ('c4000000-0000-4000-8000-000000000904', null, 'c0000000-0000-4000-8000-000000000009',
   'Trabajar con unidades de superficie',
   'La escalera de 100 en 100 y las medidas agrarias.',
   2, 4),
  ('c4000000-0000-4000-8000-000000000905', null, 'c0000000-0000-4000-8000-000000000009',
   'Resolver problemas de medida',
   'Pasar a la misma unidad antes de operar.',
   1, 5)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000901', 'c1000000-0000-4000-8000-000000000901'),
  ('c4000000-0000-4000-8000-000000000901', 'c1000000-0000-4000-8000-000000000905'),
  ('c4000000-0000-4000-8000-000000000902', 'c1000000-0000-4000-8000-000000000902'),
  ('c4000000-0000-4000-8000-000000000903', 'c1000000-0000-4000-8000-000000000903'),
  ('c4000000-0000-4000-8000-000000000904', 'c1000000-0000-4000-8000-000000000904'),
  ('c4000000-0000-4000-8000-000000000905', 'c1000000-0000-4000-8000-000000000906')
on conflict (objetivo_id, concepto_id) do nothing;
