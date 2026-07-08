// Regresión visual de los 6 paneles, oscuro y claro. Congela la fecha (varios
// paneles pintan "hoy" en el saludo/cabecera) y usa una sesión+API mockeadas
// para que cada panel renderice su shell real sin backend. Compara contra
// las capturas de referencia en __screenshots__/ (generar/actualizar con
// `npm run test:ui:update`).
import { test, expect } from "@playwright/test";
import { PANELS } from "../fixtures/panels.mjs";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const FROZEN_DATE = new Date("2026-01-15T12:00:00");
const THEMES = ["dark", "light"];

for (const panel of PANELS) {
  for (const theme of THEMES) {
    test(`fondo — ${panel.name} (${theme})`, async ({ browser }) => {
      const context = await browser.newContext({ colorScheme: theme, reducedMotion: "reduce" });
      await forceTheme(context, theme);
      await forceFakeSession(context);

      const page = await context.newPage();
      await page.clock.setFixedTime(FROZEN_DATE);
      await installApiMocks(page, { isSuperadmin: true });

      await page.goto(panel.path, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);

      await expect(page).toHaveScreenshot(`${panel.name}-${theme}.png`, { fullPage: false });
      await context.close();
    });
  }
}
