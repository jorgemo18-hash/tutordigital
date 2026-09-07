-- 114_academia_archivos_privados.sql
-- Las fichas de inscripción y las facturas dejan de vivir en un bucket público.
--
-- EL PROBLEMA. `academia-assets` es un bucket PÚBLICO (storage.buckets.public
-- = true) y ahí dentro están, además del logo y el fondo del centro:
--
--   {tenant}/fichas/{alumno_id}.{ext}  — la hoja de inscripción escaneada,
--       con el nombre del alumno menor, su dirección, los teléfonos de los
--       padres y lo que la familia firmara.
--   {tenant}/gastos/{id}.{ext}         — las facturas del centro.
--
-- Sus URL públicas se guardaban tal cual en academia_alumnos.ficha_url y
-- academia_gastos.foto_url, y esas URL abren el archivo SIN NINGÚN LOGIN.
-- No se pueden listar ni adivinar (la ruta lleva dos UUID), pero eso no es
-- un control de acceso: es una URL difícil, que no caduca nunca y que basta
-- con que se filtre una vez —un historial, una captura, un correo
-- reenviado— para quedar abierta para siempre. Para datos personales de
-- menores no vale.
--
-- LA SOLUCIÓN, y por qué no es "apagar el bucket". El logo del centro SÍ
-- tiene que ser público: va incrustado como <img src> en los correos que se
-- mandan a las familias (ver academiaDiario/ausenciaEmailTemplate.js) y en
-- los PDF. Un correo se queda meses en una bandeja de entrada y una URL
-- firmada habría caducado mucho antes. Así que el bucket público se queda
-- para logo y fondo, y lo sensible se muda al bucket PRIVADO que ya existe
-- y ya se usa así para el documento de normas: `academia-documentos`.
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO REUTILIZAR LA VIEJA. Lo que se guarda ya no
-- es una URL, es una RUTA dentro de un bucket privado — el archivo se sirve
-- proxied por una ruta autenticada del backend, nunca exponiendo una URL de
-- Storage al navegador (mismo patrón que academia_config.normas_path). Una
-- columna llamada `ficha_url` que guarda una ruta es una mentira que alguien
-- creerá dentro de seis meses.
--
-- LAS COLUMNAS VIEJAS NO SE BORRAN AQUÍ. Los archivos que ya están subidos
-- siguen en el bucket público hasta que se ejecute
-- `scripts/migrar-archivos-privados.mjs`, que los copia, rellena estas
-- columnas y borra el original. Entre aplicar esta migración y ejecutar ese
-- script, el panel sigue enseñando las fichas viejas por su URL antigua: se
-- degrada, no se rompe. `ficha_url`/`foto_url` se podrán borrar en una
-- migración posterior, cuando el script haya corrido y se haya comprobado
-- que no queda ninguna fila con URL y sin ruta.
--
-- No se toca ninguna política RLS: las dos tablas ya están acotadas por
-- tenant y estas columnas solo las escribe el backend con la service key.

alter table public.academia_alumnos
  add column if not exists ficha_path text;

alter table public.academia_gastos
  add column if not exists foto_path text;

comment on column public.academia_alumnos.ficha_path is
  'Ruta de la ficha de inscripción escaneada dentro del bucket PRIVADO academia-documentos ({tenant_id}/fichas/{alumno_id}.{ext}). Se sirve proxied por GET /academia/alumnos/:id/ficha/archivo, nunca por URL directa. NULL = alta sin ficha escaneada, o ficha antigua todavía en ficha_url.';

comment on column public.academia_gastos.foto_path is
  'Ruta de la foto/PDF de la factura dentro del bucket PRIVADO academia-documentos ({tenant_id}/gastos/{id}.{ext}). Se sirve proxied por GET /academia/finanzas/gastos/:id/foto/archivo. NULL = gasto sin factura adjunta, o factura antigua todavía en foto_url.';

comment on column public.academia_alumnos.ficha_url is
  'OBSOLETA — URL pública de la ficha en el bucket academia-assets. Sustituida por ficha_path (bucket privado). Solo quedan aquí las fichas subidas antes de la migración 114 y hasta que se ejecute scripts/migrar-archivos-privados.mjs.';

comment on column public.academia_gastos.foto_url is
  'OBSOLETA — URL pública de la factura en el bucket academia-assets. Sustituida por foto_path (bucket privado). Ver el comentario de academia_alumnos.ficha_url.';
