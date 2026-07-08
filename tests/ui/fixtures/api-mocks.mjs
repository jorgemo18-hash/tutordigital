// Mock del backend para tests de UI sin servidor real. Los 6 paneles llaman
// a /api/v1/me al arrancar (para resolver rol/membership) — sin mockearlo,
// todos redirigen a /login antes de pintar nada. El resto de endpoints se
// cubre con un catch-all vacío salvo que el test pida algo concreto.
import { FAKE_TENANT_SLUG } from "./theme.mjs";

function buildMembership(role, tenantSlug) {
  return {
    role,
    member_role: role,
    membership_role: role,
    status: "active",
    tenantSlug,
    tenant_slug: tenantSlug,
    tenant: { slug: tenantSlug, tenant_slug: tenantSlug, name: "Demo", type: "instituto" },
  };
}

/**
 * @param {{ roles?: string[], isSuperadmin?: boolean, tenantSlug?: string }} opts
 */
export function buildMeResponse({ roles = ["admin", "teacher", "student"], isSuperadmin = false, tenantSlug = FAKE_TENANT_SLUG } = {}) {
  const memberships = roles.map((role) => buildMembership(role, tenantSlug));
  return {
    data: { user: { display_name: "Demo", is_superadmin: isSuperadmin }, memberships },
    memberships,
  };
}

function jsonRoute(page, urlGlob, body, status = 200) {
  return page.route(urlGlob, (route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) })
  );
}

// assets/shared/config/runtime-config.js fija window.__TTD_CONFIG__.API_BASE_URL
// a un host absoluto de producción (https://tutordigital.onrender.com) — todas
// las llamadas de todos los paneles van ahí, no al origen servido en el test.
// Se reescribe a same-origin para evitar cualquier duda de preflight/CORS
// cross-origin en la intercepción (los mocks de /api/v1/** de abajo siguen
// funcionando igual, ahora contra el mismo origin que sirve el HTML).
async function forceSameOriginApi(page) {
  await page.route("**/assets/shared/config/runtime-config.js", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/javascript; charset=utf-8",
      body: `window.__TTD_CONFIG__ = { API_BASE_URL: "", APP_VERSION: "test", BUILD_LABEL: "test", SENTRY_DSN: "" };
window.RUNTIME_CONFIG = { DEBUG_NOTEBOOK: false, DEBUG_STUDENT_BOOT: false };`,
    })
  );
}

// CDNs externos reales (Sentry, MathJS) que algunos HTML cargan pero cuya
// lógica nunca se ejecuta en los tests (DSN vacío / módulo no referenciado).
// Se abortan para que la suite no dependa de red real ni sea flaky en CI.
async function blockExternalCdns(page) {
  await page.route(/https:\/\/(browser\.sentry-cdn\.com|cdnjs\.cloudflare\.com)\//, (route) =>
    route.abort()
  );
}

/**
 * Instala el mock de API para un test. `routes` permite sobreescribir/añadir
 * endpoints concretos (ej. la lista de alumnos de admin, o la tabla de
 * centros de superadmin) — se registran DESPUÉS del catch-all para que
 * Playwright les dé prioridad (gana el último route() registrado).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ roles?: string[], isSuperadmin?: boolean, routes?: Record<string, unknown> }} opts
 */
export async function installApiMocks(page, { roles, isSuperadmin, routes = {} } = {}) {
  await forceSameOriginApi(page);
  await blockExternalCdns(page);
  await jsonRoute(page, "**/api/v1/**", { data: {} });
  await jsonRoute(page, "**/api/v1/me", buildMeResponse({ roles, isSuperadmin }));
  for (const [urlGlob, body] of Object.entries(routes)) {
    await jsonRoute(page, urlGlob, body);
  }
}
