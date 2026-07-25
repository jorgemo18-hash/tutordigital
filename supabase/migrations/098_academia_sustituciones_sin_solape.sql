-- 098_academia_sustituciones_sin_solape.sql
-- Impide dos sustituciones ACTIVAS (revocada_at is null) del mismo
-- profesor_sustituto_id sobre el mismo profesor_sustituido_id con rangos
-- de fechas que se solapen. Sin esto era posible crear duplicados o
-- rangos solapados por cualquier vía que no fuera pasar por el
-- formulario ya corregido (commit 117229a) — llamada directa a la API,
-- condición de carrera entre dos peticiones simultáneas, o un admin
-- creando dos rangos que se pisen. Con dos sustituciones activas
-- equivalentes, revocar una deja la otra dando acceso igual: la
-- revocación deja de ser fiable, que es justo lo que garantiza toda la
-- feature.

-- 1) LIMPIEZA DE DATOS PRIMERO — imprescindible antes del EXCLUDE de más
--    abajo: si quedara más de una fila activa solapada, el ALTER TABLE
--    fallaría al validar los datos existentes.
--    Hay dos filas duplicadas activas ahora mismo en producción (mismo
--    par sustituto/sustituido, mismo día 2026-07-25), creadas con 9
--    segundos de diferencia — el bug de doble clic que corrigió el
--    commit 117229a, verificado contra el proyecto real antes de
--    escribir esto:
--      348065ec-4535-4d72-b868-a7bdba3bcb8d  (se deja activa)
--      718079eb-b2ed-4d13-ae88-c2d45a19ecee  (se revoca aquí)
--    Se revoca la MÁS RECIENTE, dejando la original como la sustitución
--    real vigente. revocada_por usa el mismo profile que la declaró
--    (declarada_por): es la limpieza automática de un duplicado que él
--    mismo generó sin querer por el bug de UI, no la acción de un admin
--    real — se deja constancia aquí para que el rastro de auditoría no
--    resulte confuso más adelante.
update public.academia_sustituciones
set revocada_at = now(), revocada_por = declarada_por
where id = '718079eb-b2ed-4d13-ae88-c2d45a19ecee'
  and revocada_at is null;

-- 2) btree_gist — comprobado que está disponible pero NO instalada en el
--    proyecto antes de asumirlo. Hace falta para el EXCLUDE de abajo:
--    sin ella, un índice GiST no tiene operador de igualdad (=) para
--    comparar las columnas uuid, solo sabría usar el operador de solape
--    (&&) de daterange en solitario.
create extension if not exists btree_gist;

-- 3) Por qué EXCLUDE + GiST y no un índice único parcial:
--    Un índice único (btree) solo compara por igualdad exacta de sus
--    columnas — no hay forma de expresarle "ningún rango de fechas ya
--    registrado se solapa con este nuevo rango" de forma declarativa,
--    ni siquiera incluyendo fecha_inicio/fecha_fin en la clave (dos
--    rangos pueden solaparse con fechas de inicio y fin distintas entre
--    sí). Para eso hace falta un índice GiST con el operador de solape
--    de un tipo range (daterange), que es exactamente lo que permite un
--    EXCLUDE CONSTRAINT: postgres comprueba, en cada INSERT, que no
--    exista ninguna fila existente para la que TODOS los operadores del
--    constraint sean verdaderos a la vez (= en los dos profesores, &&
--    en el rango de fechas) — la misma garantía transaccional de un
--    índice único, pero expresando una condición de solape en vez de
--    igualdad.
--
--    Por qué daterange(..., '[]') — rango CERRADO en ambos extremos:
--    fecha_inicio y fecha_fin son inclusive en todo el resto del código
--    (ver reglasCreacion.js / resolverAlumnosVisibles.js, que comparan
--    con <=/>=). El rango por defecto de Postgres es '[)' (fin
--    EXCLUSIVO), que representaría mal esa semántica: daterange(1,5,'[)')
--    cubre solo los días 1-4, dejando el día 5 fuera. Eso haría que dos
--    sustituciones que SÍ se pisan de verdad (1-5 y 5-10, ambas activas
--    el día 5 según la semántica inclusive de las columnas) NO fueran
--    detectadas como solapadas por el constraint — un solape real
--    escapándose, que es precisamente lo que esta migración existe para
--    impedir. Con '[]' ese caso se bloquea correctamente, y los rangos
--    de verdad contiguos (1-5 y 6-10) siguen permitidos.
--
--    `WHERE (revocada_at IS NULL)` limita el constraint a las filas
--    activas: revocar una sustitución y volver a declarar la misma
--    cobertura después debe seguir siendo posible, y de hecho es el
--    flujo normal (ver reglasRevocacion.js).
alter table public.academia_sustituciones
  add constraint academia_sustituciones_sin_solape
  exclude using gist (
    profesor_sustituto_id with =,
    profesor_sustituido_id with =,
    daterange(fecha_inicio, fecha_fin, '[]') with &&
  )
  where (revocada_at is null);
