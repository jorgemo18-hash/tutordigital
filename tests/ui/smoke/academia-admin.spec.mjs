// Smoke test de academia admin: carga, la sección Alumnos (vista por
// defecto — el panel no tiene dashboard/KPIs) lista un alumno mockeado, y
// el menú lateral navega a Finanzas. fetchMe() aquí exige me.role==="admin"
// exacto para no redirigir a /login.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_ALUMNO = { id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso" };

async function gotoAcademiaAdmin(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/academia/alumnos*": { data: { alumnos: [MOCK_ALUMNO], total: 1, page: 1, pageSize: 30 } },
    },
  });
  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("academia admin — Alumnos y navegación", () => {
  test("la sección Alumnos (por defecto) lista el alumno mockeado", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdmin(browser);

    await expect(page.locator("h1.ac-title")).toHaveText("Alumnos");

    const row = page.locator(".ac-list .ac-list-row");
    await expect(row).toHaveCount(1);
    await expect(row.locator(".ac-list-name")).toContainText("Ana García");

    await context.close();
  });

  test("el menú lateral navega a Finanzas", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdmin(browser);

    await page.click('.ac-sidebar-item[data-section-id="finanzas"]');

    await expect(page.locator("h1.ac-title")).toHaveText("Finanzas");
    await expect(page.locator('.ac-sidebar-item[data-section-id="finanzas"]')).toHaveClass(/\bactive\b/);

    await context.close();
  });

  // Los selectores de año de Finanzas: siete opciones, del año actual hacia
  // atrás. Se comprueba en pantalla y no solo en el test de unidad porque el
  // fallo real fue que UNA de las pestañas se había quedado con su propio
  // bucle de años y ofrecía una lista distinta de la de al lado.
  test("los selectores de año van del año actual hacia atrás, nunca al futuro", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdmin(browser);
    await page.click('.ac-sidebar-item[data-section-id="finanzas"]');

    const actual = new Date().getFullYear();
    for (const pestana of ["Gastos", "Resumen"]) {
      await page.locator(".ac-tabs, .ac-list-tabs").getByRole("button", { name: pestana, exact: true }).first().click();
      // El selector de año es el <select> que tiene una opción con el año
      // actual (el otro de la fila es el de meses). Se espera por el número
      // de opciones: la pestaña se repinta tras su fetch, y sin esperar se
      // lee el DOM de antes.
      const anios = page.locator("select.ac-select")
        .filter({ has: page.locator(`option[value="${actual}"]`) }).first();
      await expect(anios.locator("option")).toHaveCount(7);
      const valores = (await anios.locator("option").allTextContents()).map(Number);

      expect(valores, `${pestana}: del actual hacia atrás`).toEqual(
        Array.from({ length: 7 }, (_, i) => actual - 6 + i)
      );
      expect(Math.max(...valores), `${pestana}: ningún año futuro`).toBe(actual);
    }

    await context.close();
  });
});
