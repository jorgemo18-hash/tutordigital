-- 147_documentos_enviados.sql
-- EL PDF EXACTO QUE RECIBIÓ CADA FAMILIA (Jorge, 30/09/2026: "una vez
-- enviadas, tienen que guardarse en algún sitio, por si tengo que
-- justificarlo").
--
-- Hasta ahora se guardaban los DATOS del recibo, su historial y el registro
-- del correo, pero no el PDF: se podía volver a generar, pero si el centro
-- cambiaba el logo o un texto legal, el regenerado ya no era el que llegó.
-- Para justificar algo vale el documento que salió.
--
-- UNA FILA POR PDF ADJUNTADO a un correo, y NUNCA SE SOBRESCRIBE: si un
-- recibo se manda dos veces en el mismo mes (se mandó mal y se corrige), se
-- guardan los dos y la pantalla enseña el último. Así, si algún día esto
-- tiene que valer como factura, no se ha borrado nada.
--
-- El archivo va al bucket PRIVADO `academia-documentos`
-- ({tenant}/envios/{AAAA-MM}/{familia}/{instante}-{nombre}.pdf) y se sirve
-- por una ruta con sesión de admin, nunca por URL directa (como las fichas,
-- migración 114).
--
-- `mes`/`anio` son los DEL DOCUMENTO: el recibo de octubre es de octubre y
-- el informe que le acompaña, de septiembre.
--
-- Idempotente: se puede ejecutar dos veces.

create table if not exists public.academia_documentos_enviados (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  -- Con `set null`: borrar una familia, un alumno o un recibo no borra la
  -- prueba de lo que se le mandó.
  envio_id uuid references public.academia_envios_email(id) on delete set null,
  familia_id uuid references public.academia_familias(id) on delete set null,
  alumno_id uuid references public.academia_alumnos(id) on delete set null,
  recibo_id uuid references public.academia_recibos(id) on delete set null,
  tipo text not null check (tipo in ('recibo', 'informe')),
  mes smallint not null check (mes between 1 and 12),
  anio smallint not null,
  storage_path text not null,
  nombre_archivo text not null,
  destinatario text,
  enviado_at timestamptz not null default now()
);

create index if not exists academia_documentos_enviados_familia_idx
  on public.academia_documentos_enviados (tenant_id, familia_id, anio, mes, tipo, enviado_at desc);

-- RLS: el admin del centro lee lo suyo; nadie escribe desde el navegador
-- (lo escribe el backend con la service role al enviar), igual que
-- academia_envios_email (migración 122).
alter table public.academia_documentos_enviados enable row level security;

drop policy if exists academia_documentos_enviados_select on public.academia_documentos_enviados;
create policy academia_documentos_enviados_select on public.academia_documentos_enviados
for select to authenticated
using (public.has_active_role(tenant_id, array['admin']));
