# tutordigital
Tutor digital para alumnos
# Configuracion de backend

Para cambiar el backend, edita `assets/shared/config/runtime-config.js`.

# Seguridad Supabase (v7.0.2)

## Estado en repo
- Migracion de hardening: `supabase/migrations/009_security_advisor_hardening.sql`
- Script de verificacion SQL (read-only): `scripts/supabase-security-smoke.sql`

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
