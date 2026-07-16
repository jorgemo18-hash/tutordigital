-- 088_documentos_generados_bucket.sql
-- Bucket privado para documentos GENERADOS por el sistema (hoy: la hoja de
-- inscripción cacheada, ver server/lib/academiaDocumentos/hojaInscripcionCache.js)
-- — separado de academia-documentos (086), que guarda documentos SUBIDOS
-- por el admin (normas): distinto ciclo de vida, uno se puede borrar y
-- regenerar libremente, el otro es contenido del usuario. Mismo patrón
-- que academia-documentos: privado, sin políticas RLS de storage.objects,
-- acceso solo vía service role desde el backend (el frontend nunca recibe
-- una URL directa de Storage, el backend hace de proxy).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documentos-generados',
  'documentos-generados',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do nothing;
