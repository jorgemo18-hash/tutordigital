-- 029_profiles_must_change_password.sql
-- Flag para forzar cambio de contraseña en el primer acceso.
-- Se activa al crear admin desde superadmin (y en el futuro, profesores/alumnos
-- creados con contraseña temporal). Se desactiva tras el cambio exitoso.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
