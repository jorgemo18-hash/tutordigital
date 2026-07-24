-- 096_academia_fichajes_notas.sql
-- Campo de notas largo/libre, opcional, aparte del "motivo" corto ya
-- obligatorio en toda corrección (ver migración 093, check constraint
-- academia_fichajes_correccion_shape) — contexto adicional para el caso
-- de "necesito explicar algo más sobre esta corrección" sin forzar a
-- meterlo todo en el motivo. Nullable para worker Y para admin_correccion
-- (a diferencia de motivo, notas nunca es obligatorio) — no se toca el
-- check constraint existente, que ya no depende de esta columna.
alter table public.academia_fichajes
  add column if not exists notas text;
