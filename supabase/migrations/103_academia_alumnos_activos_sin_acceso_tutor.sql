-- 103_academia_alumnos_activos_sin_acceso_tutor.sql
-- La pestaña "Activos" dejaba fuera a cualquier alumno con cuenta de tutor
-- creada que todavía no hubiera entrado al tutor:
--
--   AND (a.student_id IS NULL OR a.acceso_activado = true)   -- migración 079
--
-- El alta (POST /academia/alumnos) provisiona el acceso y rellena
-- student_id, y acceso_activado nace en false (migración 078) hasta que es
-- el PROPIO ALUMNO quien abre el tutor. Consecuencia: todo alumno dado de
-- alta desaparece de "Activos" y se acumula bajo el banner ámbar de
-- "inscripciones pendientes de revisar" hasta que use el tutor.
--
-- Para un centro que usa la plataforma como gestión antes de repartir el
-- tutor a los alumnos (el caso de Lyceo: gestión desde septiembre, tutor a
-- partir de enero) eso vacía la pantalla principal durante meses. La regla
-- venía del flujo del tutor y no es válida como definición de "alumno
-- activo": lo que hace activo a un alumno es estar matriculado, no haber
-- iniciado sesión.
--
-- Este cambio separa los dos conceptos:
--   - "activo"           -> academia_alumnos.activo. Es lo que filtra la lista.
--   - "ha usado el tutor" -> acceso_activado. Pasa a ser un DATO que la RPC
--     devuelve, no un filtro. Ninguna pantalla lo consume todavía; cuando en
--     enero interese ver quién no ha entrado, es un cambio de interfaz y no
--     otra migración.
--
-- Hace falta DROP + CREATE (no CREATE OR REPLACE): cambia la firma de
-- retorno al añadir la columna acceso_activado.
--
-- academia_alumnos_pendientes_confirmacion NO se toca ni se borra: sigue
-- siendo la consulta correcta para "quién tiene cuenta y no ha entrado".
-- Lo que cambia es quién la llama — /academia/inscripciones/pendientes deja
-- de sumarla al banner, que vuelve a significar solo lo que su texto dice:
-- borradores de inscripción por revisar.
--
-- Verificación tras aplicar:
--   select count(*) from public.academia_alumnos_list_activos(
--     '<tenant_id>'::uuid, null, 1, 1000);
--   -- debe coincidir con:
--   select count(*) from public.academia_alumnos
--   where tenant_id = '<tenant_id>'::uuid and activo = true;

DROP FUNCTION IF EXISTS public.academia_alumnos_list_activos(uuid, text, int, int);

CREATE FUNCTION public.academia_alumnos_list_activos(
  p_tenant_id uuid,
  p_q text,
  p_page int,
  p_page_size int
)
RETURNS TABLE (
  id uuid,
  nombre text,
  curso text,
  nivel text,
  activo boolean,
  fecha_alta date,
  fecha_baja date,
  acceso_activado boolean,
  familia_id uuid,
  familia_nombre text,
  familia_email text,
  total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id, a.nombre, a.curso, a.nivel, a.activo, a.fecha_alta, a.fecha_baja,
    a.acceso_activado,
    f.id AS familia_id, f.nombre AS familia_nombre, f.email AS familia_email,
    count(*) OVER() AS total
  FROM public.academia_alumnos a
  LEFT JOIN public.academia_familias f ON f.id = a.familia_id
  WHERE a.tenant_id = p_tenant_id
    AND a.activo = true
    AND (p_q IS NULL OR a.nombre ILIKE '%' || p_q || '%')
  ORDER BY a.nombre ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
$$;
