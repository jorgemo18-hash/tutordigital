// Smoke test de admin (instituto): las secciones navegan (tabs del sidebar)
// y la lista de alumnos renderiza con datos mock.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_STUDENTS = [
  {
    key: "student:s1", student_id: "s1", invite_id: "inv1",
    name: "Ana García", email: "ana@example.com",
    group_id: "g1", group_name: "1º ESO A",
    state: "activo", created_at: "2026-01-01T00:00:00Z", meta: {},
  },
];

async function gotoAdmin(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/admin/students/unified": {
        data: { items: MOCK_STUDENTS, groups: [{ id: "g1", name: "1º ESO A" }], total: 1 },
      },
    },
  });
  await page.goto("/assets/admin/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("admin instituto — navegación y listas", () => {
  test("el dashboard es la sección visible por defecto", async ({ browser }) => {
    const { context, page } = await gotoAdmin(browser);

    await expect(page.locator("#tabDashboard")).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator("#tabAlumnos")).toHaveClass(/\bhidden\b/);

    await context.close();
  });

  test("navegar a Alumnos muestra la lista con el alumno mockeado", async ({ browser }) => {
    const { context, page } = await gotoAdmin(browser);

    await page.click('.td-sidebar-item[data-tab="alumnos"]');

    await expect(page.locator("#tabAlumnos")).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator("#tabDashboard")).toHaveClass(/\bhidden\b/);

    const rows = page.locator("#alumnosList .av-unified-row");
    await expect(rows).toHaveCount(1);
    await expect(page.locator("#alumnosList .av-cell-name")).toHaveText("Ana García");
    await expect(page.locator("#alumnosList .av-cell-sub")).toContainText("ana@example.com");

    await context.close();
  });

  test("navegar a Grupos y Profesores cambia la sección visible", async ({ browser }) => {
    const { context, page } = await gotoAdmin(browser);

    await page.click('.td-sidebar-item[data-tab="grupos"]');
    await expect(page.locator("#tabGrupos")).not.toHaveClass(/\bhidden\b/);

    await page.click('.td-sidebar-item[data-tab="profesores"]');
    await expect(page.locator("#tabProfesores")).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator("#tabGrupos")).toHaveClass(/\bhidden\b/);

    await context.close();
  });
});
