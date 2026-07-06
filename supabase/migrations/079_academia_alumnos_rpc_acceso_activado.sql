-- 079_academia_alumnos_rpc_acceso_activado.sql
-- Sustituye el criterio last_sign_in_at (migración 077) por
-- academia_alumnos.acceso_activado (migración 078) en las dos RPC de
-- Activos/Pendientes — ya no hace falta el join a students/auth.users
-- (acceso_activado vive en la propia academia_alumnos), se quita.

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
SET search_path = public
AS $$
  SELECT
    a.id, a.nombre, a.curso, a.nivel, a.activo, a.fecha_alta, a.fecha_baja,
    f.id AS familia_id, f.nombre AS familia_nombre, f.email AS familia_email,
    count(*) OVER() AS total
  FROM public.academia_alumnos a
  LEFT JOIN public.academia_familias f ON f.id = a.familia_id
  WHERE a.tenant_id = p_tenant_id
    AND a.activo = true
    AND (a.student_id IS NULL OR a.acceso_activado = true)
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
SET search_path = public
AS $$
  SELECT
    a.id, a.nombre, a.curso, a.nivel, a.fecha_alta, a.created_at,
    f.id AS familia_id, f.nombre AS familia_nombre, f.email AS familia_email
  FROM public.academia_alumnos a
  LEFT JOIN public.academia_familias f ON f.id = a.familia_id
  WHERE a.tenant_id = p_tenant_id
    AND a.activo = true
    AND a.student_id IS NOT NULL
    AND a.acceso_activado = false
  ORDER BY a.created_at DESC;
$$;
