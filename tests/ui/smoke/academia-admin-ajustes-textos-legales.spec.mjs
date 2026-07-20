// Smoke test de Ajustes › Marca y textos › Textos legales: el botón
// "Guardar" de cada fila arranca deshabilitado, se activa al editar
// cualquier campo (contenido, tipo o activo), muestra "✓ Guardado" tras un
// guardado con éxito, y el cambio persiste tras recargar la página (se
// guarda de verdad en el backend, no solo en memoria).
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const TEXTO_INICIAL = {
  id: "tl1",
  tenant_id: "t1",
  etiqueta: "LOPD",
  tipo: "email",
  contenido: "Texto LOPD original.",
  activo: true,
};

async function gotoTextosLegales(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, { roles: ["admin"] });

  let textos = [{ ...TEXTO_INICIAL }];
  await page.route("**/api/v1/academia/textos-legales", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { textos } }),
    });
  });
  await page.route("**/api/v1/academia/textos-legales/*", (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const cambios = route.request().postDataJSON();
    textos = textos.map((t) => (t.id === id ? { ...t, ...cambios } : t));
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: { texto: textos.find((t) => t.id === id) } }),
    });
  });

  async function abrirTextosLegales() {
    await page.click('.ac-sidebar-item[data-section-id="ajustes"]');
    await page.getByRole("button", { name: "Marca y textos" }).click();
    await expect(page.locator(".ac-panel-title", { hasText: "Textos legales" })).toBeVisible();
  }

  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  await abrirTextosLegales();
  return { context, page, abrirTextosLegales };
}

test.describe("academia admin — Ajustes › Marca y textos › Textos legales", () => {
  test("editar, guardar y recargar: el botón refleja los cambios sin guardar y el texto persiste", async ({ browser }) => {
    const { context, page } = await gotoTextosLegales(browser);

    const item = page.locator(".ac-legal-item").first();
    const saveBtn = item.getByRole("button", { name: "Guardar" });
    await expect(saveBtn).toBeDisabled();

    const textarea = item.locator("textarea");
    await expect(textarea).toHaveValue("Texto LOPD original.");
    await textarea.fill("Texto LOPD editado a mano.");
    await expect(saveBtn).toBeEnabled();

    await saveBtn.click();
    await expect(item.locator(".ac-foot-hint")).toHaveText("✓ Guardado");
    await expect(saveBtn).toBeDisabled();

    await page.reload({ waitUntil: "networkidle" });
    await page.click('.ac-sidebar-item[data-section-id="ajustes"]');
    await page.getByRole("button", { name: "Marca y textos" }).click();
    await expect(page.locator(".ac-panel-title", { hasText: "Textos legales" })).toBeVisible();

    const itemTrasReload = page.locator(".ac-legal-item").first();
    await expect(itemTrasReload.locator("textarea")).toHaveValue("Texto LOPD editado a mano.");
    await expect(itemTrasReload.getByRole("button", { name: "Guardar" })).toBeDisabled();

    await context.close();
  });

  test("cambiar solo el tipo (Email/Recibos) o solo 'Activo' también activa 'Guardar'", async ({ browser }) => {
    const { context, page } = await gotoTextosLegales(browser);

    const item = page.locator(".ac-legal-item").first();
    const saveBtn = item.getByRole("button", { name: "Guardar" });
    await expect(saveBtn).toBeDisabled();

    await item.locator("select.ac-legal-tipo-select").selectOption("recibos");
    await expect(saveBtn).toBeEnabled();

    await saveBtn.click();
    await expect(item.locator(".ac-foot-hint")).toHaveText("✓ Guardado");
    await expect(saveBtn).toBeDisabled();

    await item.getByLabel("Activo").uncheck();
    await expect(saveBtn).toBeEnabled();

    await saveBtn.click();
    await expect(item.locator(".ac-foot-hint")).toHaveText("✓ Guardado");
    await expect(saveBtn).toBeDisabled();

    await context.close();
  });
});
