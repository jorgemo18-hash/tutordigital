-- 152_tutor_intentos.sql
-- CADA ENVÍO DEL ALUMNO, COMPROBADO (2/10/2026).
--
-- Cuando el alumno manda cuentas de un ejercicio de nuestras hojas, el
-- comprobador del tutor dice qué línea está mal, en qué paso, qué error del
-- catálogo es probable y en qué peldaño de la escalera de ayuda está. Aquí
-- queda guardado. Sirve para tres cosas:
--   - contar los fallos en el mismo paso (el peldaño siguiente de la ayuda);
--   - que la profe vea cuánta ayuda necesitó en cada apartado (sin ayuda, 1
--     pista, 2 pistas, con ejemplo, no lo sacó);
--   - el perfil del alumno: qué errores comete y en qué tipos de ejercicio.
--
-- Solo la usa el servidor (clave de servicio): RLS activado y sin políticas.
create table if not exists public.tutor_intentos (
  id           uuid        primary key default gen_random_uuid(),
  tenant_id    uuid        not null references public.tenants(id) on delete cascade,
  session_id   uuid        not null references public.tutor_sessions(id) on delete cascade,
  hoja_id      uuid        references public.contenido_hojas(id) on delete set null,
  actividad    integer     not null,
  apartado     integer     not null,
  clave        text        not null,
  lineas       jsonb       not null default '[]'::jsonb,
  primera_mal  integer,
  hito_mal     text,
  error_numero integer,
  nivel        integer     not null default 0,
  todo_hecho   boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists tutor_intentos_sesion_idx
  on public.tutor_intentos (session_id, actividad, apartado);

alter table public.tutor_intentos enable row level security;
