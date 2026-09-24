-- 132_token_usage_programacion_ia.sql
-- EL GASTO DEL BORRADOR DE PROGRAMACIÓN CON IA.
--
-- Recursos → Programación (24/9): la IA propone las unidades didácticas y
-- redacta un primer borrador de los apartados de texto. Es gasto de IA del
-- centro y va a `ai_token_usage` con su propio `source`, como el del pedido
-- en palabras de las hojas (migración 128). Sin ampliar la lista, cada
-- anotación fallaría en silencio y el gasto se perdería.
--
-- Se puede ejecutar dos veces.

alter table public.ai_token_usage
  drop constraint if exists ai_token_usage_source_check;

alter table public.ai_token_usage
  add constraint ai_token_usage_source_check
  check (source in ('chat', 'guide_detect', 'guide_steps', 'hojas_interpretar', 'programacion_unidades', 'programacion_textos'));
