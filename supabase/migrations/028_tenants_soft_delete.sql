-- 028_tenants_soft_delete.sql
-- Papelera para centros: soft delete con TTL de 30 días.
-- Los centros con deleted_at NOT NULL no aparecen en ninguna vista normal.
-- El backend filtra deleted_at IS NULL en todos los listados.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tenants_deleted_at
  ON public.tenants (deleted_at)
  WHERE deleted_at IS NOT NULL;
