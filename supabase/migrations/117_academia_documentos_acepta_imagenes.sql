-- 117_academia_documentos_acepta_imagenes.sql
--
-- ARREGLA UN FALLO EN PRODUCCIÓN: subir la ficha de un alumno o la factura
-- de un gasto responde 500 "No se pudo subir el archivo" SIEMPRE que el
-- archivo es una foto. Solo funcionaba si era un PDF.
--
-- POR QUÉ. El bucket `academia-documentos` lo creó la migración 086 para las
-- normas del centro, que son PDF o DOCX, y por eso su `allowed_mime_types`
-- es exactamente ['application/pdf', '...wordprocessingml.document']. La
-- migración 114 metió en ese mismo bucket la ficha del alumno y la factura
-- del gasto —que son FOTOS— y no tocó esa lista. Desde entonces Storage
-- rechaza cada subida de imagen.
--
-- LEÍDO EN LOS LOGS DE STORAGE (11/09/2026, dos alumnos distintos):
--   POST /object/academia-documentos/{tenant}/fichas/{alumno}.jpg -> 400
--   errorCode "InvalidMimeType", message "mime type image/jpeg is not supported"
--   role service_role, x-upsert true
--
-- Y POR QUÉ NO SE VIO ANTES. En el bucket hay 38 fichas y 14 facturas en
-- JPG/PNG, así que parecía que funcionaba. Todas tienen fecha del 07/09/2026,
-- el día en que se ejecutó scripts/migrar-archivos-privados.mjs, que NO sube:
-- usa storage.copy() para traerlas del bucket público, y copy no valida
-- `allowed_mime_types`. Es decir: los archivos que hay entraron por una
-- puerta que no comprueba, y la puerta que sí comprueba nunca ha dejado
-- pasar una imagen. El único archivo que llegó ahí por la API es normas.pdf.
--
-- QUÉ MIMES HACEN FALTA. Solo cuatro llegan a Storage: la lista que acepta
-- el backend es más larga (HEIC, HEIF, DNG), pero esos se convierten a JPEG
-- antes de subir (server/lib/academiaStorage/heicConverter.js). Los que
-- viajan de verdad son jpeg, png, webp y pdf. El docx se queda porque es el
-- formato de las normas.
--
-- Para que esta discrepancia no pueda repetirse, el test
-- tests/academiaStorage/bucketAceptaLoQueSubimos.test.mjs compara las
-- constantes del código (ALLOWED_FOTO_MIMES, MAX_FOTO_BYTES) contra esta
-- migración y falla si alguien añade un formato en un sitio y no en el otro.

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'academia-documentos';
