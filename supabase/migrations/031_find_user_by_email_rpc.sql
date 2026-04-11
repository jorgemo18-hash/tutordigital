-- 031_find_user_by_email_rpc.sql
-- Busca un usuario en auth.users por email (SECURITY DEFINER para acceder al auth schema).
CREATE OR REPLACE FUNCTION public.admin_find_user_by_email(p_email text)
RETURNS TABLE(user_id uuid, email text, created_at timestamptz, email_confirmed_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT id, email, created_at, email_confirmed_at
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;
$$;
