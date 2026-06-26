-- 061_academia_alumno_contacto_y_descuento_recurrente.sql
-- Tres correcciones relacionadas, aplicadas juntas:
--
-- 1. academia_alumnos no tenía columnas propias para el contacto del
--    alumno (email/teléfono/dirección/ciudad/CP) — se intentaban guardar
--    en la familia vinculada como workaround, y ese merge se rompió tras
--    el rediseño de selección de familia (la familia ahora se crea de
--    forma inmediata vía POST /academia/familias, no en el mismo paso que
--    el alumno) — los datos del alumno se descartaban silenciosamente al
--    guardar. Columnas propias, de una vez.
--
-- 2. academia_recibos_lineas no guardaba qué descuento recurrente (si
--    alguno) se le aplicó a cada alumno al generar el recibo — el total
--    del recibo SÍ lo incluía correctamente, pero no había manera de
--    verlo desglosado en la vista previa ni en el email.
--
-- 3. El descuento de hermanos automático (academia_config.descuento_hermanos_pct)
--    queda reemplazado por los descuentos recurrentes configurables
--    (intervalo "siempre" cubre el mismo caso). academia_recibos mantiene
--    su columna (recibos ya enviados conservan el dato histórico), solo
--    se deja de calcular para recibos nuevos.

ALTER TABLE public.academia_alumnos
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS telefono text,
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS ciudad text,
  ADD COLUMN IF NOT EXISTS codigo_postal text;

ALTER TABLE public.academia_recibos_lineas
  ADD COLUMN IF NOT EXISTS descuento_recurrente_pct numeric(5,2) NOT NULL DEFAULT 0;

ALTER TABLE public.academia_config
  DROP COLUMN IF EXISTS descuento_hermanos_pct;
