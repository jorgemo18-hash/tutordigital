-- 139_semilla_proporcionalidad_1eso.sql
-- EL SEXTO TEMA DEL CATÁLOGO: Proporcionalidad y porcentajes, 1.º ESO de
-- Matemáticas. 1 tema, 8 conceptos, 13 errores típicos, 16 arquetipos y
-- 5 objetivos.
--
-- Solo DATOS, catálogo común, idempotente; identificadores …0006NN.
--
-- LOS SABERES (ORDEN ECD/1172/2022, 1.º ESO):
--   A.5 Razonamiento proporcional: «Razones entre magnitudes…»,
--       «Porcentajes: comprensión y resolución de problemas» y «Situaciones
--       de proporcionalidad… (aumentos y disminuciones porcentuales, rebajas
--       y subidas de precios, impuestos, escalas, cambio de divisas,
--       velocidad y tiempo, etc.)»;
--   A.6 Educación financiera: «… consumo responsable: relaciones
--       calidad-precio y valor-precio…»;
--   y A.2 «Porcentajes mayores que 100 y menores que 1: interpretación»
--       (en la batería de escribir porcentajes como fracción y decimal).
--
-- EL MÉTODO DE LOS EJEMPLOS ES LA REDUCCIÓN A LA UNIDAD. El anexo no nombra
-- la regla de tres; la reducción a la unidad se entiende sin memorizar una
-- disposición. Los ejercicios son los mismos con cualquiera de los dos.
--
-- SIN CALCULADORA: porcentajes que se calculan de cabeza (10, 20, 25, 50,
-- 75, 5…), cantidades redondas, y el dinero con céntimos exactos.
--
-- LO QUE SE QUEDA FUERA, y por qué:
--   - la proporcionalidad INVERSA: el anexo de 1.º no la nombra (la
--     secuencia habitual la deja para 2.º);
--   - los porcentajes encadenados (dos rebajas seguidas): no los nombra, y
--     son justo donde el error aditivo se vuelve irresoluble sin el índice
--     de variación, que tampoco está en 1.º.
--
-- LOS ERRORES: los 11 predecibles son `hipotesis`; los dos últimos,
-- estructurales.

insert into public.contenido_temas
  (id, tenant_id, materia, curso, nombre, comunidad, saberes, orden)
values
  ('c0000000-0000-4000-8000-000000000006', null, 'Matemáticas', '1.º ESO',
   'Proporcionalidad y porcentajes', 'aragon', array['A.2', 'A.5', 'A.6'], 8)
on conflict (id) do nothing;

insert into public.contenido_conceptos
  (id, tenant_id, tema_id, nombre, descripcion, saber, requiere_figura, orden)
values
  ('c1000000-0000-4000-8000-000000000601', null, 'c0000000-0000-4000-8000-000000000006',
   'Razones',
   'La razón entre dos cantidades es su cociente escrito como fracción, en el orden en que se nombran: 12 chicas y 16 chicos, 12/16 = 3/4.',
   'A.5', false, 1),
  ('c1000000-0000-4000-8000-000000000602', null, 'c0000000-0000-4000-8000-000000000006',
   'Proporciones',
   'Dos razones iguales forman una proporción; sus productos cruzados son iguales, y con ellos se calcula el término que falta.',
   'A.5', false, 2),
  ('c1000000-0000-4000-8000-000000000603', null, 'c0000000-0000-4000-8000-000000000006',
   'Magnitudes directamente proporcionales',
   'Si una se multiplica por un número, la otra se multiplica por el mismo; al dividir los valores de una entre los de la otra sale siempre la constante.',
   'A.5', false, 3),
  ('c1000000-0000-4000-8000-000000000604', null, 'c0000000-0000-4000-8000-000000000006',
   'Problemas de proporcionalidad directa',
   'Se calcula primero lo que corresponde a 1 (reducción a la unidad) y después lo que se pide. Escalas, velocidad, divisas y recetas.',
   'A.5', false, 4),
  ('c1000000-0000-4000-8000-000000000605', null, 'c0000000-0000-4000-8000-000000000006',
   'Qué es un porcentaje',
   'p % es p de cada 100: una fracción de denominador 100 y un decimal (25 % = 1/4 = 0,25). Más del 100 % es más que el total; menos del 1 %, menos de 1 de cada 100.',
   'A.5', false, 5),
  ('c1000000-0000-4000-8000-000000000606', null, 'c0000000-0000-4000-8000-000000000006',
   'Cálculos con porcentajes',
   'El porcentaje de una cantidad, qué porcentaje es una cantidad de otra y el total a partir de una parte.',
   'A.5', false, 6),
  ('c1000000-0000-4000-8000-000000000607', null, 'c0000000-0000-4000-8000-000000000006',
   'Aumentos y disminuciones porcentuales',
   'Rebajas, subidas e impuestos: se calcula el aumento o el descuento y se suma o se resta. Y al revés, el precio de antes.',
   'A.5', false, 7),
  ('c1000000-0000-4000-8000-000000000608', null, 'c0000000-0000-4000-8000-000000000006',
   'Consumo responsable',
   'Comparar ofertas por el precio de la unidad, no por el total, y entender lo que dice una promoción (3x2, segunda unidad a mitad de precio).',
   'A.6', false, 8)
