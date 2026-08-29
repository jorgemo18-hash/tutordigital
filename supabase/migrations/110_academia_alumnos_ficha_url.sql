-- 110_academia_alumnos_ficha_url.sql
-- La foto de la ficha de inscripción en papel se queda guardada.
--
-- Hasta ahora la hoja que el admin fotografía para dar de alta a un alumno
-- se enviaba al OCR, se extraían los datos y la imagen se descartaba. La
-- academia se quedaba con los datos pero SIN el documento original — que es
-- justo lo que hay que poder enseñar si una familia discute lo que firmó
-- (autorizaciones, datos de contacto, condiciones aceptadas).
--
-- Las facturas de gastos ya se guardan así desde hace tiempo
-- (academia_gastos.foto_url) y el flujo es el mismo: se sube al bucket
-- academia-assets, en {tenant_id}/fichas/{alumno_id}.{ext}, y aquí solo
-- queda la URL pública.
--
-- NULLABLE, sin valor por defecto: todos los alumnos que ya existen se
-- dieron de alta a mano o con el OCR viejo y no tienen ficha guardada. No
-- hay nada que rellenar retroactivamente y "sin ficha" es un estado normal
-- y permanente para ellos — un alta manual, sin papel de por medio, tampoco
-- tendrá ninguna.
--
-- No se toca ninguna política RLS: la columna vive en una tabla que ya está
-- acotada por tenant y solo la escribe el backend con la service key, igual
-- que foto_url en academia_gastos.

alter table public.academia_alumnos
  add column if not exists ficha_url text;

comment on column public.academia_alumnos.ficha_url is
  'URL pública de la foto/PDF de la ficha de inscripción en papel (bucket academia-assets, {tenant_id}/fichas/{alumno_id}.{ext}). NULL = alta sin ficha escaneada.';
