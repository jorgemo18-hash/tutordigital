-- 069_academia_config_fiscal.sql
-- Pestaña Fiscal de Finanzas (Modelo 130/115/111, ver
-- sections/finanzas/fiscal/): Modelo 115 necesita la base mensual del
-- alquiler del local, editable por el admin y compartida por las
-- secciones trimestral/anual (Modelo 180); Modelo 111 necesita la base de
-- nóminas y el % de retención por trimestre/año, que no tienen una columna
-- fija cada uno (varían por trimestre) así que van en un jsonb con clave
-- "{trimestre}_{anio}", p.ej. {"T2_2026": {"base": 4500, "retencion_pct": 15}}.
alter table academia_config
  add column if not exists alquiler_base_mensual numeric not null default 0,
  add column if not exists nominas_config jsonb not null default '{}'::jsonb;
