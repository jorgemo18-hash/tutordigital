-- 129_contenido_hojas_generadas.sql
-- GUARDAR LA HOJA TAL COMO SE IMPRIMIÓ, CON SU CÓDIGO.
--
-- Paso 2 de Recursos (Jorge, 23/9): cada hoja que se imprime queda guardada
-- con su código H-AAMMDD-NN, que sale en el papel. Es lo que permite volver
-- a imprimirla sin rehacerla ("Hojas recientes") y, después, ponerla como
-- deberes y corregirla (pasos 3 y 4): el código une el papel con los datos.
--
-- POR QUÉ UNA COPIA ENTERA EN JSON y no los huecos de la 118
-- (`contenido_hoja_huecos`): esa tabla apunta a ejercicios guardados en
-- `contenido_ejercicios`, pensada para cuando los ejercicios se escribían y
-- aprobaban en la base de datos. El generador que se construyó hace los
-- ejercicios en código a partir de una semilla (ver
-- claude/investigacion-generadores.md), así que no hay fila de ejercicio a
-- la que apuntar. Y aunque la hubiera, lo que hay que conservar es LO QUE SE
-- IMPRIMIÓ: si mañana cambia un generador, la hoja de ayer tiene que seguir
-- siendo la de ayer. `contenido_hoja_huecos` se queda para cuando existan
-- ejercicios guardados; hoy no la usa nada.
--
--   contenido  = la hoja exacta que pinta la plantilla (con sus retoques).
--   huecos     = qué tipo de ejercicio hay en cada puesto, su objetivo,
--                concepto, dificultad y saber: lo que la corrección necesitará
--                para saber qué se falló.
--   parametros = con qué se pidió (tema, objetivo, intensidad, todo el tema),
--                para abrirla otra vez en el generador con los mismos
--                desplegables.
--
-- Nullable: las hojas de antes (no hay ninguna: 0 filas el 23/9) no tienen
-- nada de esto. Se puede ejecutar dos veces.

alter table public.contenido_hojas
  add column if not exists contenido jsonb,
  add column if not exists huecos jsonb,
  add column if not exists parametros jsonb;

-- "Hojas recientes" es por profesor: las últimas que imprimió él.
create index if not exists idx_contenido_hojas_autor
  on public.contenido_hojas (tenant_id, creada_por, created_at desc);
