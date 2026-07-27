// Smoke test de superadmin: el dashboard renderiza y la tabla de centros
// lista con datos mock, en el dashboard "Inicio", en la vista "Centros" y
// en "Estadísticas" (estado neutro de Ingresos/Margen — el pricing de
// TutorDigital no está definido todavía, ver estadisticas.js). La API real
// vive en un origen absoluto hardcodeado (runtime-config.js), por eso el
// mock usa el patrón "**/api/v1/..." — Playwright lo intercepta cruzando
// de origen igual.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_TENANTS = [
  { slug: "lyceo", name: "Lyceo Academia", type: "academia", active_students: 42, status: "active", created_at: "2026-01-10T10:00:00Z" },
  { slug: "instituto-demo", name: "Instituto Demo", type: "integrado", active_students: 0, status: "active", created_at: "2026-01-05T10:00:00Z" },
];

async function gotoSuperadmin(browser, { statsData = {} } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    isSuperadmin: true,
    routes: {
      "**/api/v1/superadmin/tenants": { data: { items: MOCK_TENANTS } },
      // Trailing "**" — estadisticas.js llama con ?period=...&tenant_id=...,
      // y el glob sin comodín final no matchea la query string (cae al
      // catch-all {data:{}} de installApiMocks, silencioso y confuso).
      "**/api/v1/superadmin/stats**": { data: statsData },
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

test.describe("superadmin — Estadísticas: Ingresos y Margen en estado neutro", () => {
  test("sin datos de tokens, Ingresos y Margen muestran '—' y 'Pendiente de definir precios'", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser);

    await page.click('.sa-nav-item[data-panel="stats"]');
    await expect(page.locator("#view-stats")).toHaveClass(/\bactive\b/);

    await expect(page.locator("#esIngresos")).toHaveText("—");
    await expect(page.locator("#esMargen")).toHaveText("—");
    await expect(page.locator(".sa-costs-item", { hasText: "Ingresos" }).locator(".sa-costs-sub")).toHaveText("Pendiente de definir precios");
    await expect(page.locator(".sa-costs-item", { hasText: "Margen estimado" }).locator(".sa-costs-sub")).toHaveText("Pendiente de definir precios");

    await context.close();
  });

  test("con tokens/coste reales, Ingresos y Margen siguen en estado neutro (no se calculan a partir del coste)", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser, {
      // Nombres de campo reales de superadmin.stats.routes.js — coste_ia_mes
      // no-null es justo lo que distingue "consumo real" de "sin tracking
      // aún" (ver buildTokenStats).
      statsData: {
        tokens_mes: 500000, tokens_input_mes: 300000, tokens_output_mes: 200000,
        coste_ia_mes: 1.8, coste_ia_mes_usd: 2.05,
        tokens_tracking_desde: "2026-07-01T00:00:00.000Z", tokens_periodo_parcial: false,
        sesiones_mes: 40, unique_students: 12, escalaciones_mes: 3,
      },
    });

    await page.click('.sa-nav-item[data-panel="stats"]');
    await expect(page.locator("#view-stats")).toHaveClass(/\bactive\b/);

    // El coste IA real sí se deriva de los tokens — prueba de que el
    // estado neutro es específico de Ingresos/Margen, no un "sin datos"
    // global de todo el panel.
    await expect(page.locator("#esCostReal")).not.toHaveText("—");
    await expect(page.locator("#esIngresos")).toHaveText("—");
    await expect(page.locator("#esMargen")).toHaveText("—");

    await context.close();
  });

  test("sin tracking de tokens (tokens_tracking_desde null) -> '—' distinto de un 0 real, con nota explícita", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser, {
      statsData: { sesiones_mes: 5, escalaciones_mes: 1, tokens_tracking_desde: null },
    });

    await page.click('.sa-nav-item[data-panel="stats"]');
    await expect(page.locator("#view-stats")).toHaveClass(/\bactive\b/);

    await expect(page.locator("#esKpiTokens")).toHaveText("—");
    await expect(page.locator("#esKpiTokensFoot")).toContainText("sin tracking aún");
    await expect(page.locator("#esKpiCost")).toHaveText("—");

    await context.close();
  });

  test("sesion_libre tiene su propia porción en el donut de modo, no se agrupa en otros", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser, {
      statsData: {
        sesiones_mes: 4, escalaciones_mes: 0, tokens_tracking_desde: null,
        modes: { DEBERES: 1, EXAMEN: 0, TRABAJO: 0, SESION_LIBRE: 3 },
      },
    });

    await page.click('.sa-nav-item[data-panel="stats"]');
    await expect(page.locator("#esMr-SESION_LIBRE")).toHaveText("3/4");
    await expect(page.locator("#esMp-SESION_LIBRE")).toHaveText("75%");
    await expect(page.locator(".sa-legend-name", { hasText: "Sesión libre" })).toBeVisible();

    await context.close();
  });

  test("la sección 'Funciones usadas' ya no existe (sin instrumentación que la alimente)", async ({ browser }) => {
    const { context, page } = await gotoSuperadmin(browser);

    await page.click('.sa-nav-item[data-panel="stats"]');
    await expect(page.locator("#view-stats")).toHaveClass(/\bactive\b/);
    await expect(page.locator(".sa-panel-title", { hasText: "Funciones usadas" })).toHaveCount(0);

    await context.close();
  });
});
