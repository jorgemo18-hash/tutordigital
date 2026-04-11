-- 032_tenants_slug_partial_unique.sql
-- Reemplaza la constraint global tenants_slug_key por un partial unique index
-- (WHERE deleted_at IS NULL) para que los slugs de centros en papelera puedan
-- reutilizarse al crear un nuevo centro.
--
-- Los FK a tenants(slug) en subjects y teacher_profiles bloquean este cambio
-- porque PostgreSQL no permite FK references a partial indexes.
-- Solución: añadir tenant_id a esas tablas, migrar datos, redirigir FK a tenants.id.

-- 1. Añadir tenant_id a subjects y teacher_profiles
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

ALTER TABLE public.teacher_profiles
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- 2. Poblar tenant_id desde el tenant_slug existente
UPDATE public.subjects s
SET tenant_id = t.id
FROM public.tenants t
WHERE t.slug = s.tenant_slug AND s.tenant_id IS NULL;

UPDATE public.teacher_profiles tp
SET tenant_id = t.id
FROM public.tenants t
WHERE t.slug = tp.tenant_slug AND tp.tenant_id IS NULL;

-- 3. Añadir FK tenant_id → tenants.id ON DELETE CASCADE (sustituye al slug FK)
ALTER TABLE public.subjects
  ADD CONSTRAINT subjects_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.teacher_profiles
  ADD CONSTRAINT teacher_profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;

-- 4. Eliminar FK constraints que apuntan a tenants(slug) — ya cubiertos por tenant_id
ALTER TABLE public.subjects        DROP CONSTRAINT IF EXISTS subjects_tenant_slug_fkey;
ALTER TABLE public.teacher_invites DROP CONSTRAINT IF EXISTS teacher_invites_tenant_slug_fkey;
ALTER TABLE public.teacher_profiles DROP CONSTRAINT IF EXISTS teacher_profiles_tenant_slug_fkey;

-- 5. Ahora sí: eliminar la unique constraint global y crear el partial unique index
ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS tenants_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_active_key
  ON public.tenants(slug)
  WHERE deleted_at IS NULL;
