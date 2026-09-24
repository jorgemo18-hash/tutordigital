-- 133_autor_de_hojas_y_programaciones.sql
-- EL AUTOR DE UNA HOJA O UNA PROGRAMACIÓN ES UN USUARIO, NO UN PERFIL.
--
-- `contenido_hojas.creada_por` (118) y `programaciones.creada_por` (130)
-- apuntaban a `profiles(id)`. Pero `profiles` NO tiene una fila por usuario:
-- el 24/09/2026 había 13 usuarios y 8 sin perfil, entre ellos el profesor de
-- prueba del instituto. Para ellos, crear una programación daba 500 (clave
-- foránea violada) y guardar la hoja al imprimirla habría fallado igual.
--
-- Se apunta a `auth.users(id)`, que es lo que ya hacen `tasks.teacher_id` y
-- el resto de "quién lo hizo" del instituto: todo usuario que puede entrar
-- tiene su fila ahí. Mismo `on delete set null`. Las dos tablas estaban
-- vacías de autores huérfanos (0 hojas el 24/9), así que no hay nada que
-- migrar. Se puede ejecutar dos veces.

alter table public.contenido_hojas
  drop constraint if exists contenido_hojas_creada_por_fkey;
alter table public.contenido_hojas
  add constraint contenido_hojas_creada_por_fkey
  foreign key (creada_por) references auth.users(id) on delete set null;

alter table public.programaciones
  drop constraint if exists programaciones_creada_por_fkey;
alter table public.programaciones
  add constraint programaciones_creada_por_fkey
  foreign key (creada_por) references auth.users(id) on delete set null;
