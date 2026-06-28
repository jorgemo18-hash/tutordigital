-- 068_academia_assets_pdf_8mb.sql
-- La foto de una factura de gasto (Finanzas › Gastos, ver
-- server/lib/academiaFinanzas/gastoFoto.js) reutiliza el bucket
-- academia-assets ya creado en 064_academia_config_assets.sql para
-- logo/fondo, pero esas facturas pueden ser PDF y pesar hasta 8MB (mismo
-- límite que ya usa el OCR de gastos, ver gastosExtraer.routes.js) — sin
-- este cambio Supabase Storage rechaza el PDF/el archivo de más de 5MB
-- antes de que el código del backend llegue a ejecutarse.
update storage.buckets
set
  file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'academia-assets';
