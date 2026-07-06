-- 076_academia_alumnos_pendientes_confirmacion.sql
-- Un alumno de academia con student_id (tiene cuenta de tutor) cuya cuenta
-- en auth.users aún no confirmó el email debe aparecer en "Pendientes" en
-- vez de "Activos" — sin student_id (sin email) siempre va a Activos.
--
-- auth.users no es accesible vía PostgREST (por eso ya existe
-- admin_find_user_by_email, ver migración 031) — estas dos funciones
-- SECURITY DEFINER hacen el join necesario en SQL, evitando N+1 llamadas a
-- la Admin API o un trigger nuevo sobre auth.users. Se llaman siempre con
-- el cliente admin/service-role (createSupabaseAdmin()), igual que
-- admin_find_user_by_email.

-- Reemplaza la query PostgREST de la pestaña Activos (GET /academia/alumnos
-- ?activo=true) — misma paginación (LIMIT/OFFSET) y búsqueda por nombre
-- (p_q), pero excluye alumnos con cuenta sin confirmar. `total` va como
-- columna repetida (count(*) OVER()) para no necesitar una segunda query.
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
    AND (a.student_id IS NULL OR u.email_confirmed_at IS NOT NULL)
    AND (p_q IS NULL OR a.nombre ILIKE '%' || p_q || '%')
  ORDER BY a.nombre ASC
  LIMIT p_page_size
  OFFSET (p_page - 1) * p_page_size;
$$;

-- Alumnos "activos" con cuenta creada pero email aún sin confirmar — se
-- fusionan en JS con los borradores existentes de GET
-- /academia/inscripciones/pendientes (activo=false AND fecha_baja IS NULL).
-- Sin paginar, igual que esa lista hoy.
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
    AND u.email_confirmed_at IS NULL
  ORDER BY a.created_at DESC;
$$;
