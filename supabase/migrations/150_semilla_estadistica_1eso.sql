-- 150_semilla_estadistica_1eso.sql
-- EL DUODÉCIMO TEMA DEL CATÁLOGO: Estadística y probabilidad, 1.º ESO de
-- Matemáticas. 1 tema, 8 conceptos, 12 errores típicos, 10 arquetipos y 4
-- objetivos. Con este, los 12 temas de 1.º tienen generador.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0012NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO):
--   E.1 Organización y análisis de datos: «Estrategias de recogida y
--       organización de datos… que involucran una sola variable», «Análisis
--       e interpretación de tablas y gráficos estadísticos de variables
--       cualitativas, cuantitativas discretas y cuantitativas continuas…»,
--       «Medidas de localización…» y «Comparación de dos conjuntos de datos
--       atendiendo a las medidas de localización y dispersión».
--   E.2 Incertidumbre: «Fenómenos deterministas y aleatorios:
--       identificación» y «Asignación de probabilidades mediante
--       experimentación, el concepto de frecuencia relativa y la regla de
--       Laplace».
--
-- LOS DIAGRAMAS DE BARRAS LOS DIBUJA LA HOJA (assets/shared/hoja/js/
-- figuras/graficos.js), con cuadrícula: cada barra acaba en una línea.
--
-- LO QUE SE QUEDA FUERA, y por qué:
--   - dibujar un diagrama (barras o sectores): la respuesta es un dibujo y
--     no se corrige comparando con una solución; se calculan los ángulos,
--     que es la parte que se puede comprobar;
--   - el histograma y los datos agrupados: E.1 de 1.º no los nombra;
--   - el «apoyo tecnológico» (hoja de cálculo, calculadora): estas hojas son
--     de papel y sin calculadora, así que las medias salen exactas;
--   - E.3 Inferencia (muestras, preguntas de una investigación): se toca al
--     decidir si un dado parece trucado, pero no tiene arquetipo propio.
--
-- LOS ERRORES: los 10 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000012', null, 'Matemáticas', '1.º ESO',
   'Estadística y probabilidad', 'aragon', array['E.1', 'E.2'], 12)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000001201', null, 'c0000000-0000-4000-8000-000000000012',
   'Variable estadística y sus tipos',
   'Cualitativa (una cualidad), cuantitativa discreta (se cuenta) o cuantitativa continua (se mide).',
   'E.1', false, 1),
  ('c1000000-0000-4000-8000-000000001202', null, 'c0000000-0000-4000-8000-000000000012',
   'Tabla de frecuencias',
   'Frecuencia absoluta (cuántas veces sale cada valor) y porcentaje (la frecuencia entre el total, por 100).',
   'E.1', false, 2),
  ('c1000000-0000-4000-8000-000000001203', null, 'c0000000-0000-4000-8000-000000000012',
   'Gráficos estadísticos',
   'Leer un diagrama de barras y calcular los ángulos de un diagrama de sectores (360° el total).',
   'E.1', true, 3),
  ('c1000000-0000-4000-8000-000000001204', null, 'c0000000-0000-4000-8000-000000000012',
   'Media, mediana y moda',
   'Media: la suma entre el número de datos. Mediana: el del medio con los datos ordenados. Moda: el valor que más se repite.',
   'E.1', false, 4),
  ('c1000000-0000-4000-8000-000000001205', null, 'c0000000-0000-4000-8000-000000000012',
   'Rango y comparación de datos',
   'Rango = mayor − menor. Con la misma media, es más regular el de menos rango.',
   'E.1', false, 5),
  ('c1000000-0000-4000-8000-000000001206', null, 'c0000000-0000-4000-8000-000000000012',
   'Experimentos aleatorios y deterministas',
   'Aleatorio: no se sabe qué va a salir aunque se repita igual. Determinista: se sabe antes de hacerlo.',
   'E.2', false, 6),
  ('c1000000-0000-4000-8000-000000001207', null, 'c0000000-0000-4000-8000-000000000012',
   'Regla de Laplace',
   'Con casos igual de probables: probabilidad = casos favorables / casos posibles.',
   'E.2', false, 7),
  ('c1000000-0000-4000-8000-000000001208', null, 'c0000000-0000-4000-8000-000000000012',
   'Frecuencia relativa y probabilidad',
   'Frecuencia relativa = veces que sale / veces que se hace. Con muchas repeticiones se acerca a la probabilidad.',
   'E.2', false, 8)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000001201', null, 'c1000000-0000-4000-8000-000000001201',
   'Confundir cuantitativa discreta y continua',
   'Llama discreta a una medida (la estatura) o continua a algo que se cuenta.',
   'conceptual', true, 'hipotesis', 'Estatura: cuantitativa discreta', 'cuantitativa continua', 1),
  ('c2000000-0000-4000-8000-000000001202', null, 'c1000000-0000-4000-8000-000000001202',
   'Escribir la frecuencia absoluta como porcentaje',
   'Pone el número de veces con el signo % sin dividir entre el total.',
   'conceptual', true, 'hipotesis', '20 datos, el 2 sale 4 veces: 4 %', '20 %', 2),
  ('c2000000-0000-4000-8000-000000001203', null, 'c1000000-0000-4000-8000-000000001204',
   'Dar como moda la frecuencia y no el valor',
   'Contesta cuántas veces sale el dato más repetido, o la altura de la barra más alta, en vez del dato.',
   'conceptual', true, 'hipotesis', '3, 5, 5, 7, 5: moda 3', 'moda 5', 3),
  ('c2000000-0000-4000-8000-000000001204', null, 'c1000000-0000-4000-8000-000000001203',
   'Tomar el porcentaje por el ángulo del sector',
   'Reparte 100 en vez de 360: el sector del 25 % mide 25°.',
   'procedimiento', true, 'hipotesis', '5 de 20 personas: 25°', '90°', 4),
  ('c2000000-0000-4000-8000-000000001205', null, 'c1000000-0000-4000-8000-000000001204',
   'Buscar la mediana sin ordenar los datos',
   'Toma el dato del medio de la lista tal como viene.',
   'procedimiento', true, 'hipotesis', '7, 2, 9, 4, 3: mediana 9', '4', 5),
  ('c2000000-0000-4000-8000-000000001206', null, 'c1000000-0000-4000-8000-000000001204',
   'Hacer la media de una tabla sin las frecuencias',
   'Suma los valores distintos y divide entre cuántos son, como si cada uno saliera una vez.',
   'procedimiento', true, 'hipotesis', '0 (4 veces), 1 (4), 2 (6), 3 (6): media 1,5', '1,7', 6),
  ('c2000000-0000-4000-8000-000000001207', null, 'c1000000-0000-4000-8000-000000001205',
   'Creer más regular al de mayor rango',
   'Lee el rango como «mejor» en vez de como lo separados que están los datos.',
   'interpretacion', true, 'hipotesis', 'Rangos 2 y 10: más regular el de 10', 'el de 2', 7),
  ('c2000000-0000-4000-8000-000000001208', null, 'c1000000-0000-4000-8000-000000001207',
   'Laplace: favorables entre desfavorables',
   'Divide los casos favorables entre los que no lo son, no entre todos.',
   'conceptual', true, 'hipotesis', '3 rojas y 7 azules, roja: 3/7', '3/10', 8),
  ('c2000000-0000-4000-8000-000000001209', null, 'c1000000-0000-4000-8000-000000001207',
   'Laplace: dividir entre los colores y no entre las bolas',
   'Cuenta como casos posibles los tipos (los colores) y no los objetos (las bolas).',
   'conceptual', true, 'hipotesis', '5 rojas, 7 azules y 3 verdes, verde: 1/3', '1/5', 9),
  ('c2000000-0000-4000-8000-000000001210', null, 'c1000000-0000-4000-8000-000000001208',
   'Dar la frecuencia absoluta en vez de la relativa',
   'Contesta las veces que sale, sin dividir entre las veces que se hace.',
   'conceptual', true, 'hipotesis', '600 lanzamientos, el 6 sale 102: 102', '0,17', 10),
  ('c2000000-0000-4000-8000-000000001211', null, 'c1000000-0000-4000-8000-000000001204',
   'Método bien, cuenta mal',
   'Sabe qué hacer y se equivoca al sumar o al dividir.',
   'operacion', false, 'estructural', '14 + 14 + 16 + 16 + 15 = 76', '75', 11),
  ('c2000000-0000-4000-8000-000000001212', null, 'c1000000-0000-4000-8000-000000001203',
   'Descuido: lee una línea de la cuadrícula de más',
   'Sabe leer el diagrama y cuenta una línea de más o de menos.',
   'descuido', false, 'estructural', 'la barra llega a 8: lee 9', '8', 12)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000001201', null, 'c1000000-0000-4000-8000-000000001201',
   'Di de qué tipo es cada variable estadística',
   'De 6 a 8 variables, al menos dos de cada tipo.',
   'Estatura: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001202', null, 'c1000000-0000-4000-8000-000000001202',
   'Haz la tabla de frecuencias absolutas y porcentajes',
   'Dos listas de 20 o 25 datos que se cuentan (hermanos, mascotas, libros, goles).',
   'Número de hermanos de 20 alumnos: 1, 0, 2, 2, 1, 3…', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001203', null, 'c1000000-0000-4000-8000-000000001203',
   'Lee la información de un diagrama de barras',
   'Dos diagramas de una encuesta (deporte, fruta, mascota, transporte, música), con tres preguntas cada uno.',
   '¿Cuántos eligieron tenis? ¿Cuántos son en total? ¿Cuál es la moda?', 'problema', 1, true, 'activo'),
  ('c3000000-0000-4000-8000-000000001204', null, 'c1000000-0000-4000-8000-000000001203',
   'Calcula los ángulos de un diagrama de sectores',
   'De 2 a 3 repartos de 20 o 40 personas en 3 o 4 categorías.',
   'Desayuno de 20 personas: leche 8, zumo 5, cacao 4, nada 3', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001205', null, 'c1000000-0000-4000-8000-000000001204',
   'Calcula la media, la mediana y la moda',
   'De 2 a 3 listas de 5 a 8 datos, desordenadas, con media entera y una sola moda.',
   'Goles: 5, 6, 2, 3, 6, 6, 0', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001206', null, 'c1000000-0000-4000-8000-000000001204',
   'Calcula la media de una tabla de frecuencias',
   'De 2 a 3 tablas de valor y frecuencia; la media sale con un decimal como mucho.',
   'Hermanos: 0 (4 veces), 1 (4), 2 (6), 3 (6)', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001207', null, 'c1000000-0000-4000-8000-000000001205',
   'Compara dos conjuntos de datos con la media y el rango',
   'Dos parejas de cinco datos con la misma media y distinto rango.',
   'Ana: 14, 14, 16, 16, 15; Luis: 9, 10, 19, 19, 18. ¿Quién es más regular?', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001208', null, 'c1000000-0000-4000-8000-000000001206',
   'Di si el experimento es aleatorio o determinista',
   'De 4 a 6 experimentos, al menos dos de cada clase.',
   'Lanzar una moneda al aire: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001209', null, 'c1000000-0000-4000-8000-000000001207',
   'Calcula la probabilidad con la regla de Laplace',
   'De 3 a 4 preguntas: bolsa de bolas, dado, ruleta y baraja española. Fracción irreducible.',
   '5 rojas, 7 azules y 3 verdes: P(verde) = ___', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000001210', null, 'c1000000-0000-4000-8000-000000001208',
   'Calcula la frecuencia relativa de un experimento y úsala',
   'Dos experimentos repetidos (dado, chincheta, tiros libres): la frecuencia relativa y una decisión.',
   'Se lanza un dado 600 veces y el 6 sale 102. ¿Frecuencia relativa? ¿Parece normal?', 'problema', 3, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000001201', null, 'c0000000-0000-4000-8000-000000000012',
   'Organizar datos en tablas de frecuencias', 'Tipos de variable y tablas de frecuencias y porcentajes.', 2, 1),
  ('c4000000-0000-4000-8000-000000001202', null, 'c0000000-0000-4000-8000-000000000012',
   'Leer e interpretar gráficos estadísticos', 'Diagramas de barras y ángulos de un diagrama de sectores.', 1, 2),
  ('c4000000-0000-4000-8000-000000001203', null, 'c0000000-0000-4000-8000-000000000012',
   'Calcular e interpretar media, mediana, moda y rango', 'Medidas de una lista y de una tabla, y comparar dos conjuntos.', 2, 3),
  ('c4000000-0000-4000-8000-000000001204', null, 'c0000000-0000-4000-8000-000000000012',
   'Calcular probabilidades', 'Aleatorio o determinista, regla de Laplace y frecuencia relativa.', 2, 4)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000001201', 'c1000000-0000-4000-8000-000000001201'),
  ('c4000000-0000-4000-8000-000000001201', 'c1000000-0000-4000-8000-000000001202'),
  ('c4000000-0000-4000-8000-000000001202', 'c1000000-0000-4000-8000-000000001203'),
  ('c4000000-0000-4000-8000-000000001203', 'c1000000-0000-4000-8000-000000001204'),
  ('c4000000-0000-4000-8000-000000001203', 'c1000000-0000-4000-8000-000000001205'),
  ('c4000000-0000-4000-8000-000000001204', 'c1000000-0000-4000-8000-000000001206'),
  ('c4000000-0000-4000-8000-000000001204', 'c1000000-0000-4000-8000-000000001207'),
  ('c4000000-0000-4000-8000-000000001204', 'c1000000-0000-4000-8000-000000001208')
on conflict (objetivo_id, concepto_id) do nothing;
