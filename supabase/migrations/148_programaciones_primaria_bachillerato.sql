-- 148_programaciones_primaria_bachillerato.sql
-- PROGRAMACIONES DE PRIMARIA Y BACHILLERATO (30/09/2026). El currículo ya
-- tiene las tres etapas (server/lib/curriculo/); la tabla solo admitía los
-- cursos de ESO (1-4). Primaria llega a 6.º.
--
-- La etapa no necesita columna: va en materia_slug ("primaria-matematicas",
-- "bachillerato-fisica"; sin prefijo, ESO, como las que ya hay). Que el curso
-- exista en esa etapa (no hay 5.º de ESO ni 3.º de Bachillerato) lo
-- comprueba el servidor (programaciones.js, CursoDeLaMateria).
--
-- Idempotente: se puede ejecutar dos veces.

alter table public.programaciones
  drop constraint if exists programaciones_curso_check;

alter table public.programaciones
  add constraint programaciones_curso_check check (curso between 1 and 6);
