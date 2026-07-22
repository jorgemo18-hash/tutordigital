-- 092_academia_config_email_textos_tipo.sql
-- El texto de acompañamiento del email a familias era un único campo
-- reutilizado en los 3 casos de envío posibles (recibo+informes, solo
-- recibo, solo informe) — cuando el envío no llevaba recibo, el texto
-- seguía diciendo "os adjuntamos el recibo de {mes} ()" con {total}
-- vacío. Se sustituye por tres campos independientes, uno por caso (ver
-- server/lib/academiaEnvio/textoAcompanamiento.js y enviarFamiliaEmail.js,
-- que eligen el que corresponde según el tipo de envío).

alter table public.academia_config
  rename column email_texto_acompanamiento to email_texto_completo;

alter table public.academia_config
  add column if not exists email_texto_solo_recibo text not null default
    'Hola {familia}, os adjuntamos el recibo de {mes} ({total}). Cualquier duda, quedamos a vuestra disposición.';

alter table public.academia_config
  add column if not exists email_texto_solo_informe text not null default
    'Hola {familia}, os adjuntamos el informe del trabajo realizado este mes. Cualquier duda, quedamos a vuestra disposición.';
