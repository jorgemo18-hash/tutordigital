-- 059_academia_recibos.sql
-- Módulo "Envío a familias": recibos informativos mensuales por familia.
-- Nota: academia_recibos, academia_recibos_lineas, academia_config.* (las 3
-- columnas nuevas) y sus políticas RLS "tenant_isolation" ya existían en
-- producción (jzheomyuwztdhttejskz) al escribir esta migración — solo
-- faltaba la columna numero_recibo. Todo el resto queda aquí versionado
-- con IF NOT EXISTS / DROP+CREATE idempotente para que un entorno nuevo
-- termine con el mismo esquema exacto que prod (lineas no lleva tenant_id
-- propio: su RLS deriva el tenant a través de academia_recibos.recibo_id).

ALTER TABLE public.academia_config
  ADD COLUMN IF NOT EXISTS concepto_recibo_plantilla text,
  ADD COLUMN IF NOT EXISTS texto_exencion_iva text,
  ADD COLUMN IF NOT EXISTS descuento_hermanos_pct numeric(5,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.academia_recibos (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  familia_id              uuid not null references public.academia_familias(id) on delete cascade,
  mes                     smallint not null check (mes between 1 and 12),
  anio                    smallint not null,
  numero_recibo           text,
  concepto                text not null,
  descuento_hermanos_pct  numeric(5,2) not null default 0,
  descuento_puntual_pct   numeric(5,2) not null default 0,
  descuento_puntual_nota  text,
  total_bruto             numeric(8,2) not null default 0,
  total_descuento         numeric(8,2) not null default 0,
  total_neto              numeric(8,2) not null default 0,
  estado                  text not null default 'borrador' check (estado in ('borrador','enviado')),
  fecha_envio             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, familia_id, mes, anio)
);

-- Ya existía sin esta columna en prod — la añade ahí, no-op en DB nuevas.
ALTER TABLE public.academia_recibos
  ADD COLUMN IF NOT EXISTS numero_recibo text;

CREATE TABLE IF NOT EXISTS public.academia_recibos_lineas (
  id              uuid primary key default gen_random_uuid(),
  recibo_id       uuid not null references public.academia_recibos(id) on delete cascade,
  alumno_id       uuid references public.academia_alumnos(id) on delete set null,
  nombre_alumno   text not null,
  curso_alumno    text,
  precio_bruto    numeric(8,2) not null default 0,
  descripcion     text,
  created_at      timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_academia_recibos_tenant_mes ON public.academia_recibos(tenant_id, anio, mes);
CREATE INDEX IF NOT EXISTS idx_academia_recibos_familia ON public.academia_recibos(familia_id);
CREATE INDEX IF NOT EXISTS idx_academia_recibos_lineas_recibo ON public.academia_recibos_lineas(recibo_id);

ALTER TABLE public.academia_recibos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academia_recibos_lineas ENABLE ROW LEVEL SECURITY;

-- ----------------------------
-- ACADEMIA_RECIBOS / ACADEMIA_RECIBOS_LINEAS — datos de facturación a
-- familias. Solo admin/superadmin. Lineas no tiene tenant_id propio: el
-- tenant se verifica a través de su recibo padre.
-- ----------------------------
DROP POLICY IF EXISTS tenant_isolation ON public.academia_recibos;
CREATE POLICY tenant_isolation
ON public.academia_recibos
FOR ALL
TO authenticated
USING (public.has_active_role(tenant_id, array['admin','superadmin']));

DROP POLICY IF EXISTS tenant_isolation ON public.academia_recibos_lineas;
CREATE POLICY tenant_isolation
ON public.academia_recibos_lineas
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.academia_recibos r
    WHERE r.id = academia_recibos_lineas.recibo_id
      AND public.has_active_role(r.tenant_id, array['admin','superadmin'])
  )
);
