-- 144_semilla_funciones_1eso.sql
-- EL UNDÉCIMO TEMA DEL CATÁLOGO: Funciones y gráficas, 1.º ESO de
-- Matemáticas. 1 tema, 5 conceptos, 7 errores típicos, 8 arquetipos y 4
-- objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0011NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO), todos de D.5 Relaciones y
-- funciones: «Relaciones cuantitativas en situaciones de la vida cotidiana y
-- clases de funciones que las modelizan», «Relaciones lineales:
-- identificación y comparación de diferentes modos de representación,
-- tablas, gráficas o expresiones algebraicas…» y «Estrategias de deducción
-- de la información relevante de una función…».
--
-- LOS EJES Y LAS GRÁFICAS LOS DIBUJA LA HOJA (assets/shared/hoja/js/
-- figuras/ejes.js), con cuadrícula de 5 mm: el alumno cuenta cuadros, y
-- los vértices de las gráficas caen en cruces, así que se leen sin estimar.
--
-- LO QUE SE QUEDA FUERA, y por qué:
--   - representar puntos o dibujar una gráfica: la respuesta es un dibujo y
--     no se corrige comparando con una solución (la cuadrícula vacía ya se
--     puede imprimir; falta decidir cómo se corregiría);
--   - funciones no lineales (proporcionalidad inversa, cuadráticas): D.5 de
--     1.º solo nombra las lineales;
--   - las coordenadas como «localización» (C.2): no existe en 1.º; aquí se
--     usan solo para leer gráficas.
--
-- LOS ERRORES: los 5 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000011', null, 'Matemáticas', '1.º ESO',
   'Funciones y gráficas', 'aragon', array['D.5'], 11)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000001101', null, 'c0000000-0000-4000-8000-000000000011',
   'Coordenadas cartesianas',
   'Un punto se escribe (x, y): primero lo horizontal y después lo vertical. Los cuatro cuadrantes y los ejes.',
   'D.5', true, 1),
  ('c1000000-0000-4000-8000-000000001102', null, 'c0000000-0000-4000-8000-000000000011',
   'Tabla de valores',
   'Sustituir x en la expresión, con su signo, para obtener y.',
   'D.5', false, 2),
  ('c1000000-0000-4000-8000-000000001103', null, 'c0000000-0000-4000-8000-000000000011',
   'Expresión de una relación lineal',
   'y = ax + b: a es lo que cambia y cada vez que x sube 1; b, lo que vale y cuando x es 0.',
   'D.5', false, 3),
  ('c1000000-0000-4000-8000-000000001104', null, 'c0000000-0000-4000-8000-000000000011',
   'Lectura de gráficas',
   'Leer valores, tramos constantes, crecimiento y decrecimiento en una gráfica, y pasar de la recta dibujada a su expresión.',
   'D.5', true, 4),
  ('c1000000-0000-4000-8000-000000001105', null, 'c0000000-0000-4000-8000-000000000011',
   'Relaciones lineales en la vida cotidiana',
   'Una parte fija y una parte que va por unidad: y = (por unidad) · x + (fija). Comparar dos tarifas.',
   'D.5', false, 5)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000001101', null, 'c1000000-0000-4000-8000-000000001101',
   'Escribir las coordenadas al revés',
   'Escribe primero la y y después la x.',
   'procedimiento', true, 'hipotesis', 'A = (3, −2) escrito (−2, 3)', '(3, −2)', 1),
  ('c2000000-0000-4000-8000-000000001102', null, 'c1000000-0000-4000-8000-000000001101',
   'Equivocarse de cuadrante',
   'Lee los signos al revés y confunde el 2.º con el 4.º.',
   'conceptual', true, 'hipotesis', '(−3, 5): 4.º cuadrante', '2.º', 2),
  ('c2000000-0000-4000-8000-000000001103', null, 'c1000000-0000-4000-8000-000000001102',
   'Sustituir un negativo sin su signo',
   'Pone el valor absoluto de x al sustituir.',
   'signo', true, 'hipotesis', 'y = 2x + 1, x = −2: y = 5', 'y = −3', 3),
  ('c2000000-0000-4000-8000-000000001104', null, 'c1000000-0000-4000-8000-000000001103',
   'Intercambiar la parte fija y la que va por unidad',
   'Pone multiplicando a x lo que es fijo, y al revés.',
   'conceptual', true, 'hipotesis', 'Taxi: 3 € al subir y 1 € por km → y = 3x + 1', 'y = x + 3', 4),
  ('c2000000-0000-4000-8000-000000001105', null, 'c1000000-0000-4000-8000-000000001105',
   'Comparar solo la parte fija de dos tarifas',
   'Elige la tarifa con menos cuota fija sin calcular lo que cuesta cada una.',
   'interpretacion', true, 'hipotesis', 'A: 5 € + 4 €/min; B: 20 € + 1 €/min; 10 min → A', 'B (45 € frente a 30 €)', 5),
  ('c2000000-0000-4000-8000-000000001106', null, 'c1000000-0000-4000-8000-000000001102',
   'Método bien, cuenta mal',
   'Sustituye bien y se equivoca en una operación con enteros.',
   'operacion', false, 'estructural', '−3 · (−2) + 1 = 5', '7', 6),
  ('c2000000-0000-4000-8000-000000001107', null, 'c1000000-0000-4000-8000-000000001104',
   'Descuido: lee una línea de la cuadrícula de más',
   'Sabe leer la gráfica y cuenta un cuadro de más o de menos.',
   'descuido', false, 'estructural', '80 km en vez de 70', '70 km', 7)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000001101', null, 'c1000000-0000-4000-8000-000000001101',
   'Di en qué cuadrante está el punto',
   'De 6 a 8 puntos sin dibujo, alguno sobre un eje.',
   '(−3, 5): ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001102', null, 'c1000000-0000-4000-8000-000000001101',
   'Escribe las coordenadas de los puntos',
   'De 2 a 3 cuadrículas pequeñas con tres puntos, cada uno en un cuadrante distinto.',
   'A = ___, B = ___, C = ___', 'ejercicio', 1, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001103', null, 'c1000000-0000-4000-8000-000000001102',
   'Completa la tabla de valores de la relación',
   'De 2 a 3 expresiones y = ax + b con x de −2 a 2.',
   'y = 2x − 1', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001104', null, 'c1000000-0000-4000-8000-000000001103',
   'Escribe la expresión de la relación a partir de su tabla',
   'De 2 a 3 tablas de x = 0 a 4.',
   'x: 0, 1, 2, 3, 4; y: 1, 4, 7, 10, 13', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001105', null, 'c1000000-0000-4000-8000-000000001104',
   'Escribe la expresión de una recta a partir de su gráfica',
   'De 2 a 3 rectas dibujadas con dos puntos marcados.',
   'La recta que pasa por (0, 1) y (1, 3): y = ___', 'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001106', null, 'c1000000-0000-4000-8000-000000001104',
   'Lee la información de una gráfica',
   'Dos gráficas de situaciones distintas (excursión, depósito, horno, paseo), con tres preguntas cada una.',
   '¿A cuántos km estaba a las 2 h? ¿Cuánto tiempo estuvo parada?', 'problema', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001107', null, 'c1000000-0000-4000-8000-000000001105',
   'Escribe la expresión de una situación lineal y úsala',
   'De 2 a 3 situaciones distintas: taxi, gimnasio, planta, vela, hucha.',
   'Un taxi cobra 3 € al subir y 1 € por km: y = ___; 10 km: ___', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001108', null, 'c1000000-0000-4000-8000-000000001105',
   'Compara dos tarifas lineales',
   'De 2 a 3: la de menos cuota fija es la más cara para la cantidad que se pregunta.',
   'A: 5 € + 4 € por minuto; B: 20 € + 1 € por minuto. ¿Cuál es más barata para 10 minutos?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000001101', null, 'c0000000-0000-4000-8000-000000000011',
   'Situar y leer puntos en unos ejes', 'Coordenadas y cuadrantes.', 1, 1),
  ('c4000000-0000-4000-8000-000000001102', null, 'c0000000-0000-4000-8000-000000000011',
   'Pasar de la expresión a la tabla y de la tabla a la expresión', 'Tablas de valores y expresiones y = ax + b.', 2, 2),
  ('c4000000-0000-4000-8000-000000001103', null, 'c0000000-0000-4000-8000-000000000011',
   'Leer gráficas', 'Información de una gráfica y expresión de una recta.', 2, 3),
  ('c4000000-0000-4000-8000-000000001104', null, 'c0000000-0000-4000-8000-000000000011',
   'Modelizar situaciones con relaciones lineales', 'Expresión de una situación y comparación de tarifas.', 2, 4)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000001101', 'c1000000-0000-4000-8000-000000001101'),
  ('c4000000-0000-4000-8000-000000001102', 'c1000000-0000-4000-8000-000000001102'),
  ('c4000000-0000-4000-8000-000000001102', 'c1000000-0000-4000-8000-000000001103'),
  ('c4000000-0000-4000-8000-000000001103', 'c1000000-0000-4000-8000-000000001104'),
  ('c4000000-0000-4000-8000-000000001104', 'c1000000-0000-4000-8000-000000001105')
on conflict (objetivo_id, concepto_id) do nothing;
