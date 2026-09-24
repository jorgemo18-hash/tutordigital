// EL PANEL DE ADMIN DE LA ACADEMIA EN UN MÓVIL (390 px).
//
// Auditoría del 24/09/2026 antes de tocar nada: el menú se comía 64 px de
// 390, la lista de alumnos no enseñaba el nombre, las tarjetas de Finanzas
// iban en fila, las acciones de Envío a familias se salían por la derecha.
// Esto fija lo arreglado: ninguna sección hace scroll horizontal, el menú
// se abre con su botón y se cierra al elegir, y el nombre del alumno se lee.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const ALUMNOS = Array.from({ length: 4 }, (_, i) => ({ id: `a${i}`, nombre: `Alumno de prueba ${i} con apellidos largos`, curso: "1º ESO", nivel: "eso", activo: true }));
const SECCIONES = ["alumnos", "profesores", "horario", "sustituciones", "lista_espera", "documentos", "finanzas", "envio_familias", "ejercicios", "ajustes"];

async function abrir(browser, { width = 390, height = 844, seccion = "alumnos" } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 720, hasTouch: width < 720 });
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, { roles: ["admin"], routes: {
    "**/api/v1/academia/alumnos*": { data: { alumnos: ALUMNOS, total: ALUMNOS.length, page: 1, pageSize: 50 } },
  } });
  await page.goto(`/assets/academia/admin/index.html#${seccion}`, { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("academia admin — móvil", () => {
  for (const seccion of SECCIONES) {
    test(`${seccion}: la página no hace scroll horizontal`, async ({ browser }) => {
      const { context, page } = await abrir(browser, { seccion });
      const { scroll, ancho } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ancho: window.innerWidth }));
      expect(scroll).toBeLessThanOrEqual(ancho);
      await context.close();
    });
  }

  test("el menú: botón arriba, se abre con los textos y se cierra al elegir", async ({ browser }) => {
    const { context, page } = await abrir(browser, { seccion: "finanzas" });
    const menu = page.locator(".ac-sidebar");
    expect((await menu.boundingBox()).x).toBeLessThan(0);
    await page.click(".ac-menu-btn");
    await expect(page.locator(".ac-menu-btn")).toHaveAttribute("aria-expanded", "true");
    await page.waitForTimeout(300);
    expect((await menu.boundingBox()).x).toBeGreaterThanOrEqual(0);
    await expect(page.locator('.ac-sidebar-item[data-section-id="alumnos"] span').last()).toBeVisible();
    await page.click('.ac-sidebar-item[data-section-id="alumnos"]');
    await expect(page.locator("h1.ac-title")).toHaveText("Alumnos");
    await expect(page.locator(".ac-menu-btn")).toHaveAttribute("aria-expanded", "false");
    await context.close();
  });

  test("REGRESIÓN: en la lista de alumnos se lee el nombre", async ({ browser }) => {
    const { context, page } = await abrir(browser);
    const nombre = page.locator(".ac-list-row .ac-list-name").first();
    expect((await nombre.boundingBox()).width).toBeGreaterThan(150);
    await context.close();
  });

  test("en el ordenador no hay botón de menú ni cambia la columna", async ({ browser }) => {
    const { context, page } = await abrir(browser, { width: 1280, height: 800 });
    await expect(page.locator(".ac-menu-btn")).toBeHidden();
    expect((await page.locator(".ac-sidebar").boundingBox()).width).toBe(64);
    await context.close();
  });
});
