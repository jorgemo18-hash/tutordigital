-- 062_academia_recibos_lineas_descuento_concepto.sql
-- academia_recibos_lineas.descuento_recurrente_pct (migración 061) guarda
-- solo el porcentaje combinado aplicado a cada alumno, sin el nombre del
-- tipo de descuento — la preview y el email solo podían mostrar
-- "Descuento recurrente -X%" genérico, no "primer mes -20%". Snapshot del
-- concepto (o concatenación "concepto -pct% + concepto -pct%" si aplica
-- más de uno), igual de inmutable que nombre_alumno/curso_alumno.

ALTER TABLE public.academia_recibos_lineas
  ADD COLUMN IF NOT EXISTS descuento_recurrente_concepto text;
