-- 111_academia_config_jornada_partida.sql
-- Jornada partida: un centro puede abrir por la mañana Y por la tarde.
--
-- academia_config solo tenía UN tramo de apertura (franja_inicio,
-- franja_fin). Una academia que da clase de 9:00 a 14:00 y de 16:00 a 21:00
-- tenía dos salidas, las dos malas: poner 9:00-21:00 y arrastrar doce filas
-- muertas del mediodía en cada rejilla que se abre, o poner solo la tarde y
-- no poder meter las clases de la mañana.
--
-- Se añade un SEGUNDO tramo, opcional. NULL en cualquiera de los dos = el
-- centro tiene jornada continua, que es el caso de la inmensa mayoría de
-- academias (Lyceo incluida) y sigue funcionando exactamente igual sin
-- tocar nada.
--
-- Por qué dos columnas y no una tabla de tramos: los dos únicos repartos
-- que existen de verdad en una academia son "seguido" y "mañana y tarde".
-- Una tabla admitiría cinco tramos irregulares que nadie ha pedido, y
-- obligaría a resolver el orden, los solapes y el borrado de un tramo con
-- clases dentro — complejidad real a cambio de un caso imaginario. Si algún
-- día aparece un centro con tres tramos, esto se migra a una tabla; hasta
-- entonces, dos columnas dicen la verdad.
--
-- Sin CHECK de "el segundo empieza después del primero": la validación vive
-- en el backend (UpdateConfigSchema), que puede explicar el error en
-- castellano. Un CHECK aquí devolvería un 500 opaco al admin.

alter table public.academia_config
  add column if not exists franja_inicio_2 time,
  add column if not exists franja_fin_2 time;

comment on column public.academia_config.franja_inicio_2 is
  'Apertura del segundo tramo (jornada partida). NULL = jornada continua, un solo tramo.';
comment on column public.academia_config.franja_fin_2 is
  'Cierre del segundo tramo (jornada partida). NULL = jornada continua, un solo tramo.';
