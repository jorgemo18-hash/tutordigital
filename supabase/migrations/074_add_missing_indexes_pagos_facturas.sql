-- 074_add_missing_indexes_pagos_facturas.sql
-- Reconstrucción local de una migración ya aplicada en remoto directamente
-- (versión 20260701192537, "add_missing_indexes_pagos_facturas") sin haber
-- pasado por un archivo versionado en este repo — académia_pagos y
-- academia_facturas solo tenían índice por alumno_id/familia_id, sin uno
-- para el patrón de consulta real (tenant_id + mes/año, igual que gastos).

create index if not exists idx_academia_pagos_tenant_anio_mes
  on public.academia_pagos (tenant_id, anio, mes);

create index if not exists idx_academia_facturas_tenant_anio_mes
  on public.academia_facturas (tenant_id, anio, mes);
