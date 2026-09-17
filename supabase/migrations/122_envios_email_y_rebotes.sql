-- 122 — SABER SI EL EMAIL DE UNA FAMILIA LLEGÓ DE VERDAD.
--
-- EL PROBLEMA. Hoy, cuando se manda un recibo, la app marca el recibo como
-- "enviado" en cuanto la API de Resend responde 200 y se olvida. Pero un
-- 200 solo significa "aceptado para envío", no "entregado": si la dirección
-- de la familia está mal escrita o su buzón está lleno, el rebote llega
-- DESPUÉS, y llega a Resend — no a nosotros. El panel sigue diciendo
-- "enviado" y nadie se entera hasta que esa familia no paga.
--
-- Con una familia da igual. Con cuarenta, cada septiembre hay una o dos que
-- no reciben nada y el error es invisible.
--
-- LA PIEZA QUE FALTABA. Resend devuelve un identificador por cada email
-- aceptado (`data.id`) y ese identificador es el que viaja en sus webhooks
-- (`data.email_id`). Hasta ahora lo tirábamos: `sendReciboEmail` leía solo
-- el error de la respuesta. Sin ese id no hay forma fiable de saber a qué
-- recibo corresponde un rebote — solo el email del destinatario y la hora,
-- que es adivinar. Guardarlo es lo que desbloquea todo esto, y sirve igual
-- si el aviso llega por webhook o si se consulta a mano.
--
-- DOS TABLAS Y NO UNA, a propósito:
--   - `academia_envios_email`: UNA fila por email que hemos mandado, con su
--     estado actual. Es lo que lee el panel, y lo que permite responder "¿a
--     quién no le llegó el recibo de septiembre?" con una sola consulta.
--   - `academia_email_eventos`: UNA fila por webhook recibido, con el cuerpo
--     entero. Es el histórico. Cuesta poco y es lo único que permite
--     reconstruir qué pasó cuando algo no cuadre — un email puede entregarse
--     y rebotar después, y guardar solo el "estado actual" borra esa pista.

create table if not exists public.academia_envios_email (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  -- El id que devolvió Resend al aceptar el email. ES LA CLAVE DE UNIÓN con
  -- el webhook, y por eso es unique: dos filas con el mismo id harían
  -- ambigua la actualización de estado.
  resend_email_id text not null unique,

  destinatario text not null,
  asunto text,

  -- A qué corresponde el envío. Nullable: un email de aviso de ausencia no
  -- tiene recibo, y un recibo puede no tener familia si se archivó. Con
  -- `on delete set null` borrar una familia no borra la prueba de que se le
  -- mandó un recibo.
  familia_id uuid references public.academia_familias(id) on delete set null,
  recibo_id uuid references public.academia_recibos(id) on delete set null,
  tipo text not null default 'otro'
    check (tipo in ('recibo', 'informe', 'recibo_informe', 'ausencia', 'otro')),

  enviado_at timestamptz not null default now(),

  -- El estado según lo último que nos ha contado Resend. 'enviado' =
  -- aceptado por la API y sin noticias todavía, que es el estado normal de
  -- un email recién salido y TAMBIÉN el de uno del que nunca sabremos nada
  -- más (si el webhook no está configurado). Es importante que el panel no
  -- lo pinte como un problema: no saber no es lo mismo que haber fallado.
  estado text not null default 'enviado'
    check (estado in ('enviado', 'entregado', 'rebotado', 'queja', 'fallido', 'retrasado', 'suprimido')),
  motivo text,
  estado_at timestamptz
);

-- "¿Qué envíos de este centro han acabado mal?" — la consulta que hará el
-- panel. Índice parcial: las filas entregadas o a la espera no estorban.
create index if not exists academia_envios_email_problemas_idx
  on public.academia_envios_email (tenant_id, enviado_at desc)
  where estado in ('rebotado', 'queja', 'fallido', 'suprimido');

create index if not exists academia_envios_email_recibo_idx
  on public.academia_envios_email (recibo_id)
  where recibo_id is not null;

create table if not exists public.academia_email_eventos (
  id uuid primary key default gen_random_uuid(),

  -- Nullable a propósito: puede llegar un evento de un email que no está en
  -- la tabla de envíos (uno enviado antes de esta migración, o un email de
  -- soporte). Se guarda igual en vez de descartarlo — un evento perdido no
  -- se recupera, y el `resend_email_id` de al lado permite emparejarlo
  -- después si hace falta.
  envio_id uuid references public.academia_envios_email(id) on delete cascade,
  resend_email_id text not null,

  -- IDEMPOTENCIA. Los webhooks se reintentan: Resend reenvía el mismo evento
  -- si no contestamos 2xx, y siempre con el mismo `svix-id`. Sin esto, un
  -- reintento duplicaría el evento.
  --
  -- UNIQUE NORMAL, NO `nulls not distinct` (al contrario que en la migración
  -- 120, y por el motivo opuesto): si algún día llega un evento sin svix-id,
  -- lo que queremos es que se inserte igual, no que choque con todos los
  -- demás sin id. Aquí los nulos SÍ deben ser distintos entre sí.
  svix_id text unique,

  tipo text not null,
  ocurrido_at timestamptz,
  motivo text,

  -- El cuerpo entero tal como llegó, ya verificado. Es la única fuente de
  -- verdad si mañana Resend añade un campo o si hay que discutir con ellos
  -- qué nos mandaron.
  payload jsonb not null,
  recibido_at timestamptz not null default now()
);

create index if not exists academia_email_eventos_envio_idx
  on public.academia_email_eventos (envio_id, recibido_at desc);

create index if not exists academia_email_eventos_email_idx
  on public.academia_email_eventos (resend_email_id);

-- RLS: el admin del centro LEE lo suyo y nadie escribe desde el navegador.
-- Quien escribe es el webhook, que corre en el backend con la service role
-- y por tanto no pasa por estas políticas. No hay política de escritura a
-- propósito: nada de lo que hay aquí lo teclea una persona.
alter table public.academia_envios_email enable row level security;
alter table public.academia_email_eventos enable row level security;

drop policy if exists academia_envios_email_select on public.academia_envios_email;
create policy academia_envios_email_select on public.academia_envios_email
for select to authenticated
using (public.has_active_role(tenant_id, array['admin']));

-- Los eventos se leen a través de su envío: así el aislamiento entre
-- centros lo decide una sola política (la de arriba) y no dos que puedan
-- desincronizarse. Un evento huérfano (envio_id null) no lo ve nadie desde
-- el navegador, que es lo correcto: no sabemos de qué centro es.
drop policy if exists academia_email_eventos_select on public.academia_email_eventos;
create policy academia_email_eventos_select on public.academia_email_eventos
for select to authenticated
using (exists (
  select 1 from public.academia_envios_email e
  where e.id = academia_email_eventos.envio_id
    and public.has_active_role(e.tenant_id, array['admin'])
));

comment on table public.academia_envios_email is
  'Un registro por email enviado a una familia, con el id de Resend y el estado según sus webhooks. Sirve para responder "¿a quién no le llegó?".';

comment on table public.academia_email_eventos is
  'Histórico de webhooks de Resend ya verificados. svix_id da idempotencia frente a reintentos.';
