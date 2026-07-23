-- 094_academia_profesor_alumnos.sql
-- Asignación de alumnos a un profesor de academia. Relación simple
-- (profesor_id, alumno_id) sin concepto de grupos: academia no tiene
-- grupos/clases de instituto (confirmado al auditar academia_horario,
-- que es por alumno y sin ningún vínculo a profesor). Permite saber qué
-- alumnos lleva cada profesor.
-- Verificado antes de crearla (grep en todas las migraciones): no existe
-- ninguna tabla ni columna previa que ya resuelva esto — profesor_id solo
-- aparece en academia_sesiones/academia_notas_examen como autoría de un
-- registro puntual, nunca como asignación persistente alumno↔profesor.
create table if not exists public.academia_profesor_alumnos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  profesor_id uuid not null references public.teacher_profiles(id) on delete cascade,
  alumno_id uuid not null references public.academia_alumnos(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profesor_id, alumno_id)
);

create index if not exists idx_academia_profesor_alumnos_profesor
  on public.academia_profesor_alumnos(tenant_id, profesor_id);
create index if not exists idx_academia_profesor_alumnos_alumno
  on public.academia_profesor_alumnos(alumno_id);

alter table public.academia_profesor_alumnos enable row level security;

-- El backend usa service_role (bypasa RLS) para todo lo de hoy — mismo
-- criterio que el resto de tablas de academia (ver migración 093): esta
-- política es la red de seguridad para un futuro acceso directo del
-- frontend a PostgREST, no el mecanismo real de control de acceso.
drop policy if exists academia_profesor_alumnos_admin_all on public.academia_profesor_alumnos;
create policy academia_profesor_alumnos_admin_all
on public.academia_profesor_alumnos
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_profesor_alumnos_teacher_select on public.academia_profesor_alumnos;
create policy academia_profesor_alumnos_teacher_select
on public.academia_profesor_alumnos
for select
to authenticated
using (
  public.has_active_role(tenant_id, array['teacher'])
  and exists (
    select 1 from public.teacher_profiles tp
    where tp.id = academia_profesor_alumnos.profesor_id
      and tp.user_id = auth.uid()
  )
);

-- Datos de contacto del profesor, editables desde el drawer del panel
-- admin-academia — nullable y sin llamador en instituto (mismo patrón que
-- academia_alumnos/academia_familias en la migración 061), aquí en
-- teacher_profiles porque es la tabla compartida con instituto y no existe
-- una tabla "academia_profesores" aparte.
alter table public.teacher_profiles
  add column if not exists telefono text,
  add column if not exists direccion text;
