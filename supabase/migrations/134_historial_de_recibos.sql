-- 134_historial_de_recibos.sql
-- CADA CAMBIO DE UN RECIBO DEJA RASTRO, INCLUIDO BORRARLO.
--
-- El 24/09/2026 un "Regenerar" borró los 28 recibos de septiembre de Lyceo y
-- los volvió a crear. Los descuentos y los números se conservaron, pero las
-- marcas de pago no: no había ningún sitio donde estuvieran apuntadas salvo
-- el propio recibo, y el recibo ya no existía. La copia de las 9:00 era
-- anterior a esas marcas.
--
-- Esta tabla la escribe un TRIGGER, no el código de la app. Así cubre
-- cualquier camino —el botón de pagar, el envío, Regenerar, un UPDATE a mano
-- en el SQL Editor— y un fallo futuro del backend no puede saltársela.
--
-- Qué se apunta: la foto del recibo ANTES y DESPUÉS (solo los campos que
-- importan: estado, fechas, importes, descuento, número). Con eso, unas
-- marcas de pago perdidas se recuperan con una consulta.
--
-- Sin FK a academia_recibos a propósito: el historial tiene que sobrevivir
-- al borrado del recibo, que es justo el caso para el que existe. Se busca
-- por familia + mes + año, que no cambian al regenerar.
--
-- Solo se añade: un trigger rechaza UPDATE y DELETE (mismo patrón que
-- academia_fichajes, 093). Se puede ejecutar dos veces.

create table if not exists public.academia_recibos_historial (
  id          bigserial primary key,
  tenant_id   uuid        not null,
  recibo_id   uuid        not null,
  familia_id  uuid,
  mes         smallint    not null,
  anio        smallint    not null,
  accion      text        not null check (accion in ('creado', 'pago', 'pago_quitado', 'envio', 'cambio', 'borrado')),
  antes       jsonb,
  despues     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_recibos_historial_periodo
  on public.academia_recibos_historial (tenant_id, familia_id, anio, mes, created_at);

alter table public.academia_recibos_historial enable row level security;

drop policy if exists academia_recibos_historial_admin_select on public.academia_recibos_historial;
create policy academia_recibos_historial_admin_select
on public.academia_recibos_historial
for select
to authenticated
using (public.has_active_role(tenant_id, array['admin','superadmin']));

-- La foto de un recibo: lo que hace falta para saber qué cambió y para
-- devolverlo a como estaba.
create or replace function public.academia_recibo_foto(r public.academia_recibos)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'estado',                 r.estado,
    'fecha_pago',             r.fecha_pago,
    'fecha_envio',            r.fecha_envio,
    'total_bruto',            r.total_bruto,
    'total_neto',             r.total_neto,
    'descuento_puntual_pct',  r.descuento_puntual_pct,
    'descuento_puntual_nota', r.descuento_puntual_nota,
    'numero_recibo',          r.numero_recibo
  );
$$;

create or replace function public.academia_recibos_apuntar_historial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accion text;
  v_antes  jsonb;
  v_despues jsonb;
begin
  if tg_op = 'INSERT' then
    v_accion := 'creado';
    v_despues := public.academia_recibo_foto(new);
    insert into public.academia_recibos_historial (tenant_id, recibo_id, familia_id, mes, anio, accion, antes, despues)
    values (new.tenant_id, new.id, new.familia_id, new.mes, new.anio, v_accion, null, v_despues);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.academia_recibos_historial (tenant_id, recibo_id, familia_id, mes, anio, accion, antes, despues)
    values (old.tenant_id, old.id, old.familia_id, old.mes, old.anio, 'borrado', public.academia_recibo_foto(old), null);
    return old;
  end if;

  -- UPDATE: solo si cambia algo de la foto (un updated_at solo no cuenta).
  v_antes := public.academia_recibo_foto(old);
  v_despues := public.academia_recibo_foto(new);
  if v_antes = v_despues then
    return new;
  end if;

  v_accion := case
    when new.estado = 'pagado' and old.estado is distinct from 'pagado' then 'pago'
    when old.estado = 'pagado' and new.estado is distinct from 'pagado' then 'pago_quitado'
    when new.fecha_envio is distinct from old.fecha_envio and new.fecha_envio is not null then 'envio'
    else 'cambio'
  end;

  insert into public.academia_recibos_historial (tenant_id, recibo_id, familia_id, mes, anio, accion, antes, despues)
  values (new.tenant_id, new.id, new.familia_id, new.mes, new.anio, v_accion, v_antes, v_despues);
  return new;
end;
$$;

drop trigger if exists academia_recibos_historial_trg on public.academia_recibos;
create trigger academia_recibos_historial_trg
after insert or update or delete on public.academia_recibos
for each row execute function public.academia_recibos_apuntar_historial();

-- Solo se añade: ni el backend (service_role se salta RLS) puede tocar lo
-- que ya está apuntado.
create or replace function public.academia_recibos_historial_bloquear()
returns trigger
language plpgsql
as $$
begin
  raise exception 'academia_recibos_historial solo admite INSERT: no se permite %', tg_op;
end;
$$;

drop trigger if exists academia_recibos_historial_no_update on public.academia_recibos_historial;
create trigger academia_recibos_historial_no_update
before update on public.academia_recibos_historial
for each row execute function public.academia_recibos_historial_bloquear();

drop trigger if exists academia_recibos_historial_no_delete on public.academia_recibos_historial;
create trigger academia_recibos_historial_no_delete
before delete on public.academia_recibos_historial
for each row execute function public.academia_recibos_historial_bloquear();
