-- 128_token_usage_hojas_interpretar.sql
-- EL GASTO DEL PEDIDO EN PALABRAS DEL GENERADOR DE HOJAS.
--
-- La sección "Ejercicios" del panel de academia (fase 2, 23/9) llama a Claude
-- para traducir "hazme dos de restar con paréntesis" al catálogo. Es gasto de
-- IA del centro y va a `ai_token_usage` como el del chat, con su propio
-- `source` para poder separarlo en el panel de superadmin.
--
-- La 100 dejó `source` cerrado a ('chat', 'guide_detect', 'guide_steps'): sin
-- ampliar la lista, cada inserción fallaría. El fallo no rompería nada (la
-- anotación del gasto nunca tumba la petición, ver server/lib/tokenUsage.js)
-- pero el gasto se perdería en silencio, que es justo lo que esa tabla evita.
--
-- Se puede ejecutar dos veces.

alter table public.ai_token_usage
  drop constraint if exists ai_token_usage_source_check;

alter table public.ai_token_usage
  add constraint ai_token_usage_source_check
  check (source in ('chat', 'guide_detect', 'guide_steps', 'hojas_interpretar'));
