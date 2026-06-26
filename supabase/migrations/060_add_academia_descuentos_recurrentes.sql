-- 060_add_academia_descuentos_recurrentes.sql
-- Descuentos recurrentes configurables por tenant (p.ej. "Pago anticipado
-- 5%", "Beca familia numerosa") y su asignación por alumno. Mismo patrón
-- RLS que el resto de tablas academia_* (ver 055_academia_module_schema.sql):
-- solo admin, sin ninguna política para anon.
--
-- academia_alumno_descuentos no lleva tenant_id propio (igual que
-- academia_recibos_lineas en 059_academia_recibos.sql) — su RLS deriva el
-- tenant a través de academia_alumnos.alumno_id.

create table if not exists public.academia_descuentos_tipo (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  concepto    text not null,
  porcentaje  numeric(5,2) not null check (porcentaje > 0 and porcentaje <= 100),
  acumulable  boolean not null default true,
  intervalo   text not null check (intervalo in ('primer_mes', 'primer_trimestre', 'siempre')),
  created_at  timestamptz not null default now()
);

create table if not exists public.academia_alumno_descuentos (
  id                 uuid primary key default gen_random_uuid(),
  alumno_id          uuid not null references public.academia_alumnos(id) on delete cascade,
  descuento_tipo_id  uuid not null references public.academia_descuentos_tipo(id) on delete cascade,
  activo             boolean not null default true,
  unique (alumno_id, descuento_tipo_id)
);

create index if not exists idx_academia_descuentos_tipo_tenant on public.academia_descuentos_tipo(tenant_id);
create index if not exists idx_academia_alumno_descuentos_alumno on public.academia_alumno_descuentos(alumno_id);
create index if not exists idx_academia_alumno_descuentos_tipo on public.academia_alumno_descuentos(descuento_tipo_id);

alter table public.academia_descuentos_tipo    enable row level security;
alter table public.academia_alumno_descuentos  enable row level security;

drop policy if exists academia_descuentos_tipo_admin_all on public.academia_descuentos_tipo;
create policy academia_descuentos_tipo_admin_all
on public.academia_descuentos_tipo
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_alumno_descuentos_admin_all on public.academia_alumno_descuentos;
create policy academia_alumno_descuentos_admin_all
on public.academia_alumno_descuentos
for all
to authenticated
using (
  exists (
    select 1 from public.academia_alumnos a
    where a.id = academia_alumno_descuentos.alumno_id
      and public.has_active_role(a.tenant_id, array['admin'])
  )
)
with check (
  exists (
    select 1 from public.academia_alumnos a
    where a.id = academia_alumno_descuentos.alumno_id
      and public.has_active_role(a.tenant_id, array['admin'])
  )
);
