-- 072_academia_sesiones_email_familia.sql
-- Aviso de ausencia por email a la familia — academia_sesiones ya existía
-- (confirmado en information_schema.columns) con alumno_id/fecha/hora/tipo/
-- motivo_ausencia, y con una columna `aviso_enviado boolean` sin usar en
-- ningún sitio del código; se añaden dos columnas nuevas y con nombre
-- explícito para este flujo en vez de reutilizar esa, para no adivinar la
-- semántica de una columna preexistente sin referencias.

alter table public.academia_sesiones
  add column if not exists email_familia_enviado boolean not null default false,
  add column if not exists email_familia_enviado_at timestamptz;
