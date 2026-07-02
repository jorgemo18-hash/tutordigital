-- 073_academia_gastos_categorias.sql
-- Reconstrucción local de una migración ya aplicada en remoto directamente
-- (versión 20260701194918, "add_academia_gastos_categorias") sin haber
-- pasado por un archivo versionado en este repo — este archivo documenta
-- el esquema tal como existe hoy en producción, no la vuelve a crear.

create table if not exists public.academia_gastos_categorias (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  nombre         text not null,
  es_predefinida boolean not null default false,
  created_at     timestamptz default now(),
  unique (tenant_id, nombre)
);

alter table public.academia_gastos_categorias enable row level security;

create policy "admin puede gestionar categorias de su tenant"
  on public.academia_gastos_categorias
  for all
  using (
    tenant_id in (
      select tenant_memberships.tenant_id
      from public.tenant_memberships
      where tenant_memberships.user_id = auth.uid()
        and tenant_memberships.role = 'admin'
        and tenant_memberships.status = 'active'
    )
  );
