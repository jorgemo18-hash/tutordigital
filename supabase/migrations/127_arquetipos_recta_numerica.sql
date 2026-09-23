-- 127_arquetipos_recta_numerica.sql
-- LA RECTA NUMÉRICA ENTRA EN LA GENERACIÓN AUTOMÁTICA.
--
-- La 120 dejó el concepto "Representación en la recta numérica" y su único
-- arquetipo fuera de la generación, a la espera de un dibujo propio: un modelo
-- no dibuja una recta de forma fiable. Ese dibujo ya existe
-- (assets/shared/hoja/js/rectaNumerica.js): el contenido describe la recta con
-- números y el código la pinta.
--
-- Esta migración hace tres cosas:
--   1. Actualiza las instrucciones del arquetipo sembrado ("Representa estos
--      números…") y la descripción del concepto, que decían que estaba fuera.
--   2. Añade tres arquetipos: leer la recta, y las dos versiones graduadas
--      (de 2, 5 o 10 en 10), que son la de dificultad 2.
--   3. Nada más: el concepto ya estaba en el objetivo 1 (migración 123).
--
-- Los nombres de los arquetipos son los mismos, letra por letra, que los del
-- código (server/lib/generadorEjercicios/generadores/recta.js). Lo vigila
-- tests/generadorEjercicios/catalogoDeBaterias.test.mjs.
--
-- Se puede ejecutar dos veces: los inserts no duplican (`on conflict`) y los
-- updates dejan el mismo texto.

update public.contenido_conceptos
set descripcion = 'A.2 lo nombra expresamente: "Diferentes formas de representación de números enteros, fraccionarios y decimales, INCLUIDA LA RECTA NUMÉRICA". Es contenido obligatorio. El dibujo lo hace nuestro código: el contenido solo describe la recta (desde, hasta, paso, números rotulados y puntos).'
where id = 'c1000000-0000-4000-8000-000000000006';

update public.contenido_arquetipos
set instrucciones = 'De 2 a 3 rectas de 1 en 1, de -10 a 10, con el 0 y el 1 rotulados. Cinco números por recta, al menos dos negativos y un positivo, y ninguno de los que ya están rotulados. El contenido solo aporta los números: la recta la dibuja el código.'
where id = 'c3000000-0000-4000-8000-000000000009';

insert into public.contenido_arquetipos
  (id, tenant_id, concepto_id, nombre, instrucciones, ejemplo, tipo, dificultad,
   requiere_figura, estado)
values
  ('c3000000-0000-4000-8000-000000000035', null, 'c1000000-0000-4000-8000-000000000006',
   'Lee los puntos marcados en la recta',
   'De 2 a 3 rectas de 1 en 1, de -10 a 10, con el 0 y el 1 rotulados y cuatro puntos con letra. Al menos dos negativos. Las letras NO van de izquierda a derecha: si A fuera siempre el de más a la izquierda, bastaría con escribir los números en orden.',
   'Recta de -10 a 10 con los puntos A, B, C y D. A = ___  B = ___  C = ___  D = ___',
   'ejercicio', 1, true, 'activo'),
  ('c3000000-0000-4000-8000-000000000036', null, 'c1000000-0000-4000-8000-000000000006',
   'Representa en una recta graduada de 2, 5 o 10 en 10',
   'De 2 a 3 rectas, cada una con un paso distinto (2, 5 o 10), rotuladas solo en el 0 y en la primera marca, para que haya que deducir cuánto vale cada marca. Cuatro múltiplos del paso por recta, al menos dos negativos.',
   'Recta de 5 en 5 con el 0 y el 5 rotulados. Representa: -15, 20, -35, 10',
   'ejercicio', 2, true, 'activo'),
  ('c3000000-0000-4000-8000-000000000037', null, 'c1000000-0000-4000-8000-000000000006',
   'Lee una recta graduada de 2, 5 o 10 en 10',
   'De 2 a 3 rectas, cada una con un paso distinto (2, 5 o 10), rotuladas solo en el 0 y en la primera marca, con cuatro puntos con letra. Es donde aparece el error de contar marcas como si fueran unidades.',
   'Recta de 10 en 10 con el 0 y el 10 rotulados. A = ___  B = ___  C = ___  D = ___',
   'ejercicio', 2, true, 'activo')
on conflict (id) do nothing;
