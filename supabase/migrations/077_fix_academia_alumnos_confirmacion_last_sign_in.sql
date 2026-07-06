-- 077_fix_academia_alumnos_confirmacion_last_sign_in.sql
-- Corrige el criterio de "cuenta sin confirmar" de las dos RPC de la
-- migración 076: usaban auth.users.email_confirmed_at, pero
-- resolverOCrearUsuario() (academiaAlumnoAcceso.js) crea la cuenta con
-- createUser({..., email_confirm: true}), que rellena email_confirmed_at
-- en el momento de crearla — no cuando el alumno completa el enlace de
-- recovery y fija su contraseña. Verificado en producción: 0 de 9
-- usuarios tienen email_confirmed_at nulo, así que el filtro nunca excluía
-- a nadie.
--
-- El campo que sí cambia al completar el flujo es last_sign_in_at (queda
-- NULL hasta que el usuario abre sesión al visitar el enlace); ver caso
-- real "yorch": last_sign_in_at pasó de NULL a un timestamp ~7 minutos
-- después de crear el alumno, justo al activarlo.

CREATE OR REPLACE FUNCTION public.academia_alumnos_list_activos(
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
  familia_id uuid,
  familia_nombre text,
  familia_email text,
  total bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    a.id, a.nombre, a.curso, a.nivel, a.activo, a.fecha_alta, a.fecha_baja,
    f.id AS familia_id, f.nombre AS familia_nombre, f.email AS familia_email,
    count(*) OVER() AS total
  FROM public.academia_alumnos a
  LEFT JOIN public.academia_familias f ON f.id = a.familia_id
  LEFT JOIN public.students s ON s.id = a.student_id
  LEFT JOIN auth.users u ON u.id = s.user_id
  WHERE a.tenant_id = p_tenant_id
    AND a.activo = true
    AND (a.student_id IS NULL OR u.last_sign_in_at IS NOT NULL)
    AND (p_q IS NULL OR a.nombre ILIKE '%' || p_q || '%')
  ORDER BY a.nombre ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
$$;

CREATE OR REPLACE FUNCTION public.academia_alumnos_pendientes_confirmacion(
  p_tenant_id uuid
)
RETURNS TABLE (
  id uuid,
  nombre text,
  curso text,
  nivel text,
  fecha_alta date,
  created_at timestamptz,
  familia_id uuid,
  familia_nombre text,
  familia_email text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    a.id, a.nombre, a.curso, a.nivel, a.fecha_alta, a.created_at,
    f.id AS familia_id, f.nombre AS familia_nombre, f.email AS familia_email
  FROM public.academia_alumnos a
  LEFT JOIN public.academia_familias f ON f.id = a.familia_id
  JOIN public.students s ON s.id = a.student_id
  JOIN auth.users u ON u.id = s.user_id
  WHERE a.tenant_id = p_tenant_id
    AND a.activo = true
    AND u.last_sign_in_at IS NULL
  ORDER BY a.created_at DESC;
$$;
