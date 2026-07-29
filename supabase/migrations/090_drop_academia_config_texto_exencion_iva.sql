-- 090_drop_academia_config_texto_exencion_iva.sql
--
-- ⚠️ PENDIENTE DE APLICAR — aplicar solo Jorge, a mano.
--
-- Reverificado 2026-07-30 (no solo el comentario original de esta
-- migración): grep completo sobre server/ y assets/ confirma cero lecturas
-- y cero escrituras de esta columna en código — el SELECT del PUT
-- (CONFIG_COLUMNS, academia.config.routes.js) no la incluye y el zod
-- UpdateConfigSchema de esa misma ruta tampoco la acepta como campo
-- editable, así que ni siquiera llega a sobrevivir un intento de escritura
-- desde el body de la petición. El texto de exención vive ya solo en
-- academia_textos_legales (tipo 'recibos'), leído desde
-- server/lib/academiaInformes/payload.js.
--
-- El SELECT de abajo es la comprobación real: para cada tenant con
-- contenido en texto_exencion_iva, ¿existe ya una fila activa equivalente
-- en academia_textos_legales? Ejecútalo tú antes del DROP y compara a
-- ojo — la migración además falla sola (RAISE EXCEPTION) si detecta algún
-- tenant sin esa fila, así que el DROP no se ejecuta en silencio sobre un
-- backfill incompleto.
--
-- select
--   c.tenant_id,
--   c.texto_exencion_iva,
--   (select tl.contenido from public.academia_textos_legales tl
--      where tl.tenant_id = c.tenant_id and tl.tipo = 'recibos' and tl.activo = true
--      limit 1) as texto_legal_recibos_activo
-- from public.academia_config c
-- where c.texto_exencion_iva is not null and trim(c.texto_exencion_iva) <> '';
--
-- Verificado 2026-07-30 contra producción (jzheomyuwztdhttejskz): 2 filas
-- (lyceo, academia-sociedad), ambas con texto_exencion_iva idéntico
-- carácter a carácter a su fila activa en academia_textos_legales.

do $$
declare
  huerfanos int;
begin
  select count(*) into huerfanos
  from public.academia_config c
  where c.texto_exencion_iva is not null
    and trim(c.texto_exencion_iva) <> ''
    and not exists (
      select 1 from public.academia_textos_legales tl
      where tl.tenant_id = c.tenant_id and tl.tipo = 'recibos' and tl.activo = true
    );

  if huerfanos > 0 then
    raise exception
      'academia_config.texto_exencion_iva tiene % tenant(s) sin fila activa equivalente en academia_textos_legales (tipo recibos) — el DROP se cancela. Ejecuta el SELECT de arriba, revisa el backfill (089) antes de reintentar.',
      huerfanos;
  end if;
end $$;

alter table public.academia_config drop column if exists texto_exencion_iva;
