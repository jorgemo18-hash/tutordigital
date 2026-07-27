-- 101_ai_token_usage_moneda.sql
-- Replantea qué se congela en ai_token_usage (migración 100): Anthropic
-- factura en USD — ese es el coste real y exacto, que nunca necesita
-- revisión. El EUR siempre fue una conversión aproximada (ver
-- USD_TO_EUR en aiPricing.js, un tipo de cambio de mercado que se desfasa
-- con el tiempo, a diferencia del precio por modelo). La versión anterior
-- congelaba el derivado (cost_eur) y perdía el dato exacto.
--
-- La tabla tiene 0 filas en el momento de esta migración — sin backfill,
-- sin compatibilidad que mantener con datos existentes.
alter table public.ai_token_usage
  add column if not exists cost_usd numeric(12, 6),
  add column if not exists fx_usd_eur numeric(10, 6);

comment on column public.ai_token_usage.cost_usd is
  'Coste exacto en USD según la tarifa de Anthropic vigente al escribir esta fila (server/lib/aiPricing.js) — nunca necesita revisión retroactiva, es la cifra que debe cuadrar con la factura real de Anthropic.';
comment on column public.ai_token_usage.fx_usd_eur is
  'Tipo de cambio USD->EUR aplicado en el momento del INSERT (congelado, ver USD_TO_EUR en aiPricing.js) — junto con cost_usd permite derivar el coste en EUR de esta fila sin recalcular con el tipo de cambio de hoy.';

-- cost_eur queda eliminada, no redundante-y-mantenida: con cost_usd y
-- fx_usd_eur ya congelados por fila, guardar además cost_eur sería un
-- tercer número derivable de los otros dos sin ningún riesgo de deriva
-- (a diferencia de antes, donde SÍ hacía falta congelarlo porque no había
-- fx histórico guardado) — el EUR se deriva siempre al leer como
-- cost_usd * fx_usd_eur POR FILA (nunca sumar cost_usd y multiplicar por
-- el tipo de cambio actual: eso volvería a reintroducir el problema de
-- recalcular histórico con una tarifa que nunca se aplicó). Ver
-- sumTokenUsage en superadmin.stats.routes.js.
alter table public.ai_token_usage drop column if exists cost_eur;
