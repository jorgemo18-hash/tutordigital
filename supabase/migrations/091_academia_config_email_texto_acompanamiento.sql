-- 091_academia_config_email_texto_acompanamiento.sql
-- Texto de acompañamiento configurable para el email a familias (recibo +
-- informe adjuntos como PDF) — un único campo por tenant, con variables
-- {mes}/{anio}/{total}/{familia} sustituidas al enviar (ver
-- server/lib/academiaEnvio/textoAcompanamiento.js). Mismo patrón que
-- concepto_recibo_plantilla: campo simple en academia_config, no una lista
-- en academia_textos_legales (esa tabla es para avisos legales
-- concatenables con tipo fijo, no encaja con un único texto por tenant).

alter table public.academia_config
  add column if not exists email_texto_acompanamiento text not null default
    'Hola {familia}, os adjuntamos el recibo de {mes} ({total}) y el informe del trabajo realizado este mes. Cualquier duda, quedamos a vuestra disposición.';
