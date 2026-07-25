-- 097_academia_sustituciones.sql
-- Sustituciones entre profesores de una academia: un profesor sustituto
-- ve TEMPORALMENTE los alumnos de otro profesor, para poder registrar
-- diario/notas ese día cubriéndolo. Nunca es suplantación de identidad —
-- el sustituto trabaja siempre con su propia cuenta y su propio
-- profesor_id; lo único que cambia es qué alumnos resuelve como
-- "visibles" (ver server/lib/academiaProfesores/resolverAlumnosVisibles.js).
-- Verificado antes de crearla (grep de "sustitu" en todas las
-- migraciones y en server/): no existe ninguna tabla ni columna previa
-- que ya resuelva esto.
create table if not exists public.academia_sustituciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profesor_sustituto_id uuid not null references public.teacher_profiles(id) on delete cascade,
  profesor_sustituido_id uuid not null references public.teacher_profiles(id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  -- Quién declaró la sustitución (el propio sustituto si es autodeclarada,
  -- o el admin si la creó él) — rastro de auditoría, distinto de
  -- profesor_sustituto_id: un admin puede declarar una sustitución en
  -- nombre de un profesor sin ser él mismo el sustituto.
  declarada_por uuid not null references public.profiles(id),
  origen text not null check (origen in ('autodeclarada', 'admin')),
  created_at timestamptz not null default now(),
  -- Revocación sin borrado físico — el rastro de qué se cubrió y cuándo
  -- se revocó importa tanto como la sustitución en sí (mismo criterio
  -- append-only-ish que academia_fichajes, aunque aquí sí se permite
  -- "cerrar" una fila existente en vez de solo añadir, porque no hay
  -- ningún registro de terceros ya construido sobre la revocación).
  revocada_at timestamptz,
  revocada_por uuid references public.profiles(id) on delete set null,
  constraint academia_sustituciones_distintos
    check (profesor_sustituto_id <> profesor_sustituido_id),
  constraint academia_sustituciones_rango
    check (fecha_fin >= fecha_inicio),
  -- revocada_at y revocada_por siempre van juntos: ninguno o los dos —
  -- evita una revocación sin autor o un autor sin revocación real.
  constraint academia_sustituciones_revocacion_shape
    check (
      (revocada_at is null and revocada_por is null)
      or (revocada_at is not null and revocada_por is not null)
    )
);

-- "Sustituciones activas de este profesor hoy" es la consulta caliente
-- (se resuelve en cada GET de horario/diario/notas-examen) — índice
-- parcial (solo filas no revocadas) para que ese filtro no escanee el
-- histórico completo del tenant.
create index if not exists idx_academia_sustituciones_activas
  on public.academia_sustituciones(tenant_id, profesor_sustituto_id, fecha_inicio, fecha_fin)
  where revocada_at is null;
create index if not exists idx_academia_sustituciones_tenant_created
  on public.academia_sustituciones(tenant_id, created_at desc);

alter table public.academia_sustituciones enable row level security;

-- El backend usa service_role (bypasa RLS) para todo lo de hoy — mismo
-- criterio que el resto de tablas de academia (ver migraciones 093/094):
-- esta política es la red de seguridad para un futuro acceso directo del
-- frontend a PostgREST, no el mecanismo real de control de acceso. Las
-- reglas de negocio reales (fecha_inicio=fecha_fin=hoy si es autodeclarada,
-- quién puede revocar) viven en server/routes/v1/academia-sustituciones/.
drop policy if exists academia_sustituciones_admin_all on public.academia_sustituciones;
create policy academia_sustituciones_admin_all
on public.academia_sustituciones
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_sustituciones_teacher_select on public.academia_sustituciones;
create policy academia_sustituciones_teacher_select
on public.academia_sustituciones
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['teacher'])
  and exists (
    select 1 from public.teacher_profiles tp
    where tp.user_id = auth.uid()
      and tp.id in (academia_sustituciones.profesor_sustituto_id, academia_sustituciones.profesor_sustituido_id)
  )
);
