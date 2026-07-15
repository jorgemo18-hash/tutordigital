-- 087_academia_inscripcion_config.sql
-- Configuración de la hoja de inscripción (pestaña Ajustes › Inscripción):
-- qué bloques/campos de la cara delantera se imprimen (inscripcion_config,
-- ver server/lib/academiaConfig/inscripcionConfig.js para los defaults) y
-- el tipo 'inscripcion' en academia_textos_legales para el texto de
-- protección de datos de la cara trasera (ver hoja_inscripcion.py en
-- tutordigital-pdf-service). null en inscripcion_config = valores por
-- defecto — no se backfillea aquí porque el default ya replica la hoja
-- actual de Lyceo.

alter table public.academia_config
  add column if not exists inscripcion_config jsonb;

alter table public.academia_textos_legales drop constraint if exists academia_textos_legales_tipo_check;
alter table public.academia_textos_legales add constraint academia_textos_legales_tipo_check
  check (tipo in ('email', 'recibos', 'ambos', 'inscripcion'));
