-- 149_token_usage_hojas_ia.sql
-- HOJAS ESCRITAS POR LA IA (30/09/2026): los temas sin generador propio se
-- generan con IA a partir de los ejercicios de referencia
-- (server/lib/hojasIA/). Como el resto de llamadas a Claude, el gasto va a
-- `ai_token_usage` con su propio `source`: 'hojas_ia'.
--
-- Idempotente: se puede ejecutar dos veces.

alter table public.ai_token_usage
  drop constraint if exists ai_token_usage_source_check;

alter table public.ai_token_usage
  add constraint ai_token_usage_source_check
  check (source in ('chat', 'guide_detect', 'guide_steps', 'hojas_interpretar', 'programacion_unidades', 'programacion_textos', 'hojas_ia'));
