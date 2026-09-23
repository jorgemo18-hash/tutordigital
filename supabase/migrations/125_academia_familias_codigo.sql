-- 125_academia_familias_codigo.sql
-- EL CÓDIGO DE COBRO ES DE LA FAMILIA, NO DEL ALUMNO.
--
-- Corrige la 124, que lo puso en `academia_alumnos`. Jorge, 23/09/2026, el
-- mismo día, después de verla funcionando: *"el código, no dentro del alumno
-- sino al crear o modificar familia, ya que es para cobrar a toda la familia,
-- un código por familia"*.
--
-- Tiene razón y el modelo ya lo decía: el recibo es por familia, el IBAN es
-- de la familia y el cargo en el banco es uno por familia. Un código por
-- alumno obligaba a elegir cuál de los hermanos "lleva" el código del cobro.
--
-- Todo lo demás es igual que en la 124 y por los mismos motivos:
--   - lo escribe la academia, no lo genera el programa (viene del banco);
--   - NULL = sin código, estado normal y permanente;
--   - único dentro del centro, no globalmente;
--   - índice parcial, porque hoy ninguna familia lo tiene.
--
-- LA COLUMNA DE `academia_alumnos` NO SE BORRA AQUÍ, y es a propósito. El
-- código desplegado ahora mismo (bb1eee9) escribe esa columna en cada
-- guardado de alumno: si esta migración la borrara antes de que se suba el
-- código nuevo, guardar cualquier alumno fallaría en el rato entre las dos
-- cosas. Se borrará en una migración aparte cuando el código nuevo esté
-- desplegado. Comprobado antes de escribir esto: ningún alumno tiene código,
-- así que no hay nada que trasladar.

alter table public.academia_familias
  add column if not exists codigo text;

comment on column public.academia_familias.codigo is
  'Código con el que la academia identifica a la familia en sus cobros bancarios. Lo escribe el admin, no lo genera el programa: viene de fuera (del banco), como el IBAN. NULL = la academia no usa códigos o esta familia todavía no tiene. Único dentro del centro.';

-- Lo que hace cumplir "avisa si repito uno". El backend reconoce el choque
-- por el NOMBRE de este índice (ver server/lib/academiaFamilias/
-- codigoRepetido.js): si se renombra aquí, hay que renombrarlo allí, y un
-- test lo vigila.
create unique index if not exists academia_familias_codigo_unico
  on public.academia_familias (tenant_id, codigo)
  where codigo is not null;
