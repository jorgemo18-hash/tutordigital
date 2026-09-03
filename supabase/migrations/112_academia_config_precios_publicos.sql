-- 112_academia_config_precios_publicos.sql
-- La lista de precios del centro: la tabla que va debajo del horario en la
-- hoja que se le entrega a las familias.
--
-- NO ES academia_tarifas. Esa tabla guarda el precio de UN alumno concreto
-- —con su descuento, su fecha de inicio y su histórico— y de ahí salen los
-- recibos. Esto es la lista pública ("Primaria, 2 días a la semana: 55 €"),
-- que no está atada a ningún alumno, no tiene histórico y solo existe para
-- imprimirse. Mezclarlas habría significado meter filas sin alumno_id en
-- una tabla de la que se factura, que es la clase de atajo que acaba en un
-- recibo con un precio que nadie puso.
--
-- Por qué jsonb y no una tabla de precios: cada academia monta la tabla a
-- su manera. Una cobra por días a la semana y etapa, otra por asignatura,
-- otra por "individual / grupo reducido / grupo". El eje de las filas y el
-- de las columnas los pone el admin con un "+", así que no hay un esquema
-- que se pueda escribir por adelantado sin adivinar. Y como el valor no se
-- consulta, ni se filtra, ni se agrega —solo se lee entero para pintar la
-- hoja— una tabla relacional solo aportaría el coste de los joins y de
-- mantener el orden de filas y columnas a mano.
--
-- Forma del objeto (ver assets/shared/js/preciosPublicos.js, que es donde
-- se valida y se sanea; aquí no hay CHECK porque un jsonb mal formado debe
-- dar un error explicado en castellano en el backend, no un 500 opaco):
--
--   {
--     "columnas": [{"id": "c1", "titulo": "Primaria"}],
--     "filas":    [{"id": "f1", "titulo": "2 días / semana"}],
--     "precios":  {"f1|c1": "55 €"},
--     "nota":     "Matrícula gratuita"
--   }
--
-- Los precios van indexados por ID de fila y columna, nunca por posición:
-- así borrar la fila del medio deja los demás precios donde estaban, en vez
-- de desplazarlos todos una fila sin que nadie lo note.
--
-- El precio es TEXTO a propósito: en una academia real la casilla pone
-- "55 €", "55 €/mes" o "a consultar". Esta tabla no calcula nada.
--
-- NULL = el centro nunca abrió la pestaña. En ese caso el editor propone
-- una tabla de ejemplo con las casillas vacías, y la hoja de familias sale
-- solo con el horario.

alter table public.academia_config
  add column if not exists precios_publicos jsonb;

comment on column public.academia_config.precios_publicos is
  'Lista de precios pública del centro para la hoja de familias: {columnas, filas, precios, nota}. NULL = sin configurar. No confundir con academia_tarifas (precio por alumno, del que salen los recibos).';
