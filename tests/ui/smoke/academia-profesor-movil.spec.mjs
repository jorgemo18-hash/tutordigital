// EL PANEL DEL PROFESOR DE LA ACADEMIA EN UN MÓVIL (390 px).
// Auditoría del 24/09/2026: la cabecera de tres columnas y el cuadrante
// semanal empujaban la página a 646 px de ancho, y en el Diario se cortaban
// el curso y el estado de cada alumno.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const FRANJAS = [1, 2, 3, 4, 5].flatMap((d) => ["15:30", "16:30"].map((h, i) => ({
  dia_semana: d, hora_inicio: `${h}:00`, alumno: { id: `a${d}${i}`, nombre: `Alumna ${d}${i} Apellido`, curso: "1º ESO", nivel: "eso" },
})));
const TARDE = ["Daniel Esteban Giménez", "Alejandra Ferrer"].map((nombre) => ({
  nombre, curso: "1º ESO", nivel: "eso", horarios: [{ hora_inicio: "15:30:00", hora_fin: "00:00:00" }],
}));

async function abrir(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, { roles: ["teacher"], routes: {
    "**/api/v1/academia/horario*": { data: { franjas: FRANJAS } },
    "**/api/v1/academia/sesiones*": { data: { fecha: "2026-09-24", alumnos: TARDE } },
  } });
  await page.goto("/assets/academia/profesor/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

const anchoDePagina = (page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe("academia profesor — móvil", () => {
  test("REGRESIÓN: el Horario no ensancha la página; el cuadrante se desplaza dentro de su caja", async ({ browser }) => {
    const { context, page } = await abrir(browser);
    expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
    const grid = page.locator(".ac-grid");
    const { scrollWidth, clientWidth } = await grid.evaluate((g) => ({ scrollWidth: g.scrollWidth, clientWidth: g.clientWidth }));
    expect(scrollWidth).toBeGreaterThan(clientWidth);
    expect((await page.locator(".ac-grid-head").first().boundingBox()).width).toBeGreaterThanOrEqual(100);
    await context.close();
  });

  test("REGRESIÓN: el Diario cabe entero, con el estado de cada alumno a la vista", async ({ browser }) => {
    const { context, page } = await abrir(browser);
    await page.locator(".ac-tab:has-text('Diario')").click();
    await expect(page.locator(".ac-card").first()).toBeVisible();
    expect(await anchoDePagina(page)).toBeLessThanOrEqual(390);
    const estado = await page.locator(".ac-card .ac-state").first().boundingBox();
    expect(estado.x + estado.width).toBeLessThanOrEqual(390);
    await context.close();
  });
});
