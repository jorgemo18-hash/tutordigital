-- 113_academia_config_horario_reservas.sql
-- Horas reservadas para un curso: "los lunes a las 17:30 solo viene
-- Primaria".
--
-- Hay academias que separan por niveles en vez de mezclarlos: una hora para
-- Primaria, la siguiente para la ESO. Es lo primero que pregunta un padre y
-- lo que va escrito en la hoja que se le entrega; sin esto, esa hoja solo
-- puede decir el horario de apertura, que no le sirve para saber cuándo
-- puede venir su hijo.
--
-- OJO CON LO QUE ES Y LO QUE NO: esto es un RÓTULO, no una regla. Marcar el
-- lunes a las 17:30 como Primaria no impide meter ahí a un alumno de la ESO
-- desde el cuadrante, ni avisa. Si algún día se quiere que avise, será una
-- comprobación aparte que lea esta columna.
--
-- Forma del objeto (se valida y se sanea en
-- assets/shared/js/horarioReservas.js):
--
--   { "1|15:30": "primaria", "1|16:30": "eso" }
--
-- La clave es día de la semana (1 = lunes) + hora de INICIO del bloque, no
-- el número de fila de la rejilla. Por posición, cambiar la apertura del
-- centro en Ajustes movería todas las reservas una fila y el papel diría
-- que Primaria viene a una hora a la que ya no viene. Por hora de inicio,
-- una reserva que se queda sin su bloque desaparece — que es lo correcto,
-- porque esa hora ya no existe.
--
-- El valor es un nivel de academia_alumnos.nivel ('primaria', 'eso',
-- 'bachillerato'), los mismos que ya salen como etiqueta en el cuadrante.
--
-- jsonb y no una tabla por el mismo motivo que precios_publicos (migración
-- 112): el valor no se consulta, ni se filtra, ni se agrega — se lee entero
-- para pintar una rejilla de cinco por cinco.
--
-- NULL o {} = el centro no separa por cursos, que es el caso de Lyceo y de
-- la mayoría. La hoja para familias entonces sale con la lista de horas de
-- siempre, sin rejilla.

alter table public.academia_config
  add column if not exists horario_reservas jsonb;

comment on column public.academia_config.horario_reservas is
  'Horas reservadas a un curso para la hoja de familias: {"dia|HH:MM": nivel}. Es un rótulo impreso, no impide asignar alumnos de otro nivel. NULL = el centro no separa por cursos.';
