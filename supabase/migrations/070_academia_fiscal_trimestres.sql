-- 070_academia_fiscal_trimestres.sql
-- Pestaña Fiscal (Modelo 130/202/115/111, ver sections/finanzas/fiscal/):
-- persiste por tenant+periodo+modelo los valores editados a mano por el
-- admin (campos puramente editables como la base del alquiler, y las
-- casillas normalmente calculadas que el admin decidió sobrescribir) — los
-- valores que SÍ se derivan de academia_recibos/academia_gastos (Modelo
-- 130) no se guardan aquí, se recalculan en cada carga salvo que el admin
-- ya haya sobrescrito esa casilla concreta.
create table if not exists public.academia_fiscal_trimestres (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  anio integer not null,
  trimestre integer not null check (trimestre between 1 and 4),
  modelo text not null check (modelo in ('130', '202', '115', '111')),
  datos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, anio, trimestre, modelo)
);

create index if not exists idx_academia_fiscal_trimestres_tenant
  on public.academia_fiscal_trimestres(tenant_id, anio, trimestre);

alter table public.academia_fiscal_trimestres enable row level security;

drop policy if exists academia_fiscal_trimestres_admin_all on public.academia_fiscal_trimestres;
create policy academia_fiscal_trimestres_admin_all
on public.academia_fiscal_trimestres
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));
