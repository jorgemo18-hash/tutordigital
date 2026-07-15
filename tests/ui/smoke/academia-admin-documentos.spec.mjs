// Smoke test de la sección Documentos: el estado de "Normas de la academia"
// (Subir normas vs. Ver normas/Reemplazar) depende de si GET
// /academia/documentos/normas devuelve un documento o 404 — y "Vista
// previa" de la hoja de inscripción debe abrir el PDF en una pestaña
// nueva (window.open sobre un blob, ver documentos/hojaInscripcionCard.js).
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

async function gotoDocumentos(browser, { normasStatus = 404, normasBody = null } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
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
      normasBody: { url: "https://fake.local/signed", mime: "application/pdf", updatedAt: "2026-07-01T00:00:00.000Z" },
    });

    const normasCard = page.locator(".ac-doc-card", { hasText: "Normas de la academia" });
    await expect(normasCard.getByRole("button", { name: "Ver normas" })).toBeVisible();
    await expect(normasCard.getByRole("button", { name: "Reemplazar" })).toBeVisible();

    await context.close();
  });

  test("'Ver normas' abre la URL firmada en una pestaña nueva, sin descargarla", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, {
      normasStatus: 200,
      normasBody: { url: "https://fake.local/signed", mime: "application/pdf", updatedAt: "2026-07-01T00:00:00.000Z" },
    });
    // Storage sirve el PDF con Content-Disposition: inline (comportamiento
    // real de Supabase cuando la URL firmada no pide download) — si el
    // botón "abriera" en vez de "navegara", esta ruta cross-origin nunca
    // se llamaría.
    await context.route("https://fake.local/signed", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "inline" },
        body: Buffer.from("%PDF-1.4 fake"),
      })
    );

    // Mismo motivo que en el test de "Vista previa": Chrome headless trata
    // cualquier navegación a un application/pdf como una descarga aunque
    // el header diga inline, así que la señal fiable es el evento de
    // descarga, no un "load" de página normal (ver ERR_ABORTED si se usa
    // waitForURL aquí).
    const normasCard = page.locator(".ac-doc-card", { hasText: "Normas de la academia" });
    const [download] = await Promise.all([
      context.waitForEvent("download"),
      context.waitForEvent("page"),
      normasCard.getByRole("button", { name: "Ver normas" }).click(),
    ]);
    expect(download.url()).toBe("https://fake.local/signed");

    await context.close();
  });

  test("Vista previa de la hoja de inscripción abre el PDF en una pestaña nueva", async ({ browser }) => {
    const { context, page } = await gotoDocumentos(browser, { normasStatus: 404 });

    // La pestaña se abre en blanco de forma síncrona (para no disparar el
    // bloqueador de pop-ups de Chrome) y navega al blob del PDF una vez
    // resuelve la descarga. Chrome headless trata esa navegación
    // application/pdf como una descarga (no como una carga de página
    // normal, que dejaría popup.url() en blob: de forma estable) — la
    // señal fiable de que la navegación ocurrió es el evento de descarga.
    const hojaCard = page.locator(".ac-doc-card", { hasText: "Hoja de inscripción" });
    const [download] = await Promise.all([
      context.waitForEvent("download"),
      context.waitForEvent("page"),
      hojaCard.getByRole("button", { name: "Vista previa" }).click(),
    ]);
    expect(download.url()).toMatch(/^blob:/);

    await context.close();
  });
});
