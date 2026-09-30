-- 145_modo_de_envio.sql
-- QUÉ MES VA EN CADA DOCUMENTO DEL ENVÍO MENSUAL (Jorge, 30/09/2026): la
-- academia que cobra a principio de mes manda el recibo del mes que empieza
-- con el informe del que acaba ("el 5 de octubre, el informe de septiembre
-- y el recibo de octubre"). Hasta ahora el envío juntaba los dos del mismo
-- mes. Ver assets/shared/js/periodosDeEnvio.js.
--
-- 1) academia_config.modo_envio:
--      'informe_mes_anterior' (por defecto) | 'mismo_mes'.
--
-- 2) Los textos del email decían "el informe del trabajo realizado ESTE
--    MES", que en octubre, hablando de septiembre, es falso. Pasan a
--    "realizado en {mes_informe}", una variable nueva que en el modo
--    'mismo_mes' vale lo mismo que {mes}. Solo se cambian las filas que
--    siguen con el texto de fábrica: un texto escrito por el centro no se
--    toca.
--
-- Idempotente: se puede ejecutar dos veces.

alter table public.academia_config
  add column if not exists modo_envio text not null default 'informe_mes_anterior';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'academia_config_modo_envio_check'
  ) then
    alter table public.academia_config
      add constraint academia_config_modo_envio_check
      check (modo_envio in ('informe_mes_anterior', 'mismo_mes'));
  end if;
end $$;

update public.academia_config
set email_texto_completo =
  'Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado en {mes_informe}. Cualquier duda, quedamos a vuestra disposición.'
where email_texto_completo =
  'Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado este mes. Cualquier duda, quedamos a vuestra disposición.';

update public.academia_config
set email_texto_solo_informe =
  'Hola {familia}, os adjuntamos el informe del trabajo realizado en {mes_informe}. Cualquier duda, quedamos a vuestra disposición.'
where email_texto_solo_informe =
  'Hola {familia}, os adjuntamos el informe del trabajo realizado este mes. Cualquier duda, quedamos a vuestra disposición.';

alter table public.academia_config
  alter column email_texto_completo set default
    'Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado en {mes_informe}. Cualquier duda, quedamos a vuestra disposición.';

alter table public.academia_config
  alter column email_texto_solo_informe set default
    'Hola {familia}, os adjuntamos el informe del trabajo realizado en {mes_informe}. Cualquier duda, quedamos a vuestra disposición.';
