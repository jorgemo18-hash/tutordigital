-- 030_auth_identity_utils.sql
-- Funciones auxiliares para inspeccionar y limpiar auth.identities desde el servidor.
-- auth.identities no es accesible vía PostgREST; se necesita SECURITY DEFINER.

-- Devuelve todas las identidades para un email, indicando si el usuario asociado existe.
CREATE OR REPLACE FUNCTION public.admin_find_identities_by_email(p_email text)
RETURNS TABLE(
  identity_id   uuid,
  user_id       uuid,
  provider      text,
  user_exists   boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT
    i.id          AS identity_id,
    i.user_id,
    i.provider,
    EXISTS(SELECT 1 FROM auth.users u WHERE u.id = i.user_id) AS user_exists
  FROM auth.identities i
  WHERE i.identity_data->>'email' = lower(p_email);
$$;

-- Elimina identidades huérfanas para un email (usuario ya no existe en auth.users).
-- Devuelve los registros eliminados para que el servidor pueda loguearlos.
CREATE OR REPLACE FUNCTION public.admin_delete_orphaned_identities(p_email text)
RETURNS TABLE(
  identity_id   uuid,
  user_id       uuid,
  provider      text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  DELETE FROM auth.identities
  WHERE identity_data->>'email' = lower(p_email)
    AND user_id NOT IN (SELECT id FROM auth.users)
  RETURNING id, user_id, provider;
$$;
