// Smoke test de superadmin: el dashboard renderiza y la tabla de centros
// lista con datos mock, en el dashboard "Inicio" y en la vista "Centros".
// La API real vive en un origen absoluto hardcodeado (runtime-config.js),
// por eso el mock usa el patrón "**/api/v1/..." — Playwright lo intercepta
// cruzando de origen igual.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_TENANTS = [
  { slug: "lyceo", name: "Lyceo Academia", type: "academia", active_students: 42, status: "active", created_at: "2026-01-10T10:00:00Z" },
  { slug: "instituto-demo", name: "Instituto Demo", type: "integrado", active_students: 0, status: "active", created_at: "2026-01-05T10:00:00Z" },
];

async function gotoSuperadmin(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    isSuperadmin: true,
    routes: {
      "**/api/v1/superadmin/tenants": { data: { items: MOCK_TENANTS } },
      "**/api/v1/superadmin/stats": { data: {} },
    },
  });
  await page.goto("/assets/superadmin/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("superadmin — dashboard y tabla de centros", () => {
  test("el dashboard 'Inicio' lista los centros recientes mockeados", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser);

    await expect(page.locator("#view-inicio")).toHaveClass(/\bactive\b/);

    const rows = page.locator("#view-inicio .sa-tbody .sa-trow.sa-trow--centros");
    await expect(rows).toHaveCount(2);
    await expect(page.locator("#view-inicio .sa-centro-name")).toContainText(["Lyceo Academia", "Instituto Demo"]);

    await context.close();
  });

  test("navegar a 'Centros' muestra la tabla completa con los mismos centros", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser);

    await page.click('.sa-nav-item[data-panel="centros"]');

    await expect(page.locator("#view-centros")).toHaveClass(/\bactive\b/);
    await expect(page.locator('.sa-nav-item[data-panel="centros"]')).toHaveClass(/\bactive\b/);

    const rows = page.locator("#centrosTbody .sa-trow.sa-trow--centros-full");
    await expect(rows).toHaveCount(2);

    await context.close();
  });
});
