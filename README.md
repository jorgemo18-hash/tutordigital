# tutordigital

Tutor digital para alumnado con frontend estático por roles y backend Fastify.

## Fuente de verdad

- Backend activo: `server/`
- Frontend: `assets/student`, `assets/teacher`, `assets/admin`, `assets/home`
- Configuración runtime del navegador: `assets/shared/config/runtime-config.js`

## Configuración principal

### Backend del frontend

El frontend resuelve la API desde `window.__TTD_CONFIG__.API_BASE_URL` en `assets/shared/config/runtime-config.js`.

Si no se define, el cliente cae al mismo origin del navegador en `assets/shared/js/config.js`.

### Origins y CORS

La allowlist principal del backend se configura con `ALLOWED_ORIGINS`.

Ejemplo:

```bash
ALLOWED_ORIGINS="https://tutordigital.vercel.app,https://tutordigital-*.vercel.app,http://localhost:5173,http://127.0.0.1:5173"
```

Notas:
- `server/app.js` usa esa allowlist para CORS general.
- Los guards por ruta aceptan `CHAT_ALLOWED_ORIGINS` como override específico; si no está, heredan `ALLOWED_ORIGINS`.
- Los endpoints sensibles siguen validando `Origin/Referer` además del auth y tenant guard.

### Build y versión

- Versión del backend: `package.json`
- Label de build backend: `server/lib/version.js`
- Label runtime frontend: `assets/shared/config/runtime-config.js`

Si cambias versión, actualiza juntos esos puntos para no mezclar labels viejos con código nuevo.

## Estado de seguridad y datos

- Migración de hardening: `supabase/migrations/009_security_advisor_hardening.sql`
- Smoke SQL read-only: `scripts/supabase-security-smoke.sql`
- Migraciones RLS v7: `supabase/migrations/011_enable_rls_v7.sql`, `supabase/migrations/012_policies_v7_teacher_requests.sql`, `supabase/migrations/013_functions_search_path_v7.sql`
- Smoke aislamiento tenant A/B: `scripts/supabase-tenant-isolation-smoke.sql`

Acción manual obligatoria en Supabase Dashboard:
- `Auth -> Settings -> Password Security -> Leaked password protection = ON`

## Flujos actuales

- Login siempre con `email + password`
- Código de centro solo vincula tenant: `POST /api/v1/tenant/join`
- Alta alumno por código crea membership `student` con estado `pending`
- El panel alumno queda bloqueado hasta aprobación: `GET /api/v1/student/status`

## Verificación rápida

### Tests del repo

```bash
npm test
```

### Smoke rápido backend

- `GET /health` -> `200`
- `POST /api/v1/auth/login` -> `200` o `401` esperado
- `GET /api/v1/me` con token -> `200`
- `GET /api/v1/groups` con token -> `200`
- `GET /api/v1/students` con token -> `200`
- `GET /api/v1/tasks` con token -> `200`
- `GET /api/v1/tickets` con token -> `200`
- `POST /api/v1/chat` con payload válido -> `200`
- `GET /api/v1/notebook/summary` como `teacher/admin` -> `200`

### Smoke hardening

- Header tenant estándar en requests autenticadas: `x-ttd-tenant` con `ttd_activeTenantSlug`
- Script sin UI: `scripts/smoke-hardening.sh`

Ejemplo:

```bash
API_BASE="https://TU_BACKEND.onrender.com" GOOD_ORIGIN="https://TU_DOMINIO.vercel.app" ./scripts/smoke-hardening.sh
```

Check opcional `forbidden_tenant` con 2 tenants:
- define `AUTH_TOKEN`, `GOOD_TENANT`, `BAD_TENANT`
- ejecuta el mismo script

## Debug útil

- Activar debug admin en navegador:
  - `localStorage.setItem("ttd_debug", "1"); location.reload();`
- Desactivar:
  - `localStorage.removeItem("ttd_debug"); location.reload();`