on conflict (id) do nothing;

insert into public.contenido_errores_tipo
  (id, tenant_id, concepto_id, nombre, descripcion, categoria, predecible,
   evidencia, ejemplo_erroneo, ejemplo_correcto, orden)
values
  ('c2000000-0000-4000-8000-000000000601', null, 'c1000000-0000-4000-8000-000000000601',
   'Escribir la razón al revés',
   'Pone primero la cantidad que se nombra en segundo lugar.',
   'interpretacion', true, 'hipotesis', 'Razón de chicos a chicas (16 y 12): 12/16', '16/12 = 4/3', 1),
  ('c2000000-0000-4000-8000-000000000602', null, 'c1000000-0000-4000-8000-000000000602',
   'Razonar sumando en vez de multiplicando',
   'Cree que la relación se mantiene sumando lo mismo a las dos cantidades (razonamiento aditivo).',
   'conceptual', true, 'hipotesis', '2/3 y 4/5 forman proporción; 4/6 = 8/x → x = 10', 'No forman proporción; x = 12', 2),
  ('c2000000-0000-4000-8000-000000000603', null, 'c1000000-0000-4000-8000-000000000604',
   'Multiplicar sin pasar por la unidad',
   'Multiplica el dato por la cantidad nueva sin calcular antes lo que corresponde a 1.',
   'procedimiento', true, 'hipotesis', '3 kg cuestan 12 €; 5 kg: 12 · 5 = 60 €', '12 : 3 = 4 €; 5 · 4 = 20 €', 3),
  ('c2000000-0000-4000-8000-000000000604', null, 'c1000000-0000-4000-8000-000000000606',
   'Calcular el porcentaje dividiendo entre él',
   'Divide la cantidad entre el porcentaje.',
   'procedimiento', true, 'hipotesis', '20 % de 80 = 80 : 20 = 4', '80 · 20 : 100 = 16', 4),
  ('c2000000-0000-4000-8000-000000000605', null, 'c1000000-0000-4000-8000-000000000605',
   'Pasar el porcentaje a decimal moviendo la coma un lugar',
   'Divide entre 10 en vez de entre 100.',
   'conceptual', true, 'hipotesis', '5 % = 0,5', '5 % = 0,05', 5),
  ('c2000000-0000-4000-8000-000000000606', null, 'c1000000-0000-4000-8000-000000000606',
   'Quedarse en el cociente sin pasarlo a porcentaje',
   'Divide la parte entre el total y da ese número como porcentaje.',
   'procedimiento', true, 'hipotesis', '12 de 60: 0,2 %', '12 : 60 = 0,2 = 20 %', 6),
  ('c2000000-0000-4000-8000-000000000607', null, 'c1000000-0000-4000-8000-000000000606',
   'Calcular el porcentaje de la parte en vez del total',
   'Aplica el porcentaje al dato que ya es una parte.',
   'interpretacion', true, 'hipotesis', 'El 30 % de un número es 12: 30 % de 12 = 3,6', '12 · 100 : 30 = 40', 7),
  ('c2000000-0000-4000-8000-000000000608', null, 'c1000000-0000-4000-8000-000000000607',
   'Contestar el descuento en vez de lo que se paga',
   'Calcula bien la rebaja y la da como precio final.',
   'interpretacion', true, 'hipotesis', '60 € con un 25 % de descuento: 15 €', '60 − 15 = 45 €', 8),
  ('c2000000-0000-4000-8000-000000000609', null, 'c1000000-0000-4000-8000-000000000607',
   'Sumar el porcentaje como si fueran euros',
   'En una subida, suma el número del porcentaje al precio.',
   'conceptual', true, 'hipotesis', '80 € con un 21 % de IVA: 101 €', '80 + 16,80 = 96,80 €', 9),
  ('c2000000-0000-4000-8000-000000000610', null, 'c1000000-0000-4000-8000-000000000607',
   'Aplicar el porcentaje al precio de después',
   'Para deshacer una rebaja, suma el porcentaje del precio rebajado.',
   'conceptual', true, 'hipotesis', 'Pagué 60 € con un 25 % de rebaja: 60 + 15 = 75 €', '60 es el 75 %: 60 · 100 : 75 = 80 €', 10),
  ('c2000000-0000-4000-8000-000000000611', null, 'c1000000-0000-4000-8000-000000000608',
   'Elegir el paquete más barato en total',
   'Compara lo que cuesta cada paquete sin mirar cuánto trae.',
   'interpretacion', true, 'hipotesis', '4 yogures por 1,80 € es mejor que 6 por 2,40 €', '0,45 € frente a 0,40 € el yogur: el de 6', 11),
  ('c2000000-0000-4000-8000-000000000612', null, 'c1000000-0000-4000-8000-000000000604',
   'Método bien, cuenta mal',
   'Plantea bien (reduce a la unidad, elige bien el porcentaje) y se equivoca en una operación. No es un error de proporcionalidad.',
   'operacion', false, 'estructural', '36 : 8 = 4,20', '36 : 8 = 4,50', 12),
  ('c2000000-0000-4000-8000-000000000613', null, 'c1000000-0000-4000-8000-000000000606',
   'Descuido: copia mal un dato',
   'Sabe hacerlo y lo hace bien casi siempre. No debe generar ninguna acción.',
   'descuido', false, 'estructural', '20 % de 80 copiado como 20 % de 60', '20 % de 80', 13)
