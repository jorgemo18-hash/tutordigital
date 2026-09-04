// Smoke test de Ajustes › Precios: la tabla de precios pública (la que se
// imprime en la hoja para familias) carga lo guardado, crece con los dos
// "+" y manda por PUT /academia/config lo que hay en pantalla.
//
// Lo que este archivo cubre y los tests de unidad no: el CABLEADO. El
// modelo (ids, precios huérfanos, topes) ya está probado a fondo en
// tests/academiaPrecios/preciosPublicos.test.mjs; aquí se comprueba que la
// pestaña existe, que los inputs pintan lo que hay y que al guardar sale
// del navegador exactamente eso — que es donde se rompen estas pantallas.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const PRECIOS = {
  columnas: [{ id: "c1", titulo: "Primaria" }, { id: "c2", titulo: "ESO" }],
  filas: [{ id: "f1", titulo: "1 día / semana" }, { id: "f2", titulo: "2 días / semana" }],
  precios: { "f1|c1": "40 €", "f1|c2": "45 €", "f2|c1": "60 €", "f2|c2": "65 €" },
  nota: "Matrícula gratuita",
};

// La tabla vive en Ajustes › "Información para familias", junto a los
// cursos por hora: las dos cosas se imprimen juntas en la misma cuartilla.
async function gotoPreciosTab(browser, { precios = PRECIOS } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: { "**/api/v1/academia/config": { data: { config: { precios_publicos: precios } } } },
  });

  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  await page.click('.ac-sidebar-item[data-section-id="ajustes"]');
  await page.locator(".ac-tabs").getByRole("button", { name: "Información para familias" }).click();
  await expect(page.locator(".ac-panel-title", { hasText: "Precios" })).toBeVisible();
  return { context, page };
}

// Captura el cuerpo del PUT de guardado. Se instala DESPUÉS de la carga
// para no interferir con el GET inicial de la config.
async function capturarGuardado(page) {
  const enviado = [];
  await page.route("**/api/v1/academia/config", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    enviado.push(JSON.parse(route.request().postData() || "{}"));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { config: {} } }) });
  });
  return enviado;
}

test.describe("academia admin — Ajustes › Precios", () => {
  test("la tabla pinta los precios guardados en su casilla", async ({ browser }) => {
    const { context, page } = await gotoPreciosTab(browser);
    const celdas = page.locator(".ac-precio-celda");
    await expect(celdas).toHaveCount(4);
    await expect(celdas.nth(0)).toHaveValue("40 €");
    await expect(celdas.nth(3)).toHaveValue("65 €");
    await expect(page.locator(".ac-precio-titulo").first()).toHaveValue("Primaria");
    await context.close();
  });

  test("el '+' de columna añade una columna a toda la tabla, no solo un encabezado", async ({ browser }) => {
    const { context, page } = await gotoPreciosTab(browser);
    await page.locator(".ac-precio-add.col").click();
    // 2 filas x 3 columnas: si solo se añadiera el encabezado, seguirían
    // siendo 4 casillas y la columna nueva no se podría rellenar.
    await expect(page.locator(".ac-precio-celda")).toHaveCount(6);
    await context.close();
  });

  test("el '+' de fila añade una fila con sus casillas vacías", async ({ browser }) => {
    const { context, page } = await gotoPreciosTab(browser);
    await page.locator(".ac-precio-add.fila").click();
    await expect(page.locator(".ac-precio-celda")).toHaveCount(6);
    await expect(page.locator(".ac-precio-celda").nth(4)).toHaveValue("");
    await context.close();
  });

  test("REGRESIÓN: borrar la primera fila deja los precios de la segunda donde estaban", async ({ browser }) => {
    // El fallo que esto vigila no da error: con los precios por posición,
    // los 60/65 de "2 días" subirían a la fila de "1 día" y la hoja
    // impresa diría que un día cuesta lo de dos.
    const { context, page } = await gotoPreciosTab(browser);
    await page.locator(".ac-precio-th.fila .ac-precio-quitar").first().click();

    const celdas = page.locator(".ac-precio-celda");
    await expect(celdas).toHaveCount(2);
    await expect(celdas.nth(0)).toHaveValue("60 €");
    await expect(celdas.nth(1)).toHaveValue("65 €");
    await context.close();
  });

  test("Guardar manda por PUT la tabla que hay en pantalla", async ({ browser }) => {
    const { context, page } = await gotoPreciosTab(browser);
    const enviado = await capturarGuardado(page);

    await page.locator(".ac-precio-celda").first().fill("42 €");
    const panel = page.locator(".ac-panel", { has: page.locator(".ac-precios") });
    await panel.getByRole("button", { name: "Guardar" }).click();
    await expect(panel.locator(".ac-foot-hint")).toHaveText("✓ Guardado");

    expect(enviado).toHaveLength(1);
    expect(enviado[0].precios_publicos.precios["f1|c1"]).toBe("42 €");
    expect(enviado[0].precios_publicos.nota).toBe("Matrícula gratuita");
    await context.close();
  });

  test("un centro sin precios guardados ve la tabla de ejemplo con las casillas VACÍAS", async ({ browser }) => {
    // Un precio de ejemplo acabaría impreso tal cual en un papel que se le
    // entrega a una familia.
    const { context, page } = await gotoPreciosTab(browser, { precios: null });
    await expect(page.locator(".ac-precio-titulo").first()).toHaveValue("Primaria");
    const celdas = page.locator(".ac-precio-celda");
    await expect(celdas).toHaveCount(9);
    for (let i = 0; i < 9; i++) await expect(celdas.nth(i)).toHaveValue("");
    await context.close();
  });
});
