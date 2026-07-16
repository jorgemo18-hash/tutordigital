// Smoke test de la sección Documentos: el estado de "Normas de la academia"
// (Subir normas vs. Ver normas/Reemplazar) depende de si GET
// /academia/documentos/normas devuelve un documento o 404 — y "Vista
// previa" / "Ver normas" cargan el PDF en la zona de vista previa embebida
// de la propia página (iframe con un blob autenticado), no en una pestaña
// nueva ni como descarga directa (ver documentos/preview/previewPanel.js).
//
// OJO — lo que este archivo NO cubre: ninguno de estos tests ejercita el
// flujo real de subida (clic en "Subir normas"/"Reemplazar" + un archivo).
// page.route("**/api/v1/academia/documentos/normas", ...) mockea la
// respuesta HTTP entera — el body que armaría el frontend nunca llega a
// pasar por la validación/decodificación real del backend, así que un bug
// ahí (como el de la regresión de 6425cc7: el body {base64} no se
// renombraba a {base64Input} antes de llegar a subirNormasConConversion,
// y toda subida fallaba con 400 invalid_base64 en producción pese a que
// estos 6 tests seguían en verde) es invisible aquí. Esa cobertura vive en
// tests/academiaNormasSubida.test.mjs, con un DOCX/PDF real de disco.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

async function gotoDocumentos(browser, { normasStatus = 404, normasBody = null, normasArchivo } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  // Espía URL.revokeObjectURL antes de que cargue ningún script de la
  // página — es la única forma fiable de comprobar "revoca el blob
  // anterior", ya que Playwright no expone el object URL en sí.
  await page.addInitScript(() => {
    window.__revokeCalls = [];
    const original = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
      window.__revokeCalls.push(url);
      return original(url);
    };
  });
  await installApiMocks(page, { roles: ["admin"] });

  await page.route("**/api/v1/academia/documentos/normas", (route) => {
    if (normasStatus === 404) {
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: { message: "not found" } }),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: normasBody }) });
  });

  if (normasArchivo) {
    await page.route("**/api/v1/academia/documentos/normas/archivo", (route) =>
      route.fulfill({ status: 200, contentType: normasArchivo.contentType, body: normasArchivo.body })
    );
  }

  await page.route("**/api/v1/academia/documentos/hoja-inscripcion", (route) =>
    route.fulfill({ status: 200, contentType: "application/pdf", body: Buffer.from("%PDF-1.4 fake") })
  );

  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  await page.click('.ac-sidebar-item[data-section-id="documentos"]');
  await expect(page.locator("h1.ac-title")).toHaveText("Documentos");
  return { context, page };
}

test.describe("academia admin — Documentos", () => {
  test("sin documento de normas subido muestra 'Subir normas', sin 'Ver normas'", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, { normasStatus: 404 });

    const normasCard = page.locator(".ac-doc-card", { hasText: "Normas de la academia" });
    await expect(normasCard.getByRole("button", { name: "Subir normas" })).toBeVisible();
    await expect(normasCard.getByRole("button", { name: "Ver normas" })).toBeHidden();

    await context.close();
  });

  test("con documento de normas ya subido muestra 'Ver normas' + 'Reemplazar'", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, {
      normasStatus: 200,
      normasBody: { mime: "application/pdf", updatedAt: "2026-07-01T00:00:00.000Z" },
    });

    const normasCard = page.locator(".ac-doc-card", { hasText: "Normas de la academia" });
    await expect(normasCard.getByRole("button", { name: "Ver normas" })).toBeVisible();
    await expect(normasCard.getByRole("button", { name: "Reemplazar" })).toBeVisible();

    await context.close();
  });

  test("Vista previa de la hoja de inscripción se abre embebida en la página, sin navegar a otra URL", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, { normasStatus: 404 });
    const urlAntes = page.url();
    const paginasAntes = context.pages().length;

    const hojaCard = page.locator(".ac-doc-card", { hasText: "Hoja de inscripción" });
    await hojaCard.getByRole("button", { name: "Vista previa" }).click();

    const preview = page.locator(".ac-doc-preview");
    await expect(preview).toBeVisible();
    await expect(preview.locator("iframe.ac-doc-preview-frame")).toHaveAttribute("src", /^blob:/);
    await expect(preview.getByRole("button", { name: "Imprimir" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "Descargar" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "Cerrar" })).toBeVisible();

    expect(page.url()).toBe(urlAntes);
    expect(context.pages().length).toBe(paginasAntes);

    await context.close();
  });

  test("cerrar la vista previa la oculta y revoca el object URL del blob", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, { normasStatus: 404 });

    const hojaCard = page.locator(".ac-doc-card", { hasText: "Hoja de inscripción" });
    await hojaCard.getByRole("button", { name: "Vista previa" }).click();

    const preview = page.locator(".ac-doc-preview");
    await expect(preview).toBeVisible();
    const blobUrl = await preview.locator("iframe.ac-doc-preview-frame").getAttribute("src");

    await preview.getByRole("button", { name: "Cerrar" }).click();
    await expect(preview).toBeHidden();

    const revokeCalls = await page.evaluate(() => window.__revokeCalls);
    expect(revokeCalls).toContain(blobUrl);

    await context.close();
  });

  test("abrir un segundo documento revoca el blob del anterior (solo una preview a la vez)", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, {
      normasStatus: 200,
      normasBody: { mime: "application/pdf", updatedAt: "2026-07-01T00:00:00.000Z" },
      normasArchivo: { contentType: "application/pdf", body: Buffer.from("%PDF-1.4 normas") },
    });

    const hojaCard = page.locator(".ac-doc-card", { hasText: "Hoja de inscripción" });
    const normasCard = page.locator(".ac-doc-card", { hasText: "Normas de la academia" });
    const preview = page.locator(".ac-doc-preview");

    await hojaCard.getByRole("button", { name: "Vista previa" }).click();
    await expect(preview.getByText("Hoja de inscripción")).toBeVisible();
    const primerBlobUrl = await preview.locator("iframe.ac-doc-preview-frame").getAttribute("src");

    await normasCard.getByRole("button", { name: "Ver normas" }).click();
    await expect(preview.locator(".ac-doc-preview-title")).toHaveText("Normas de la academia");

    const revokeCalls = await page.evaluate(() => window.__revokeCalls);
    expect(revokeCalls).toContain(primerBlobUrl);

    await context.close();
  });

  test("normas en DOCX (documento legado) muestra el aviso de formato no previsualizable, con descarga", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, {
      normasStatus: 200,
      normasBody: { mime: DOCX_MIME, updatedAt: "2026-01-01T00:00:00.000Z" },
      normasArchivo: { contentType: DOCX_MIME, body: Buffer.from("fake docx bytes") },
    });

    const normasCard = page.locator(".ac-doc-card", { hasText: "Normas de la academia" });
    await normasCard.getByRole("button", { name: "Ver normas" }).click();

    const preview = page.locator(".ac-doc-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByText(/formato Word y no puede previsualizarse/)).toBeVisible();
    await expect(preview.getByRole("button", { name: "Descargar" })).toBeVisible();
    await expect(preview.getByRole("button", { name: "Imprimir" })).toBeHidden();
    await expect(preview.locator("iframe")).toHaveCount(0);

    await context.close();
  });
});
