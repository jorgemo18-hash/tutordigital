-- 099_backfill_profiles_display_name_desde_teacher_profiles.sql
-- Backfill defensivo: para cada fila de public.profiles con
-- display_name NULL, si existe una fila en teacher_profiles para ese
-- mismo user_id con un nombre, se copia aquí.
--
-- Causa raíz (ver server/lib/profileProvisioning.js#ensureProfileExists):
-- esa función crea la fila de profiles al vuelo, como red de seguridad,
-- desde registrarFichaje/registrarCorreccion — antes de este fix, esas
-- dos llamadas no pasaban ningún display_name, así que la fila quedaba
-- con NULL para siempre aunque el profesor SÍ tuviera nombre en
-- teacher_profiles desde antes (confirmado con datos reales en
-- producción: la fila de teacher_profiles con nombre existía 2 horas
-- ANTES que la de profiles, creada por el primer fichaje). Ahora
-- ensureProfileExists ya resuelve el nombre en el momento de crear la
-- fila — esta migración es solo para la(s) fila(s) que quedaron mal
-- desde antes del fix.
--
-- Idempotente: solo toca filas con display_name NULL, y solo si
-- teacher_profiles tiene un nombre no vacío para ese user_id.
update public.profiles p
set display_name = tp.display_name
from public.teacher_profiles tp
where tp.user_id = p.id
  and p.display_name is null
  and tp.display_name is not null
  and tp.display_name <> '';