on conflict (id) do nothing;

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000601', null, 'c1000000-0000-4000-8000-000000000601',
   'Escribe la razón y simplifícala',
   'De 4 a 6 situaciones de contar, cada una distinta; la mitad piden la razón en el orden contrario al que se nombran.',
   'En una clase hay 12 chicas y 16 chicos. Razón de chicos a chicas: ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000602', null, 'c1000000-0000-4000-8000-000000000602',
   'Comprueba si dos razones forman proporción',
   'De 6 a 8 parejas, mitad sí y mitad no. Los "no" suman lo mismo a los dos términos (razonamiento aditivo).',
   '2/3 y 4/5 ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000603', null, 'c1000000-0000-4000-8000-000000000602',
   'Calcula el término que falta en la proporción',
   'De 5 a 7, con resultado entero y el factor entre las razones no siempre entero.',
   '6/4 = 9/x', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000604', null, 'c1000000-0000-4000-8000-000000000603',
   'Decide si las magnitudes de la tabla son directamente proporcionales',
   'De 3 a 4 tablas de cuatro columnas, alternando sí y no; los "no" suman siempre lo mismo.',
   'Kilos: 2, 4, 6, 8 | Euros: 5, 7, 9, 11', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000605', null, 'c1000000-0000-4000-8000-000000000603',
   'Completa la tabla de proporcionalidad directa',
   'De 3 a 4 tablas con dos huecos, uno en cada fila; la constante puede ser de medio en medio.',
   'Kilos: 2, 4, b, 10 | Euros: 6, a, 18, 30', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000606', null, 'c1000000-0000-4000-8000-000000000604',
   'Resuelve problemas de proporcionalidad directa reduciendo a la unidad',
   'De 3 a 4, de contextos distintos (cuadernos, grifo, entradas, impresora, fruta). La cantidad nueva nunca es múltiplo de la dada.',
   '3 kg de naranjas cuestan 5,70 €. ¿Cuánto cuestan 5 kg?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000607', null, 'c1000000-0000-4000-8000-000000000604',
   'Resuelve problemas de escalas, velocidad, divisas y recetas',
   'De 3 a 4, de contextos distintos: mapas con escalas en las que 1 cm es un número redondo de km, velocidad constante, cambio de moneda y recetas.',
   'En un mapa a escala 1:50 000, dos pueblos están a 8 cm. ¿A cuántos km están?', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000608', null, 'c1000000-0000-4000-8000-000000000605',
   'Escribe el porcentaje como fracción y como decimal',
   'De 5 a 7, siempre con uno mayor que 100 y uno menor que 1.',
   '25 % = ___ (fracción) = ___ (decimal)', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000609', null, 'c1000000-0000-4000-8000-000000000606',
   'Calcula el porcentaje de una cantidad',
   'De 6 a 8, con porcentajes que se calculan de cabeza y cantidades redondas.',
   '20 % de 80 = ___', 'ejercicio', 1, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000610', null, 'c1000000-0000-4000-8000-000000000606',
   'Calcula qué porcentaje es una cantidad de otra',
   'De 4 a 6, con situaciones distintas; el resultado es un porcentaje entero.',
   '¿Qué porcentaje es 12 de 60?', 'ejercicio', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000611', null, 'c1000000-0000-4000-8000-000000000606',
   'Calcula el total conociendo una parte y su porcentaje',
   'De 3 a 4, de situaciones distintas.',
   'El 30 % de un número es 12. ¿Cuál es el número?', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000612', null, 'c1000000-0000-4000-8000-000000000607',
   'Calcula el precio después de una rebaja',
   'De 4 a 5, con artículos distintos; el resultado puede llevar céntimos.',
   'Una mochila de 40 € tiene un 25 % de descuento. ¿Cuánto se paga?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000613', null, 'c1000000-0000-4000-8000-000000000607',
   'Calcula el precio después de una subida o con impuestos',
   'De 3 a 4: IVA del 21 % y del 10 %, alquileres, abonos y entradas que suben.',
   'Un patinete cuesta 80 € sin IVA. Con el IVA del 21 %, ¿cuánto cuesta?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000614', null, 'c1000000-0000-4000-8000-000000000607',
   'Calcula el precio antes de la rebaja o sin impuestos',
   'De 3 a 4: deshacer una rebaja o quitar el IVA, con resultado en euros enteros.',
   'Con un 25 % de rebaja he pagado 45 €. ¿Cuánto costaba antes?', 'problema', 3, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000615', null, 'c1000000-0000-4000-8000-000000000608',
   'Compara dos paquetes por el precio de la unidad',
   'De 3 a 4 productos distintos. El paquete más barato en total es siempre el más caro por unidad.',
   'Yogures. A: 4 por 1,80 €. B: 6 por 2,40 €. ¿Cuál sale más barato por yogur?', 'problema', 2, false, 'activo'),
  ('c3000000-0000-4000-8000-000000000616', null, 'c1000000-0000-4000-8000-000000000608',
   'Calcula lo que se paga con una oferta',
   'De 3 a 4 promociones distintas: 3x2, 4x3, segunda unidad a mitad de precio o con descuento, descuento en el total.',
   'Botes de tomate a 1,20 € con una oferta 3x2. ¿Cuánto pagas por 6?', 'problema', 2, false, 'activo')
