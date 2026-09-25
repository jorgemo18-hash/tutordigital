-- 143_semilla_geometria_1eso.sql
-- EL DÉCIMO TEMA DEL CATÁLOGO: Geometría plana, 1.º ESO de Matemáticas.
-- 1 tema, 7 conceptos, 10 errores típicos, 13 arquetipos y 6 objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0010NN.
--
-- EL PRIMER TEMA CON FIGURAS. La figura es un DATO del apartado (números:
-- vértices, cotas, ángulos) y la dibuja el código de la hoja
-- (assets/shared/hoja/js/figuras/), nunca un modelo. Los ángulos que se
-- miden se imprimen a ESCALA REAL: un ángulo de 40° mide 40° con el
-- transportador. Por eso `requiere_figura` va a true en los arquetipos que
-- la llevan: ya no significa "no se puede generar" sino "lleva dibujo".
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO):
--   B.2 Medición: «Medición directa de ángulos y deducción de la medida a
--       partir de las relaciones angulares», «Longitud de la circunferencia,
--       áreas en figuras planas…» y «Representaciones planas de objetos en…
--       problemas de áreas»;
--   C.1 «Figuras geométricas planas…: descripción y clasificación…»;
--   C.4 «Modelización geométrica: relaciones numéricas y algebraicas en la
--       resolución de problemas».
--
-- π ≈ 3,14, a mano (en 1.º no hay calculadora): radios enteros pequeños.
--
-- LO QUE SE QUEDA FUERA, y por qué:
--   - construir con regla y compás, y la geometría dinámica (C.1): se hacen
--     en el cuaderno o en el ordenador, no se corrigen en una hoja;
--   - los cuerpos geométricos (C.1 los nombra, «tridimensionales»): la
--     figura en perspectiva es otro dibujante, pendiente;
--   - Pitágoras y Tales: no están en el anexo de 1.º.
--
-- LOS ERRORES: los 8 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000010', null, 'Matemáticas', '1.º ESO',
   'Geometría plana', 'aragon', array['B.2', 'C.1', 'C.4'], 10)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000001001', null, 'c0000000-0000-4000-8000-000000000010',
   'Ángulos y su medida',
   'Medir con el transportador y clasificar en agudo, recto, obtuso y llano.',
   'B.2', true, 1),
  ('c1000000-0000-4000-8000-000000001002', null, 'c0000000-0000-4000-8000-000000000010',
   'Relaciones entre ángulos',
   'Complementarios (suman 90°), suplementarios (suman 180°) y los ángulos de un triángulo (suman 180°).',
   'B.2', true, 2),
  ('c1000000-0000-4000-8000-000000001003', null, 'c0000000-0000-4000-8000-000000000010',
   'Clasificación de triángulos y cuadriláteros',
   'Triángulos por sus lados y por sus ángulos; cuadriláteros por sus lados paralelos, iguales y sus ángulos.',
   'C.1', true, 3),
  ('c1000000-0000-4000-8000-000000001004', null, 'c0000000-0000-4000-8000-000000000010',
   'Perímetro y área',
   'El perímetro es lo que mide el borde; el área, lo que ocupa. Rectángulo y cuadrado.',
   'B.2', true, 4),
  ('c1000000-0000-4000-8000-000000001005', null, 'c0000000-0000-4000-8000-000000000010',
   'Áreas de polígonos',
   'Triángulo, romboide, rombo y trapecio, con la altura (no el lado inclinado).',
   'B.2', true, 5),
  ('c1000000-0000-4000-8000-000000001006', null, 'c0000000-0000-4000-8000-000000000010',
   'Circunferencia y círculo',
   'Longitud 2 · π · r y área π · r², con π ≈ 3,14; el radio es la mitad del diámetro.',
   'B.2', true, 6),
  ('c1000000-0000-4000-8000-000000001007', null, 'c0000000-0000-4000-8000-000000000010',
   'Figuras compuestas y problemas',
   'Descomponer una figura en rectángulos y decidir si un problema pide perímetro o área.',
   'C.4', true, 7)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000001001', null, 'c1000000-0000-4000-8000-000000001004',
   'Confundir perímetro y área',
   'Da el área cuando se pide el perímetro, o al revés.',
   'conceptual', true, 'hipotesis', 'Rectángulo 7 × 4: perímetro 28', 'Perímetro 22, área 28', 1),
  ('c2000000-0000-4000-8000-000000001002', null, 'c1000000-0000-4000-8000-000000001005',
   'Olvidar dividir entre 2',
   'En el triángulo, el rombo o el trapecio, multiplica y no divide entre 2.',
   'procedimiento', true, 'hipotesis', 'Triángulo b = 8, h = 5: 40 cm²', '20 cm²', 2),
  ('c2000000-0000-4000-8000-000000001003', null, 'c1000000-0000-4000-8000-000000001005',
   'Usar el lado inclinado como altura',
   'Toma la medida del lado oblicuo en lugar de la altura.',
   'conceptual', true, 'hipotesis', 'Romboide b = 8, lado 5, h = 4: 40 cm²', '32 cm²', 3),
  ('c2000000-0000-4000-8000-000000001004', null, 'c1000000-0000-4000-8000-000000001006',
   'Usar el diámetro como radio',
   'Cuando la figura da el diámetro, lo usa en la fórmula como si fuera el radio.',
   'interpretacion', true, 'hipotesis', 'Diámetro 6: área = 3,14 · 36', '3,14 · 9 = 28,26', 4),
  ('c2000000-0000-4000-8000-000000001005', null, 'c1000000-0000-4000-8000-000000001006',
   'Calcular r² como r · 2',
   'Confunde elevar al cuadrado con multiplicar por dos.',
   'procedimiento', true, 'hipotesis', 'r = 5: área = 3,14 · 10', '3,14 · 25 = 78,5', 5),
  ('c2000000-0000-4000-8000-000000001006', null, 'c1000000-0000-4000-8000-000000001002',
   'Confundir complementario y suplementario',
   'Resta de 180° cuando es de 90°, o al revés.',
   'conceptual', true, 'hipotesis', 'Complementario de 35°: 145°', '55°', 6),
  ('c2000000-0000-4000-8000-000000001007', null, 'c1000000-0000-4000-8000-000000001002',
   'Creer que los ángulos de un triángulo suman 360°',
   'Aplica la suma de los ángulos de un cuadrilátero.',
   'conceptual', true, 'hipotesis', '50° y 60°: x = 250°', '70°', 7),
  ('c2000000-0000-4000-8000-000000001008', null, 'c1000000-0000-4000-8000-000000001007',
   'Multiplicar las medidas de fuera de la figura compuesta',
   'Calcula el área del rectángulo que la contiene, con el hueco incluido.',
   'procedimiento', true, 'hipotesis', 'L de 10 × 8 sin 4 × 3: 80 cm²', '68 cm²', 8),
  ('c2000000-0000-4000-8000-000000001009', null, 'c1000000-0000-4000-8000-000000001005',
   'Método bien, cuenta mal',
   'Elige bien la fórmula y las medidas y se equivoca en una operación.',
   'operacion', false, 'estructural', '3,14 · 25 = 75,8', '78,5', 9),
  ('c2000000-0000-4000-8000-000000001010', null, 'c1000000-0000-4000-8000-000000001004',
   'Descuido: olvida la unidad o la pone lineal',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', 'Área = 28 cm', '28 cm²', 10)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000001001', null, 'c1000000-0000-4000-8000-000000001001',
   'Clasifica el ángulo en agudo, recto, obtuso o llano',
   'De 2 a 3 ángulos dibujados, lejos de los bordes (nada de 85° ni 95°).',
   'Un ángulo de 130°: ___', 'ejercicio', 1, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001002', null, 'c1000000-0000-4000-8000-000000001001',
   'Mide el ángulo con el transportador',
   'De 2 a 3 ángulos múltiplos de 5, impresos a escala real.',
   'Mide: ___', 'ejercicio', 1, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001003', null, 'c1000000-0000-4000-8000-000000001002',
   'Calcula el complementario o el suplementario de un ángulo',
   'De 6 a 8, mitad y mitad; nunca 45°.',
   'El complementario de 35°: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001004', null, 'c1000000-0000-4000-8000-000000001002',
   'Calcula el ángulo que falta en un triángulo',
   'De 2 a 3 triángulos con dos ángulos marcados y la x en el tercero.',
   '50°, 60° y x', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001005', null, 'c1000000-0000-4000-8000-000000001003',
   'Clasifica el triángulo por sus lados o por sus ángulos',
   'De 2 a 3, la mitad con los ángulos marcados y la mitad con los lados medidos.',
   'Lados 6, 6 y 4 cm: ___', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001006', null, 'c1000000-0000-4000-8000-000000001003',
   'Nombra el cuadrilátero a partir de sus propiedades',
   'De 4 a 5 descripciones distintas.',
   'Cuatro lados iguales y ningún ángulo recto: ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001007', null, 'c1000000-0000-4000-8000-000000001004',
   'Calcula el perímetro y el área de un rectángulo o un cuadrado',
   'De 2 a 3 figuras con sus medidas.',
   'Rectángulo de 7 × 4 cm', 'ejercicio', 1, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001008', null, 'c1000000-0000-4000-8000-000000001005',
   'Calcula el área del triángulo con su altura',
   'De 2 a 3, con la altura dibujada y un lado inclinado también medido, que sobra.',
   'b = 8 cm, h = 5 cm', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001009', null, 'c1000000-0000-4000-8000-000000001005',
   'Calcula el área de romboides, rombos y trapecios',
   'De 2 a 3, mezclando las tres formas.',
   'Trapecio de bases 10 y 6 cm y altura 4 cm', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001010', null, 'c1000000-0000-4000-8000-000000001006',
   'Calcula la longitud de la circunferencia',
   'De 2 a 3, la mitad dando el diámetro.',
   'Radio 5 cm: L = ___', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001011', null, 'c1000000-0000-4000-8000-000000001006',
   'Calcula el área del círculo',
   'De 2 a 3, la mitad dando el diámetro.',
   'Diámetro 6 cm: A = ___', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001012', null, 'c1000000-0000-4000-8000-000000001007',
   'Calcula el área de una figura compuesta de rectángulos',
   'De 2 a 3 figuras en L con las medidas necesarias.',
   'Una L de 10 × 8 cm sin una esquina de 4 × 3 cm', 'ejercicio', 3, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001013', null, 'c1000000-0000-4000-8000-000000001007',
   'Resuelve problemas de perímetros y áreas',
   'De 3 a 4 contextos distintos: embaldosar, vallar, pintar, césped, puntilla.',
   'Una habitación de 4 × 3 m con baldosas de 50 cm', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000001001', null, 'c0000000-0000-4000-8000-000000000010',
   'Medir y clasificar ángulos', 'Transportador y tipos de ángulos.', 2, 1),
  ('c4000000-0000-4000-8000-000000001002', null, 'c0000000-0000-4000-8000-000000000010',
   'Relacionar ángulos', 'Complementarios, suplementarios y los ángulos del triángulo.', 1, 2),
  ('c4000000-0000-4000-8000-000000001003', null, 'c0000000-0000-4000-8000-000000000010',
   'Clasificar triángulos y cuadriláteros', 'Por sus lados, sus ángulos y sus lados paralelos.', 2, 3),
  ('c4000000-0000-4000-8000-000000001004', null, 'c0000000-0000-4000-8000-000000000010',
   'Calcular perímetros y áreas de polígonos', 'Rectángulo, cuadrado, triángulo, romboide, rombo y trapecio.', 3, 4),
  ('c4000000-0000-4000-8000-000000001005', null, 'c0000000-0000-4000-8000-000000000010',
   'Calcular la longitud de la circunferencia y el área del círculo', 'Con π ≈ 3,14.', 2, 5),
  ('c4000000-0000-4000-8000-000000001006', null, 'c0000000-0000-4000-8000-000000000010',
   'Resolver problemas de áreas', 'Figuras compuestas y problemas de la vida real.', 2, 6)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000001001', 'c1000000-0000-4000-8000-000000001001'),
  ('c4000000-0000-4000-8000-000000001002', 'c1000000-0000-4000-8000-000000001002'),
  ('c4000000-0000-4000-8000-000000001003', 'c1000000-0000-4000-8000-000000001003'),
  ('c4000000-0000-4000-8000-000000001004', 'c1000000-0000-4000-8000-000000001004'),
  ('c4000000-0000-4000-8000-000000001004', 'c1000000-0000-4000-8000-000000001005'),
  ('c4000000-0000-4000-8000-000000001005', 'c1000000-0000-4000-8000-000000001006'),
  ('c4000000-0000-4000-8000-000000001006', 'c1000000-0000-4000-8000-000000001007')
on conflict (objetivo_id, concepto_id) do nothing;
