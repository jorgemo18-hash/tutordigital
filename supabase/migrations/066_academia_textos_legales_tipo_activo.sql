-- 066_academia_textos_legales_tipo_activo.sql
-- Unifica "Texto LOPD" y "Textos legales" en una sola lista. La tabla
-- academia_textos_legales (065) ya tenía una columna `badge` con el mismo
-- propósito que el `tipo` pedido aquí (recibos/email) — en vez de crear
-- una columna redundante, se renombra badge→tipo y se le añade la opción
-- "ambos". La tabla está vacía en producción (creada en 065, sin uso real
-- todavía), así que el rename es seguro.

alter table public.academia_textos_legales rename column badge to tipo;
alter table public.academia_textos_legales drop constraint if exists academia_textos_legales_badge_check;
alter table public.academia_textos_legales add constraint academia_textos_legales_tipo_check check (tipo in ('email', 'recibos', 'ambos'));
alter table public.academia_textos_legales add column if not exists activo boolean not null default true;

-- Migra los dos campos sueltos de academia_config a la lista, solo si no
-- existe ya un texto con esa etiqueta para el tenant (idempotente — para
-- poder re-ejecutar esta migración sin duplicar filas).
insert into public.academia_textos_legales (tenant_id, etiqueta, tipo, contenido)
select tenant_id, 'LOPD — pie de email', 'email', texto_lopd
from public.academia_config
where texto_lopd is not null and trim(texto_lopd) <> ''
  and not exists (
    select 1 from public.academia_textos_legales tl
    where tl.tenant_id = academia_config.tenant_id and tl.etiqueta = 'LOPD — pie de email'
  );

insert into public.academia_textos_legales (tenant_id, etiqueta, tipo, contenido)
select tenant_id, 'Exención de IVA', 'recibos', texto_exencion_iva
from public.academia_config
where texto_exencion_iva is not null and trim(texto_exencion_iva) <> ''
  and not exists (
    select 1 from public.academia_textos_legales tl
    where tl.tenant_id = academia_config.tenant_id and tl.etiqueta = 'Exención de IVA'
  );

-- texto_lopd desaparece de academia_config (ya vive en la lista de
-- arriba). texto_exencion_iva se queda — la tarjeta "Recibos" de Ajustes
-- todavía la edita directamente; solo la generación del recibo/email deja
-- de leerla de aquí (ver server/lib/academiaRecibos).
alter table public.academia_config drop column if exists texto_lopd;
