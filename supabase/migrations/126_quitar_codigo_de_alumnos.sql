-- 126_quitar_codigo_de_alumnos.sql
-- SE QUITA EL CÓDIGO DE COBRO DEL ALUMNO. Ahora vive en la familia (125).
--
-- La 124 lo puso en `academia_alumnos` y el mismo día Jorge lo corrigió: el
-- cobro es por familia. La 125 lo creó en `academia_familias` pero dejó la
-- columna vieja a propósito, porque el código desplegado entonces todavía la
-- escribía en cada guardado de alumno.
--
-- Comprobado antes de escribir esto, en la base de datos y en el código:
--   - ningún alumno tiene código (0 filas), así que no se pierde ningún dato;
--   - ninguna vista ni función de la base de datos usa la columna;
--   - el código subido (511cf15) ya no la lee ni la escribe.
--
-- El índice cae solo al borrar la columna; se borra explícito antes para que
-- quede escrito que existía y por qué desaparece.

drop index if exists public.academia_alumnos_codigo_unico;

alter table public.academia_alumnos
  drop column if exists codigo;
