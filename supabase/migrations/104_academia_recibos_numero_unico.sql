-- 104_academia_recibos_numero_unico.sql
-- La numeración de recibos podía repetir un número ya emitido.
-- siguienteNumeroRecibo() contaba TODOS los recibos del centro y sumaba 1;
-- regenerar es DELETE + INSERT, así que el contador bajaba y volvía a dar
-- un número usado. Nada en la base de datos lo impedía: numero_recibo era
-- un text sin restricción.
--
-- Estado real en producción antes de esta migración (consultado 2026-08-25):
--   REC-2026-008  x2  (uno en borrador, otro ya enviado a la familia)
--   REC-2026-006      falta — hueco por un borrado previo
--
-- Esta migración hace dos cosas, en este orden:
--
-- 1) REPARA los duplicados que ya existen. Añadir la restricción sin
--    reparar fallaría con esos datos. Dentro de cada grupo duplicado se
--    CONSERVA el número del recibo que ya salió al mundo (pagado o
--    enviado, y a igualdad el más antiguo) y se renumeran los demás al
--    siguiente libre de su año. Renumerar un documento que una familia ya
--    tiene en su correo sería peor que el propio duplicado.
--
-- 2) AÑADE unique (tenant_id, numero_recibo). NULL queda permitido y no
--    colisiona consigo mismo en Postgres, así que los recibos antiguos sin
--    número no bloquean nada.
--
-- El código deja además de reutilizar números: toma el MÁXIMO de la serie
-- del año en vez del recuento, y al regenerar conserva el número original
-- del recibo en vez de pedir uno nuevo (ver calculos.js y generarRecibo.js).
--
-- Verificación tras aplicar:
--   select tenant_id, numero_recibo, count(*) from public.academia_recibos
--   where numero_recibo is not null group by 1,2 having count(*) > 1;
--   -- esperado: 0 filas

DO $$
DECLARE
  r record;
  siguiente int;
BEGIN
  FOR r IN
    SELECT id, tenant_id, anio
    FROM (
      SELECT
        id, tenant_id, anio,
        row_number() OVER (
          PARTITION BY tenant_id, numero_recibo
          ORDER BY
            CASE WHEN estado IN ('pagado', 'enviado') THEN 0 ELSE 1 END,
            created_at ASC
        ) AS rn
      FROM public.academia_recibos
      WHERE numero_recibo IS NOT NULL
    ) t
    WHERE t.rn > 1
  LOOP
    SELECT coalesce(max(substring(numero_recibo from '^REC-\d{4}-(\d+)$')::int), 0) + 1
      INTO siguiente
      FROM public.academia_recibos
     WHERE tenant_id = r.tenant_id
       AND numero_recibo ~ ('^REC-' || r.anio || '-\d+$');

    UPDATE public.academia_recibos
       SET numero_recibo = 'REC-' || r.anio || '-' || lpad(siguiente::text, 3, '0')
     WHERE id = r.id;

    RAISE NOTICE 'recibo % renumerado a REC-%-%', r.id, r.anio, lpad(siguiente::text, 3, '0');
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.academia_recibos'::regclass
      AND conname = 'academia_recibos_numero_unico'
  ) THEN
    ALTER TABLE public.academia_recibos
      ADD CONSTRAINT academia_recibos_numero_unico UNIQUE (tenant_id, numero_recibo);
  END IF;
END $$;
