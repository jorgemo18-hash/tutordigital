-- 105_academia_config_acceso_tutor.sql
-- Separa "alumno matriculado" de "alumno con acceso al tutor" también en el
-- ALTA. La migración 103 hizo esa separación en el listado; faltaba aquí.
--
-- Hasta ahora, dar de alta a un alumno con email siempre:
--   - exigía ese email para poder guardar (AlumnoCreateSchema),
--   - creaba una cuenta en auth.users,
--   - y le enviaba un correo "Tu acceso a TutorDigital" con un enlace para
--     fijar contraseña y entrar al tutor.
--
-- Para un centro que usa la plataforma como gestión y no ha repartido el
-- tutor a sus alumnos, eso significa bloquear el alta por un dato que no
-- necesita y mandar a cada familia una invitación a algo que no existe
-- todavía. El caso real: Lyceo arranca el curso en septiembre usando solo
-- gestión y no da el tutor hasta enero.
--
-- Por defecto FALSE, y a propósito: un centro nuevo no está usando el tutor
-- el primer día. Encenderlo es una decisión explícita desde
-- Ajustes › Datos del centro, no algo que herede sin querer.
--
-- No hay backfill a true para los centros existentes: hoy ninguno tiene el
-- tutor repartido de verdad (Lyceo lo empieza en enero), así que el default
-- es también el valor correcto para los que ya existen.
--
-- Verificación tras aplicar:
--   select nombre_emisor, acceso_tutor_activo from public.academia_config;

alter table public.academia_config
  add column if not exists acceso_tutor_activo boolean not null default false;

comment on column public.academia_config.acceso_tutor_activo is
  'Si el centro ha repartido el tutor IA a sus alumnos. Apagado: el alta no exige email del alumno, no crea cuenta en auth.users y no envía la invitación.';
