-- 063_academia_recibos_lineas_desglose_descuentos.sql
-- El nuevo formato del recibo pide una línea por cada descuento recurrente
-- aplicado a un alumno, con su propio importe en euros — el combinado
-- "pct + concepto concatenado" de las migraciones 061/062 no permite
-- reconstruir ese desglose. Se sustituyen ambas columnas por un snapshot
-- estructurado: [{concepto, porcentaje, importe}].
-- Sin fallback de datos: los 2 borradores existentes con descuento
-- recurrente se regeneran tras este cambio; los recibos ya enviados con
-- descuento no tienen recurrente (solo hermanos, que vive en la cabecera
-- del recibo y no se toca aquí).

ALTER TABLE public.academia_recibos_lineas
  DROP COLUMN IF EXISTS descuento_recurrente_pct,
  DROP COLUMN IF EXISTS descuento_recurrente_concepto,
  ADD COLUMN IF NOT EXISTS descuentos_recurrentes jsonb NOT NULL DEFAULT '[]'::jsonb;
