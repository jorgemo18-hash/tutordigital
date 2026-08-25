-- 102_academia_horario_dia_semana_1_a_7.sql
-- academia_horario.dia_semana admitía solo 1-5 (migración 055, línea 50),
-- pero Ajustes › Horario ofrece el sábado desde la migración 057
-- (dias_laborables acepta 1-7 y horarioTab.js:12 pinta { num: 6, "Sáb" }).
-- Resultado en producción: un centro que abre los sábados marca la casilla,
-- guarda el alumno, y el INSERT del horario revienta contra este CHECK con
-- un 500 — pero el alumno YA se ha insertado en el paso anterior
-- (academia.alumnos.routes.js), así que queda una ficha a medias sin
-- horario y el admin acaba duplicándola.
--
-- Se amplía a 1-7 (ISO 8601: 1=lunes … 7=domingo), no a 1-6, para que la
-- base de datos deje de ser el punto más estrecho: si algún día se ofrece
-- el domingo, es un cambio de UI y no otra migración. Ampliar un CHECK no
-- puede invalidar filas existentes — todas las actuales están en 1-5.
--
-- Verificación tras aplicar:
--   select pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.academia_horario'::regclass and contype = 'c';
--   -- esperado: CHECK (((dia_semana >= 1) AND (dia_semana <= 7)))

alter table public.academia_horario
  drop constraint if exists academia_horario_dia_semana_check;

alter table public.academia_horario
  add constraint academia_horario_dia_semana_check
  check (dia_semana between 1 and 7);
