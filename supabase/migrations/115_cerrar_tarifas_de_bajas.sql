-- 115_cerrar_tarifas_de_bajas.sql
-- Cierra las tarifas que se quedaron abiertas al dar de baja a un alumno.
--
-- EL FALLO (auditoría del 08/09/2026). `marcarBajaYCerrarHorario` cerraba el
-- horario del alumno pero NO su tarifa. La función para hacerlo
-- —`cerrarTarifaVigente`— ya existía, pero solo la llamaba el cambio de
-- precio. El arreglo del código va en el mismo commit que esta migración;
-- esto limpia lo que ya quedó mal.
--
-- CUÁNTO. En producción, 9 alumnos dados de baja seguían con tarifa vigente,
-- 730 €/mes en total.
--
-- POR QUÉ NO SE COBRÓ DE MÁS. Los recibos se generan sobre alumnos con
-- `activo = true` (ver academiaRecibos/consultas.js), así que a esos 9 nunca
-- se les facturó. El daño no es contable, es que la tabla miente: el primer
-- informe de "ingresos previstos" que lea tarifas vigentes sin unirlas con
-- `activo` dará un número inflado y nada fallará al hacerlo.
--
-- LOS BORRADORES NO SE TOCAN, y esto es lo importante de esta migración.
-- Un borrador se codifica como `activo = false` con `fecha_baja` NULL (ver
-- academiaAlumnos/estado.js): es un alumno a medio dar de alta, no uno que
-- se ha ido. Tener su precio ya puesto es lo correcto — es justo lo que se
-- quiere que esté listo cuando se le active. En producción hay 4 así, con
-- 335 €/mes. Cerrarles la tarifa sería romper un alta a medias.
--
-- Por eso el filtro es `fecha_baja IS NOT NULL` y no `activo = false`.
--
-- La fecha de cierre es la `fecha_baja` de cada alumno, no "hoy": la tarifa
-- dejó de aplicarse el día que se fue, no el día que se ejecuta este SQL.
-- Mismo criterio que ya usa el cierre del horario.

update public.academia_tarifas t
set fecha_fin = a.fecha_baja
from public.academia_alumnos a
where t.alumno_id = a.id
  and t.tenant_id = a.tenant_id
  and t.fecha_fin is null
  and a.activo = false
  and a.fecha_baja is not null;

-- Comprobación posterior (ejecutar a mano tras aplicar; debe devolver 0):
--
--   select count(*)
--   from academia_alumnos a
--   join academia_tarifas t on t.alumno_id = a.id and t.fecha_fin is null
--   where a.activo = false and a.fecha_baja is not null;
