-- 095_teacher_profiles_nif_fecha_alta.sql
-- Dos campos más de contacto/administrativos del profesor, editables desde
-- el drawer del panel admin-academia — mismo patrón que telefono/direccion
-- de la migración 094 (nullable, sin llamador en instituto, no obligatorios
-- en la invitación inicial, se rellenan después desde el drawer).
--
-- fecha_alta lleva "default current_date": como teacher_profiles ya tiene
-- filas existentes (profesores de instituto y de academia ya invitados),
-- Postgres aplica ese default también a esas filas ya existentes (no solo
-- a las nuevas) — quedarán con la fecha de esta migración como alta hasta
-- que un admin la corrija a mano desde el drawer, igual que ya se puede
-- corregir teléfono/dirección hoy.
alter table public.teacher_profiles
  add column if not exists nif_dni text,
  add column if not exists fecha_alta date default current_date;
