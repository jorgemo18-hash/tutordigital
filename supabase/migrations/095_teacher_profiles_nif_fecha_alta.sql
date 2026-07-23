-- 095_teacher_profiles_nif_fecha_alta.sql
-- Dos campos más de contacto/administrativos del profesor, editables desde
-- el drawer del panel admin-academia — mismo patrón que telefono/direccion
-- de la migración 094 (nullable, sin llamador en instituto, no obligatorios
-- en la invitación inicial, se rellenan después desde el drawer).
--
-- fecha_alta NO lleva default a nivel de columna a propósito: como
-- teacher_profiles ya tiene filas existentes (profesores de instituto y
-- de academia ya invitados), un "default current_date" en el ALTER TABLE
-- se aplicaría también a esas filas ya existentes, dejándolas con la
-- fecha de esta migración como si fuera su alta real — una fecha
-- fabricada, no la verdadera. Quedan en NULL hasta que un admin las
-- rellene a mano desde el drawer (igual que teléfono/dirección hoy). El
-- valor por defecto de "hoy" para un profesor NUEVO se aplica solo en el
-- formulario de invitación/creación del frontend, nunca aquí.
alter table public.teacher_profiles
  add column if not exists nif_dni text,
  add column if not exists fecha_alta date;
