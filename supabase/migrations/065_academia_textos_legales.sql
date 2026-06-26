-- 065_academia_textos_legales.sql
-- Textos legales configurables (LOPD, exención de IVA, avisos de impago...)
-- reutilizables en recibos y emails — tarjeta "Textos legales" en Ajustes
-- › Marca y textos. Mismo patrón RLS que academia_descuentos_tipo (060):
-- solo admin, sin ninguna política para anon.

create table if not exists public.academia_textos_legales (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  etiqueta    text not null,
  badge       text not null check (badge in ('recibos', 'email')),
  contenido   text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists idx_academia_textos_legales_tenant on public.academia_textos_legales(tenant_id);

alter table public.academia_textos_legales enable row level security;

drop policy if exists academia_textos_legales_admin_all on public.academia_textos_legales;
create policy academia_textos_legales_admin_all
on public.academia_textos_legales
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));
