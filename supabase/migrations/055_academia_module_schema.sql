-- 055_academia_module_schema.sql
-- Módulo Academia (tenants.type = 'academia'): 14 tablas nuevas, prefijo academia_.
-- Ver TutorDigital_Academia_Arquitectura.md para el diseño completo.
--
-- Seguridad: RLS habilitado en las 14 tablas, sin ninguna política para anon.
-- El backend (service role) bypasa RLS y es el camino normal de escritura/lectura;
-- estas políticas son defensa en profundidad para accesos directos desde el cliente,
-- siguiendo el mismo patrón que las tablas del módulo instituto (has_active_role /
-- is_active_member, definidas en 013_functions_search_path_v7.sql).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tablas
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.academia_familias (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  nombre          text not null,
  email           text,
  telefono        text,
  dni             text,
  direccion       text,
  ciudad          text,
  codigo_postal   text,
  metodo_pago     text check (metodo_pago in ('efectivo','transferencia','domiciliado','bizum')),
  codigo_sepa     text,
  notas           text,
  activa          boolean not null default true,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_alumnos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  student_id      uuid references public.students(id) on delete set null,
  familia_id      uuid references public.academia_familias(id) on delete set null,
  nombre          text not null,
  curso           text,
  nivel           text check (nivel in ('primaria','eso','bachillerato')),
  activo          boolean not null default true,
  fecha_alta      date not null default current_date,
  fecha_baja      date,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_horario (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  alumno_id       uuid not null references public.academia_alumnos(id) on delete cascade,
  dia_semana      smallint not null check (dia_semana between 1 and 5),
  hora_inicio     time not null,
  hora_fin        time not null,
  fecha_inicio    date not null default current_date,
  fecha_fin       date,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_sesiones (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  alumno_id             uuid not null references public.academia_alumnos(id) on delete cascade,
  profesor_id           uuid references public.teacher_profiles(id) on delete set null,
  fecha                 date not null,
  hora                  time,
  tipo                  text not null check (tipo in ('clase','ausencia','festivo','recuperacion')),
  asignatura            text,
  tema                  text,
  comentario            text,
  comentario_privado    text,
  motivo_ausencia       text,
  aviso_enviado         boolean not null default false,
  created_at            timestamptz not null default now()
);

create table if not exists public.academia_recuperaciones (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  sesion_id             uuid references public.academia_sesiones(id) on delete set null,
  alumno_id             uuid not null references public.academia_alumnos(id) on delete cascade,
  fecha_original        date not null,
  fecha_recuperacion     date,
  hora_inicio            time,
  completada             boolean not null default false,
  genera_cobro           boolean not null default false,
  created_at             timestamptz not null default now()
);

create table if not exists public.academia_tarifas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  alumno_id       uuid not null references public.academia_alumnos(id) on delete cascade,
  precio_bruto    numeric(8,2),
  descuento_pct   numeric(5,2) not null default 0,
  precio_neto     numeric(8,2),
  fecha_inicio    date not null,
  fecha_fin       date,
  notas           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_pagos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  alumno_id       uuid not null references public.academia_alumnos(id) on delete cascade,
  familia_id      uuid references public.academia_familias(id) on delete set null,
  anio            smallint not null,
  mes             smallint not null check (mes between 1 and 12),
  importe         numeric(8,2) not null,
  pagado          boolean not null default false,
  fecha_pago      date,
  metodo_pago     text,
  notas           text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, alumno_id, anio, mes)
);

create table if not exists public.academia_facturas (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  familia_id      uuid references public.academia_familias(id) on delete set null,
  alumno_id       uuid references public.academia_alumnos(id) on delete set null,
  anio            smallint not null,
  mes             smallint not null check (mes between 1 and 12),
  importe         numeric(8,2),
  descuento_pct   numeric(5,2) not null default 0,
  numero_factura  text,
  pdf_url         text,
  generada_at     timestamptz,
  enviada_at      timestamptz,
  email_destino   text,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_informes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  alumno_id       uuid not null references public.academia_alumnos(id) on delete cascade,
  anio            smallint not null,
  mes             smallint not null check (mes between 1 and 12),
  comentario      text,
  pdf_url         text,
  generado_at     timestamptz,
  enviado_at      timestamptz,
  email_destino   text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, alumno_id, anio, mes)
);

create table if not exists public.academia_gastos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  fecha               date not null,
  proveedor           text,
  concepto            text not null,
  categoria           text,
  subcategoria        text,
  cif                 text,
  base_imponible      numeric(10,2),
  iva_pct             numeric(5,2),
  iva_importe         numeric(10,2),
  retencion_pct       numeric(5,2),
  retencion_importe   numeric(10,2),
  importe             numeric(10,2) not null,
  foto_url            text,
  notas               text,
  created_at          timestamptz not null default now()
);

