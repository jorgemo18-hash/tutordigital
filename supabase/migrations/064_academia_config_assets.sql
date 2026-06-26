-- 064_academia_config_assets.sql
-- Personalización del centro (Ajustes › Personalización): logo, foto de
-- fondo y texto LOPD para el footer de los emails. Las imágenes se suben
-- al bucket academia-assets/{tenant_id}/{logo|bg}.{ext} desde el backend
-- (service role, ver server/lib/academiaConfig/uploadAsset.js) — las
-- políticas de abajo son defensa en profundidad, no la vía real de subida.

ALTER TABLE public.academia_config
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS bg_url text,
  ADD COLUMN IF NOT EXISTS texto_lopd text;

-- Bucket público (el logo/fondo se sirve directo en <img> sin URL firmada,
-- igual que cualquier asset de marca) — no existía ningún bucket con este
-- nombre, el único bucket previo es task-attachments (privado).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('academia-assets', 'academia-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Solo el admin del tenant puede subir/sobrescribir/borrar dentro de su
-- propia carpeta {tenant_id}/ — mismo helper has_active_role que el resto
-- de RLS del proyecto (ver 055_academia_module_schema.sql).
create policy "academia admins manage their tenant assets (insert)"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'academia-assets'
  and public.has_active_role(((storage.foldername(name))[1])::uuid, array['admin'])
);

create policy "academia admins manage their tenant assets (update)"
on storage.objects for update to authenticated
using (
  bucket_id = 'academia-assets'
  and public.has_active_role(((storage.foldername(name))[1])::uuid, array['admin'])
);

create policy "academia admins manage their tenant assets (delete)"
on storage.objects for delete to authenticated
using (
  bucket_id = 'academia-assets'
  and public.has_active_role(((storage.foldername(name))[1])::uuid, array['admin'])
);
