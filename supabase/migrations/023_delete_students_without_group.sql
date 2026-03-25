-- Elimina registros huérfanos en students creados por el flujo /tenant/join
-- (ahora desactivado). Esos registros tienen group_id NULL porque ese endpoint
-- no resolvía el grupo, y approval_status = 'pending' porque requerían aprobación
-- manual. Son datos de prueba sin uso real.
delete from students where group_id is null;
