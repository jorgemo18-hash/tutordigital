-- 050_tenants_add_pending_status.sql
-- Permite el estado 'pending' en tenants para el flujo de self-service onboarding.
-- Un director puede registrar su academia; queda en 'pending' hasta que el
-- superadmin lo aprueba.

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_status_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_status_check
  CHECK (status IN ('active', 'trial', 'inactive', 'pending'));
