-- 146_dia_de_envio.sql
-- EL DÍA DEL ENVÍO MENSUAL A FAMILIAS (Jorge, 30/09/2026): desde ese día, el
-- panel de admin enseña arriba una franja "Toca el envío a familias…
-- Revisar" hasta que el envío del mes está hecho (ver assets/academia/admin/
-- js/avisoEnvio/avisoEnvio.js).
--
-- academia_config.dia_envio: del 1 al 28 (el 28 existe en todos los meses),
-- o null = sin aviso, que es como estaba todo hasta ahora.
--
-- Idempotente: se puede ejecutar dos veces.

alter table public.academia_config
  add column if not exists dia_envio smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'academia_config_dia_envio_check'
  ) then
    alter table public.academia_config
      add constraint academia_config_dia_envio_check
      check (dia_envio is null or dia_envio between 1 and 28);
  end if;
end $$;