on conflict (id) do nothing;

insert into public.contenido_objetivos (id, tenant_id, tema_id, nombre, descripcion, sesiones_estimadas, orden) values
  ('c4000000-0000-4000-8000-000000000601', null, 'c0000000-0000-4000-8000-000000000006',
   'Trabajar con razones y proporciones',
   'Escribir razones, reconocer proporciones y calcular el término que falta.',
   2, 1),
  ('c4000000-0000-4000-8000-000000000602', null, 'c0000000-0000-4000-8000-000000000006',
   'Resolver problemas de proporcionalidad directa',
   'Reconocer magnitudes directamente proporcionales y resolver problemas reduciendo a la unidad.',
   3, 2),
  ('c4000000-0000-4000-8000-000000000603', null, 'c0000000-0000-4000-8000-000000000006',
   'Calcular porcentajes',
   'Entender qué es un porcentaje y resolver los tres cálculos básicos.',
   3, 3),
  ('c4000000-0000-4000-8000-000000000604', null, 'c0000000-0000-4000-8000-000000000006',
   'Calcular aumentos y disminuciones porcentuales',
   'Rebajas, subidas e impuestos, y el precio antes de ellos.',
   2, 4),
  ('c4000000-0000-4000-8000-000000000605', null, 'c0000000-0000-4000-8000-000000000006',
   'Tomar decisiones de consumo con cálculos',
   'Comparar ofertas por el precio de la unidad y calcular lo que se paga con una promoción.',
   1, 5)
on conflict (id) do nothing;

insert into public.contenido_objetivo_conceptos (objetivo_id, concepto_id) values
  ('c4000000-0000-4000-8000-000000000601', 'c1000000-0000-4000-8000-000000000601'),
  ('c4000000-0000-4000-8000-000000000601', 'c1000000-0000-4000-8000-000000000602'),
  ('c4000000-0000-4000-8000-000000000602', 'c1000000-0000-4000-8000-000000000603'),
  ('c4000000-0000-4000-8000-000000000602', 'c1000000-0000-4000-8000-000000000604'),
  ('c4000000-0000-4000-8000-000000000603', 'c1000000-0000-4000-8000-000000000605'),
  ('c4000000-0000-4000-8000-000000000603', 'c1000000-0000-4000-8000-000000000606'),
  ('c4000000-0000-4000-8000-000000000604', 'c1000000-0000-4000-8000-000000000607'),
  ('c4000000-0000-4000-8000-000000000605', 'c1000000-0000-4000-8000-000000000608')
on conflict (objetivo_id, concepto_id) do nothing;
