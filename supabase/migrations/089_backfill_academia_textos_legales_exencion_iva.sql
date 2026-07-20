-- 089_backfill_academia_textos_legales_exencion_iva.sql
-- Migración defensiva: para cada tenant con contenido en
-- academia_config.texto_exencion_iva que todavía NO tenga una fila activa
-- equivalente en academia_textos_legales (tipo 'recibos'), se crea esa fila
-- con el mismo contenido — para no perder el texto de ningún tenant al
-- consolidar el PDF/email de recibo sobre academia_textos_legales
-- (server/lib/academiaInformes/payload.js). Idempotente: si ya existe una
-- fila activa tipo 'recibos' para el tenant, no se toca nada (evita
-- duplicar, p.ej. Lyceo ya la tenía).
--
-- Aplicada ya en producción vía apply_migration (Supabase MCP) el
-- 2026-07-20 — este archivo documenta esa migración en el repo. Verificado:
-- Lyceo no se duplicó (ya tenía su fila); el tenant "academia sociedad"
-- (único que solo tenía el campo viejo relleno) recibió su fila nueva con
-- el contenido preservado.
insert into public.academia_textos_legales (tenant_id, etiqueta, tipo, contenido, activo)
select c.tenant_id, 'Exención de IVA', 'recibos', c.texto_exencion_iva, true
from public.academia_config c
where c.texto_exencion_iva is not null
  and c.texto_exencion_iva <> ''
  and not exists (
    select 1 from public.academia_textos_legales tl
    where tl.tenant_id = c.tenant_id and tl.tipo = 'recibos' and tl.activo = true
  );
