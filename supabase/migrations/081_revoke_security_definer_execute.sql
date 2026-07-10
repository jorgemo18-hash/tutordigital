-- Hardening: revoca EXECUTE de anon/authenticated en RPC SECURITY DEFINER
-- expuestas via /rest/v1/rpc/*. Todas las llamadas reales en server/ usan
-- createSupabaseAdmin() (service_role), que no depende de estos grants.
--
-- has_active_role/is_active_member también se usan dentro de políticas RLS
-- `to authenticated` en tablas academia_*. Hoy es seguro revocarles el
-- EXECUTE porque el frontend nunca crea un cliente Supabase propio (todo
-- pasa por el backend con service_role). Si en el futuro se habilita acceso
-- directo a PostgREST con el JWT de un usuario, esas políticas pasarán de
-- "filtran por RLS" a "error de permiso" — sigue siendo fail-closed, no abre
-- ningún hueco nuevo, pero si se retoma ese camino hay que re-otorgar
-- EXECUTE en has_active_role/is_active_member antes de activarlo.
--
-- 7 de las 8 funciones fueron creadas sin `REVOKE ALL FROM PUBLIC`, así que
-- además del grant directo a anon/authenticated tenían EXECUTE heredado vía
-- PUBLIC (todo rol es miembro implícito de PUBLIC en Postgres). Revocar solo
-- de anon/authenticated no bastaba — había que revocar también de PUBLIC
-- (verificado con has_function_privilege tras aplicar; redeem_student_invite
-- ya no tenía grant a PUBLIC, por eso fue la única que quedó bloqueada en el
-- primer intento).

REVOKE EXECUTE ON FUNCTION public.admin_find_user_by_email(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_find_identities_by_email(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_delete_orphaned_identities(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_student_invite(uuid, uuid, uuid, text, text, uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_role(uuid, text[]) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_member(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.academia_alumnos_list_activos(uuid, text, integer, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.academia_alumnos_pendientes_confirmacion(uuid) FROM anon, authenticated, PUBLIC;
