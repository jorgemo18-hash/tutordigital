-- 086_academia_documentos_bucket.sql
-- Bucket privado para documentos propios de la academia (hoy: normas del
-- centro, PDF o DOCX subido por el admin) — sin políticas RLS de
-- storage.objects, igual que task-attachments (025_storage.sql): el acceso
-- es solo vía service role desde el backend (subida directa, descarga con
-- URL firmada de 60 minutos, ver server/lib/academiaDocumentos/normas.js).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'academia-documentos',
  'academia-documentos',
  false,
  10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

-- Metadatos del documento de normas subido — el path completo (con
-- extensión) y el mime viven aquí porque el nombre en storage es
-- {tenant_id}/normas.{ext} y la extensión depende del archivo que suba
-- cada academia (pdf o docx); sin guardarla no hay forma de reconstruir la
-- ruta para generar la URL firmada o saber si ya existe un documento.
alter table public.academia_config
  add column if not exists normas_path text,
  add column if not exists normas_mime text,
  add column if not exists normas_updated_at timestamptz;