create table if not exists public.academia_gastos_pendientes (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  foto_url        text not null,
  estado          text not null default 'pendiente' check (estado in ('pendiente','procesado','descartado')),
  datos_ocr       jsonb,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_lista_espera (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  nombre          text not null,
  curso           text,
  telefono        text,
  notas           text,
  created_at      timestamptz not null default now()
);

create table if not exists public.academia_festivos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  fecha           date not null,
  descripcion     text,
  created_at      timestamptz not null default now(),
  unique (tenant_id, fecha)
);

create table if not exists public.academia_config (
  tenant_id         uuid primary key references public.tenants(id) on delete cascade,
  franja_inicio     time not null default '09:00',
  franja_fin        time not null default '21:00',
  franja_duracion   smallint not null default 60 check (franja_duracion in (15,30,45,60,90)),
  nombre_emisor     text,
  dni_emisor        text,
  direccion_emisor  text,
  ciudad_emisor     text,
  cp_emisor         text,
  telefono_emisor   text,
  email_emisor      text,
  iban              text,
  updated_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Índices
-- ─────────────────────────────────────────────────────────────────────────────

create index if not exists idx_academia_alumnos_tenant on public.academia_alumnos(tenant_id);
create index if not exists idx_academia_alumnos_student on public.academia_alumnos(student_id);
create index if not exists idx_academia_alumnos_familia on public.academia_alumnos(familia_id);
create index if not exists idx_academia_familias_tenant on public.academia_familias(tenant_id);
create index if not exists idx_academia_horario_alumno on public.academia_horario(alumno_id);
create index if not exists idx_academia_sesiones_alumno on public.academia_sesiones(alumno_id);
create index if not exists idx_academia_sesiones_fecha on public.academia_sesiones(tenant_id, fecha);
create index if not exists idx_academia_recuperaciones_alumno on public.academia_recuperaciones(alumno_id);
create index if not exists idx_academia_tarifas_alumno on public.academia_tarifas(alumno_id);
create index if not exists idx_academia_pagos_alumno on public.academia_pagos(alumno_id);
create index if not exists idx_academia_facturas_familia on public.academia_facturas(familia_id);
create index if not exists idx_academia_informes_alumno on public.academia_informes(alumno_id);
create index if not exists idx_academia_gastos_tenant_fecha on public.academia_gastos(tenant_id, fecha);
create index if not exists idx_academia_gastos_pendientes_tenant on public.academia_gastos_pendientes(tenant_id, estado);
create index if not exists idx_academia_lista_espera_tenant on public.academia_lista_espera(tenant_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS — habilitar en las 14 tablas. Sin políticas para anon en ninguna.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.academia_familias            enable row level security;
alter table public.academia_alumnos             enable row level security;
alter table public.academia_horario             enable row level security;
alter table public.academia_sesiones            enable row level security;
alter table public.academia_recuperaciones      enable row level security;
alter table public.academia_tarifas             enable row level security;
alter table public.academia_pagos               enable row level security;
alter table public.academia_facturas            enable row level security;
alter table public.academia_informes            enable row level security;
alter table public.academia_gastos              enable row level security;
alter table public.academia_gastos_pendientes   enable row level security;
alter table public.academia_lista_espera        enable row level security;
alter table public.academia_festivos            enable row level security;
alter table public.academia_config              enable row level security;

-- ----------------------------
-- ACADEMIA_FAMILIAS — datos de pago/contacto. Solo admin.
-- ----------------------------
drop policy if exists academia_familias_admin_all on public.academia_familias;
create policy academia_familias_admin_all
on public.academia_familias
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_ALUMNOS — admin gestiona, profesor solo lectura (necesita ver fichas).
-- ----------------------------
drop policy if exists academia_alumnos_select_admin_teacher on public.academia_alumnos;
create policy academia_alumnos_select_admin_teacher
on public.academia_alumnos
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']));

drop policy if exists academia_alumnos_admin_write on public.academia_alumnos;
create policy academia_alumnos_admin_write
on public.academia_alumnos
for insert
to authenticated
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_alumnos_admin_update on public.academia_alumnos;
create policy academia_alumnos_admin_update
on public.academia_alumnos
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_alumnos_admin_delete on public.academia_alumnos;
create policy academia_alumnos_admin_delete
on public.academia_alumnos
for delete
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_HORARIO — admin gestiona, profesor solo lectura (su horario semanal).
-- ----------------------------
drop policy if exists academia_horario_select_admin_teacher on public.academia_horario;
create policy academia_horario_select_admin_teacher
on public.academia_horario
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']));

drop policy if exists academia_horario_admin_write on public.academia_horario;
create policy academia_horario_admin_write
on public.academia_horario
for insert
to authenticated
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_horario_admin_update on public.academia_horario;
create policy academia_horario_admin_update
on public.academia_horario
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_horario_admin_delete on public.academia_horario;
create policy academia_horario_admin_delete
on public.academia_horario
for delete
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_SESIONES — diario del profesor. Admin y profesor, full CRUD en su tenant.
-- ----------------------------
drop policy if exists academia_sesiones_admin_teacher_all on public.academia_sesiones;
create policy academia_sesiones_admin_teacher_all
on public.academia_sesiones
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- ACADEMIA_RECUPERACIONES — sigue al mismo dueño que sesiones.
-- ----------------------------
drop policy if exists academia_recuperaciones_admin_teacher_all on public.academia_recuperaciones;
create policy academia_recuperaciones_admin_teacher_all
on public.academia_recuperaciones
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- ACADEMIA_TARIFAS / PAGOS / FACTURAS / GASTOS — financiero, solo admin.
-- ----------------------------
drop policy if exists academia_tarifas_admin_all on public.academia_tarifas;
create policy academia_tarifas_admin_all
on public.academia_tarifas
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_pagos_admin_all on public.academia_pagos;
create policy academia_pagos_admin_all
on public.academia_pagos
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_facturas_admin_all on public.academia_facturas;
create policy academia_facturas_admin_all
on public.academia_facturas
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_gastos_admin_all on public.academia_gastos;
create policy academia_gastos_admin_all
on public.academia_gastos
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_INFORMES — admin gestiona/envía, profesor solo lectura.
-- ----------------------------
drop policy if exists academia_informes_select_admin_teacher on public.academia_informes;
create policy academia_informes_select_admin_teacher
on public.academia_informes
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']));

drop policy if exists academia_informes_admin_write on public.academia_informes;
create policy academia_informes_admin_write
on public.academia_informes
for insert
to authenticated
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_informes_admin_update on public.academia_informes;
create policy academia_informes_admin_update
on public.academia_informes
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_informes_admin_delete on public.academia_informes;
create policy academia_informes_admin_delete
on public.academia_informes
for delete
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_GASTOS_PENDIENTES — captura desde móvil. Admin y profesor pueden
-- subir/leer; solo admin decide procesar/descartar (update/delete).
-- ----------------------------
drop policy if exists academia_gastos_pendientes_select_admin_teacher on public.academia_gastos_pendientes;
create policy academia_gastos_pendientes_select_admin_teacher
on public.academia_gastos_pendientes
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']));

drop policy if exists academia_gastos_pendientes_insert_admin_teacher on public.academia_gastos_pendientes;
create policy academia_gastos_pendientes_insert_admin_teacher
on public.academia_gastos_pendientes
for insert
to authenticated
with check (public.has_active_role(tenant_id, array['admin','teacher']));

drop policy if exists academia_gastos_pendientes_admin_update on public.academia_gastos_pendientes;
create policy academia_gastos_pendientes_admin_update
on public.academia_gastos_pendientes
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_gastos_pendientes_admin_delete on public.academia_gastos_pendientes;
create policy academia_gastos_pendientes_admin_delete
on public.academia_gastos_pendientes
for delete
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_LISTA_ESPERA — baja sensibilidad, admin y profesor.
-- ----------------------------
drop policy if exists academia_lista_espera_admin_teacher_all on public.academia_lista_espera;
create policy academia_lista_espera_admin_teacher_all
on public.academia_lista_espera
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin','teacher']))
with check (public.has_active_role(tenant_id, array['admin','teacher']));

-- ----------------------------
-- ACADEMIA_FESTIVOS — calendario visible para cualquier miembro activo; admin escribe.
-- ----------------------------
drop policy if exists academia_festivos_select_member on public.academia_festivos;
create policy academia_festivos_select_member
on public.academia_festivos
for select
to authenticated
using (public.is_active_member(tenant_id));

drop policy if exists academia_festivos_admin_write on public.academia_festivos;
create policy academia_festivos_admin_write
on public.academia_festivos
for insert
to authenticated
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_festivos_admin_update on public.academia_festivos;
create policy academia_festivos_admin_update
on public.academia_festivos
for update
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));

drop policy if exists academia_festivos_admin_delete on public.academia_festivos;
create policy academia_festivos_admin_delete
on public.academia_festivos
for delete
to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- ----------------------------
-- ACADEMIA_CONFIG — contiene IBAN y datos fiscales del emisor. Solo admin.
-- ----------------------------
drop policy if exists academia_config_admin_all on public.academia_config;
create policy academia_config_admin_all
on public.academia_config
for all
to authenticated
using (public.has_active_role(tenant_id, array['admin']))
with check (public.has_active_role(tenant_id, array['admin']));
