-- 106_academia_config_max_alumnos_franja.sql
-- Plazas por franja horaria del centro.
--
-- Hasta ahora no existía ningún concepto de capacidad en todo el sistema
-- (verificado: ni columna, ni constraint, ni validación en academia_horario
-- ni en ninguna otra tabla). El admin asignaba franjas a un alumno sin
-- ninguna señal de cuántos había ya en esa hora, así que "esta franja está
-- llena" no se podía ni calcular ni mostrar.
--
-- NULL = sin límite, y es el valor por defecto a propósito: un centro que no
-- lo ha configurado no debe empezar a ver avisos de "lleno" contra un número
-- que nadie ha decidido. Con NULL la rejilla sigue mostrando la ocupación
-- real (cuántos alumnos hay en cada franja), simplemente sin compararla con
-- nada.
--
-- El límite AVISA, no bloquea: el guardado nunca se impide por superarlo.
-- Una academia mete un alumno más de forma excepcional continuamente, y un
-- bloqueo duro convertiría un dato útil en un obstáculo. La comprobación
-- vive en la interfaz (ver ocupacion.js / horarioSection.js), no como
-- constraint en la base de datos, justo por eso.

alter table public.academia_config
  add column if not exists max_alumnos_por_franja integer
  check (max_alumnos_por_franja is null or max_alumnos_por_franja > 0);

comment on column public.academia_config.max_alumnos_por_franja is
  'Plazas por franja horaria. NULL = sin límite. Avisa en la rejilla de horario, nunca bloquea el guardado.';
