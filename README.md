# tutordigital
Tutor digital para alumnos
# Configuracion de backend

Para cambiar el backend, edita `assets/shared/config/runtime-config.js`.

# Seguridad Supabase (v7.0.2)

## Estado en repo
- Migracion de hardening: `supabase/migrations/009_security_advisor_hardening.sql`
- Script de verificacion SQL (read-only): `scripts/supabase-security-smoke.sql`
- Migraciones v7.x RLS:
  - `supabase/migrations/011_enable_rls_v7.sql`
  - `supabase/migrations/012_policies_v7_teacher_requests.sql`
  - `supabase/migrations/013_functions_search_path_v7.sql`
- Smoke aislamiento tenant A/B:
  - `scripts/supabase-tenant-isolation-smoke.sql`

## Accion manual obligatoria en Supabase Dashboard
- `Auth -> Settings -> Password Security -> Leaked password protection = ON`

## Smoke rapido backend (Render/Fastify)
- `GET /health` -> `200`
- `POST /api/v1/auth/login` -> `200` o `401` esperado
- `GET /api/v1/me` con token -> `200`
- `GET /api/v1/groups` con token -> `200`
- `GET /api/v1/students` con token -> `200`
- `GET /api/v1/tasks` con token -> `200`
- `GET /api/v1/tickets` con token -> `200`
- `POST /api/v1/chat` (payload valido) -> `200`
- `GET /api/v1/notebook/summary` (teacher/admin) -> `200`

## Deploy smoke hardening (v7.0.7)
- Header tenant estandar en requests autenticadas: `x-ttd-tenant` (valor: `ttd_activeTenantSlug`).
- Script de smoke sin UI: `scripts/smoke-hardening.sh`.
- Ejemplo:
  - `API_BASE="https://TU_BACKEND.onrender.com" GOOD_ORIGIN="https://TU_DOMINIO.vercel.app" ./scripts/smoke-hardening.sh`
- Check opcional `forbidden_tenant` con 2 tenants:
  - `AUTH_TOKEN`, `GOOD_TENANT`, `BAD_TENANT` y ejecutar el mismo script.
