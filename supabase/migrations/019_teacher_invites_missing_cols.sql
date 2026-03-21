-- 019_teacher_invites_missing_cols.sql
-- The live DB has teacher_invites but was created without the columns defined
-- in migration 014 (status, tenant_slug, used_at, expires_at).
-- This migration adds them safely.

ALTER TABLE public.teacher_invites
  ADD COLUMN IF NOT EXISTS tenant_slug text   REFERENCES public.tenants(slug) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status      text   NOT NULL DEFAULT 'pending'
                                              CHECK (status IN ('pending','used','revoked','expired')),
  ADD COLUMN IF NOT EXISTS used_at     timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at  timestamptz;

-- Back-fill tenant_slug for existing rows using tenant_id
UPDATE public.teacher_invites ti
SET tenant_slug = t.slug
FROM public.tenants t
WHERE ti.tenant_slug IS NULL AND ti.tenant_id = t.id;

-- Index used by the list endpoint
CREATE INDEX IF NOT EXISTS idx_teacher_invites_tenant_status
  ON public.teacher_invites (tenant_slug, status);

-- Unique constraint: one pending invite per (tenant, email)
CREATE UNIQUE INDEX IF NOT EXISTS uq_teacher_invites_pending
  ON public.teacher_invites (tenant_slug, email)
  WHERE status = 'pending';
