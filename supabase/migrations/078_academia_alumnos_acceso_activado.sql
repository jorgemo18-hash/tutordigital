-- 078_academia_alumnos_acceso_activado.sql
-- Se activa (true) cuando el alumno entra al tutor por primera vez (ver
-- server/routes/v1/academia.alumno-acceso.routes.js, llamado desde
-- assets/student/js/bootstrap/studentBootstrap.js).
--
-- Reemplaza a last_sign_in_at (migración 077, ver 079) como criterio de
-- "cuenta activada": last_sign_in_at vive en auth.users, por-CUENTA, no
-- por-alumno — un mismo tutor con dos hijos en la misma academia comparte
-- una sola cuenta (mismo email), así que iniciar sesión para ver a uno
-- marcaría también al otro como "activado" aunque nunca se haya entrado a
-- su ficha. acceso_activado vive en academia_alumnos, un valor por alumno.
ALTER TABLE public.academia_alumnos
ADD COLUMN acceso_activado boolean NOT NULL DEFAULT false;
