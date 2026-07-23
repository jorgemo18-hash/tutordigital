-- 093_academia_fichajes.sql
-- Control horario (RDL 8/2019) para trabajadores de una academia (admin y
-- profesor, mismos roles que ya existen en tenant_memberships — no hay un
-- rol "recepción" aparte, el personal de recepción usa el rol 'admin').
-- Modelo append-only real: nunca se hace UPDATE ni DELETE sobre un
-- fichaje, ni siquiera desde el propio backend (ver el trigger al final
-- de este archivo) — toda corrección es una fila NUEVA que referencia a
-- la original en fichaje_corregido_id, con motivo obligatorio.
create table if not exists public.academia_fichajes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  worker_profile_id uuid not null references public.profiles(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida')),
  -- Nunca acepta un timestamp del cliente — lo pone Postgres al insertar,
  -- el backend jamás debe mandar este campo en el INSERT.
  timestamp_servidor timestamptz not null default now(),
  origen text not null check (origen in ('worker', 'admin_correccion')),
  fichaje_corregido_id uuid references public.academia_fichajes(id),
  motivo text,
  corregido_por uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint academia_fichajes_correccion_shape check (
    -- Una corrección SIEMPRE lleva motivo y quién la hizo; un fichaje del
    -- propio trabajador nunca lleva ninguno de los dos (evita que el
    -- backend se equivoque de forma silenciosa y guarde una corrección
    -- sin rastro de motivo/autor, o un fichaje normal con datos de
    -- corrección colgando).
    (origen = 'admin_correccion' and motivo is not null and corregido_por is not null)
    or
    (origen = 'worker' and motivo is null and corregido_por is null)
  )
);

create index if not exists idx_academia_fichajes_tenant_worker_fecha
  on public.academia_fichajes(tenant_id, worker_profile_id, timestamp_servidor);
create index if not exists idx_academia_fichajes_corregido
  on public.academia_fichajes(fichaje_corregido_id) where fichaje_corregido_id is not null;

alter table public.academia_fichajes enable row level security;

-- El backend usa service_role (bypasa RLS) para todo lo de hoy — estas
-- políticas son la misma red de seguridad por si en el futuro se expone
-- acceso directo del frontend a PostgREST (ver [[project_deuda_tecnica]]),
-- no el mecanismo real de control de acceso de la app actual. El control
-- de acceso real (quién puede fichar, quién puede corregir) vive en las
-- rutas del backend (server/routes/v1/academia-fichajes/).
drop policy if exists academia_fichajes_worker_select on public.academia_fichajes;
create policy academia_fichajes_worker_select
on public.academia_fichajes
for select
to authenticated
using (worker_profile_id = auth.uid() and origen = 'worker');

drop policy if exists academia_fichajes_worker_insert on public.academia_fichajes;
create policy academia_fichajes_worker_insert
on public.academia_fichajes
for insert
to authenticated
with check (
  worker_profile_id = auth.uid()
  and origen = 'worker'
  and public.has_active_role(tenant_id, array['admin', 'teacher'])
);

drop policy if exists academia_fichajes_admin_select on public.academia_fichajes;
create policy academia_fichajes_admin_select
on public.academia_fichajes
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_fichajes_admin_correccion_insert on public.academia_fichajes;
create policy academia_fichajes_admin_correccion_insert
on public.academia_fichajes
for insert
to authenticated
with check (
  origen = 'admin_correccion'
  and corregido_por = auth.uid()
  and public.has_active_role(tenant_id, array['admin'])
);

-- Ninguna política de UPDATE/DELETE arriba a propósito: sin política,
-- Postgres deniega esa operación a `authenticated` por defecto. Pero
-- service_role SIEMPRE bypasa RLS (es su propósito, no un descuido) — así
-- que las políticas de arriba NO impiden que nuestro propio backend (que
-- usa service_role) haga un UPDATE o DELETE por error. El append-only
-- real, el que de verdad protege incluso de un bug del backend, es este
-- trigger: rechaza cualquier UPDATE/DELETE sobre esta tabla venga de
-- quien venga, RLS aparte.
create or replace function public.academia_fichajes_bloquear_update_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'academia_fichajes es append-only: no se permite % — inserta una corrección nueva en su lugar', tg_op;
end;
$$;

drop trigger if exists academia_fichajes_no_update on public.academia_fichajes;
create trigger academia_fichajes_no_update
before update on public.academia_fichajes
for each row execute function public.academia_fichajes_bloquear_update_delete();

drop trigger if exists academia_fichajes_no_delete on public.academia_fichajes;
create trigger academia_fichajes_no_delete
before delete on public.academia_fichajes
for each row execute function public.academia_fichajes_bloquear_update_delete();

-- Toggle por tenant, OFF por defecto — activable desde Ajustes.
alter table public.academia_config
  add column if not exists control_horario_activo boolean not null default false;
