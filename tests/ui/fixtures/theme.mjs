// Fuerza el tema (oscuro/claro) y una sesión falsa antes de que cargue
// cualquier script de arranque del panel. Los 6 paneles leen el tema de
// localStorage["ttdTheme"] (y algunos también de "ttdTheme_<tenantSlug>")
// en un <script> inline que corre antes que nada — por eso esto se instala
// vía addInitScript, no tras la navegación.

export const FAKE_TENANT_SLUG = "demo";

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {'dark'|'light'} theme
 */
export async function forceTheme(context, theme) {
  await context.addInitScript(
    ({ theme, tenantSlug }) => {
      try {
        localStorage.setItem("ttdTheme", theme);
        localStorage.setItem(`ttdTheme_${tenantSlug}`, theme);
      } catch {}
    },
    { theme, tenantSlug: FAKE_TENANT_SLUG }
  );
}

/**
 * Sesión falsa (token + tenant) para pasar las guardas de
 * assets/shared/js/guard.js y equivalentes sin backend real.
 * @param {import('@playwright/test').BrowserContext} context
 */
export async function forceFakeSession(context) {
  await context.addInitScript(
    ({ tenantSlug }) => {
      try {
        localStorage.setItem("ttd_access_token", "fake-token-for-ui-tests");
        localStorage.setItem("ttd_activeTenantSlug", tenantSlug);
        localStorage.setItem("ttd_expires_at", String(Date.now() / 1000 + 3600));
      } catch {}
    },
    { tenantSlug: FAKE_TENANT_SLUG }
  );
}
