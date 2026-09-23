-- 124_academia_alumnos_codigo.sql
-- EL CÓDIGO CON EL QUE LA ACADEMIA IDENTIFICA AL ALUMNO EN EL BANCO.
--
-- DE DÓNDE SALE. Jorge, 23/09/2026: *"cuando yo hago los cobros en el banco,
-- cada alumno tiene un código, con lo cual en academias cuando ingresamos los
-- datos de un alumno nuevo añadimos un espacio que sea código de alumno o
-- algo así, por si hay otras academias que clasifican a sus alumnos por un
-- código"*.
--
-- NO LO GENERA EL PROGRAMA, LO ESCRIBE LA ACADEMIA. Es la decisión de fondo y
-- la eligió Jorge sabiendo el precio: un correlativo automático (A-001,
-- A-002…) sería más cómodo para los alumnos nuevos, pero NO coincidiría con
-- los códigos que la academia ya tiene metidos en el banco para los de ahora,
-- y entonces habría dos numeraciones para lo mismo. El código es un dato que
-- viene de fuera del programa, como el IBAN: aquí se guarda y se enseña.
--
-- NULLABLE. Los alumnos que ya existen no lo tienen y se irá poniendo a mano
-- según vayan haciendo falta; y una academia que no clasifique por código no
-- lo usará nunca. "Sin código" es un estado normal y permanente, no un dato
-- pendiente, así que no hay nada que rellenar retroactivamente ni ningún
-- valor por defecto que inventar.
--
-- ÚNICO POR CENTRO, Y NO GLOBALMENTE. Dos academias distintas pueden usar el
-- mismo "A-14" sin que eso signifique nada: el código solo identifica dentro
-- de la contabilidad de UNA academia. El índice lleva tenant_id por delante
-- por el mismo motivo por el que lo lleva todo lo demás de este módulo.
--
-- ÍNDICE PARCIAL (`where codigo is not null`): sin el `where`, PostgreSQL
-- trata cada NULL como distinto y el índice único los admitiría todos igual
-- — pero se llenaría de entradas inútiles, una por cada alumno sin código,
-- que hoy son todos. Con el `where` solo indexa los que tienen código, que es
-- lo único que hay que comparar.
--
-- No se toca ninguna política RLS: la columna vive en una tabla ya acotada
-- por tenant y solo la escribe el backend con la service key.

alter table public.academia_alumnos
  add column if not exists codigo text;

comment on column public.academia_alumnos.codigo is
  'Código con el que la academia identifica al alumno en sus cobros bancarios. Lo escribe el admin, no lo genera el programa: viene de fuera (del banco), como el IBAN. NULL = la academia no usa códigos o este alumno todavía no tiene. Único dentro del centro.';

-- El índice es lo que hace cumplir "avisa si repito uno": el backend traduce
-- la violación de unicidad a un mensaje en la pantalla del alumno, en vez de
-- dejar que salga un 500.
create unique index if not exists academia_alumnos_codigo_unico
  on public.academia_alumnos (tenant_id, codigo)
  where codigo is not null;
