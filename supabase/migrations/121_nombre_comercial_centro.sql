-- 121 — EL CENTRO TIENE DOS NOMBRES, Y HASTA AHORA COMPARTÍAN COLUMNA.
--
-- `nombre_emisor` hacía dos trabajos a la vez:
--   1) la razón social que se imprime en la cabecera de recibos y facturas
--      (dato fiscal: tiene que coincidir con el NIF de al lado);
--   2) el nombre que las familias ven en la bandeja de entrada cuando les
--      llega un email, porque es lo que va en el `From` (ver
--      server/lib/academiaEnvio/remitente.js).
--
-- En Lyceo coinciden ("Lyceo academia" sirve para las dos cosas) y por eso
-- no se notaba. En cuanto entre un centro que fiscalmente sea
-- "ACADEMIA RUIZ, S.L." y comercialmente "Academia Ruiz", hay que elegir:
-- o la factura queda informal, o la bandeja de entrada de las familias
-- dice "S.L.". Son dos conceptos distintos y necesitan dos columnas.
--
-- QUÉ NO CAMBIA, que es lo importante de esta migración: la columna nace
-- NULL para todos los centros, y con NULL el nombre comercial ES el fiscal
-- (la precedencia está en server/lib/academiaCentro/nombresCentro.js). O
-- sea: aplicar esto no cambia ni un email ni un documento de los que ya
-- salen hoy. Solo abre la puerta a diferenciarlos cuando haga falta.
--
-- Nullable a propósito y sin default: NULL significa "este centro no tiene
-- nombre comercial distinto", que no es lo mismo que la cadena vacía que
-- guardaría el panel si el campo se dejara en blanco. Las dos se tratan
-- igual en el código (ambas caen al fiscal), pero conviene que la base de
-- datos pueda distinguir "nunca lo tocó" de "lo borró".

alter table public.academia_config
  add column if not exists nombre_comercial text;

comment on column public.academia_config.nombre_emisor is
  'Razón social / nombre fiscal del centro. Es el que se imprime en recibos y facturas junto al NIF. NO usar como nombre de marca: para eso está nombre_comercial.';

comment on column public.academia_config.nombre_comercial is
  'Nombre de marca del centro, el que conocen las familias. Se usa en el remitente visible de los emails. NULL o vacío = usar nombre_emisor.';
