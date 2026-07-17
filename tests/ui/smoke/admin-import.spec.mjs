// Flujo completo del import masivo de alumnos (subir -> revisar ->
// confirmar), con archivos .csv y .xlsx REALES desde tests/fixtures/ (vía
// setInputFiles, ejercitando el FileReader/base64 real del navegador). El
// backend sigue mockeado (mismo patrón que el resto de la suite — ver
// playwright.config.mjs: sin backend real), así que la previsualización
// devuelta es la que dicta este test, no el parseo real del servidor (ese
// parseo tiene su propia cobertura exhaustiva en
// tests/studentImportPreview.test.mjs e tests/importReview.test.mjs con los
// mismos archivos).
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSV_FIXTURE = path.join(HERE, "..", "..", "fixtures", "import-alumnos.csv");
const XLSX_FIXTURE = path.join(HERE, "..", "..", "fixtures", "import-alumnos.xlsx");

const GROUP = { id: "g1", name: "1º ESO A", stage: "eso", year: 1, track: "A", student_count: 0 };

const PREVIEW_RESPONSE = {
  data: {
    rows: [
      { name: "Marta Ruiz Soler", email: "marta.ruiz@example.com", status: "listo", reason: null, selectable: true },
      { name: "Carlos Fernández Nuño", email: "carlos.fernandez@example.com", status: "listo", reason: null, selectable: true },
      { name: "Sin Email Apellido", email: null, status: "email_invalido", reason: "Email no válido", selectable: false },
    ],
  },
};

async function gotoGroupAlumnos(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/admin/groups": { data: { items: [GROUP] } },
      "**/api/v1/admin/groups/g1/students": { data: { group: GROUP, items: [] } },
      "**/api/v1/admin/teachers": { data: { items: [] } },
    },
  });
  await page.goto("/assets/admin/index.html", { waitUntil: "networkidle" });
  await page.click('.td-sidebar-item[data-tab="grupos"]');
  await page.click('.av-group-row[data-view-students="g1"]');
  await expect(page.locator("#gruposLevel4Panel")).not.toHaveClass(/\bhidden\b/);
  return { context, page };
}

test.describe("admin instituto — import masivo de alumnos", () => {
  test("subir un .csv real -> revisar -> confirmar solo los seleccionados", async ({ browser }) => {
    const { context, page } = await gotoGroupAlumnos(browser);

    await page.route("**/api/v1/admin/groups/g1/students/import/preview", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PREVIEW_RESPONSE) })
    );

    await page.click("#toggleImportBtn");
    await expect(page.locator("#importForm")).not.toHaveClass(/\bhidden\b/);

    await page.setInputFiles("#importFileInput", CSV_FIXTURE);
    await expect(page.locator("#importReview")).not.toHaveClass(/\bhidden\b/);

    const rows = page.locator("#importReviewTable .av-row");
    await expect(rows).toHaveCount(3);

    // Las 2 filas "Listo" llegan preseleccionadas; la inválida, deshabilitada y sin marcar.
    await expect(rows.nth(0).locator('input[type="checkbox"]')).toBeChecked();
    await expect(rows.nth(1).locator('input[type="checkbox"]')).toBeChecked();
    await expect(rows.nth(2).locator('input[type="checkbox"]')).toBeDisabled();
    await expect(rows.nth(2).locator('input[type="checkbox"]')).not.toBeChecked();

    await expect(page.locator("#importConfirmBtn")).toHaveText("Invitar a los 2 seleccionados");

    // Deseleccionar una fila "Listo" -> el contador baja a 1.
    await rows.nth(1).locator('input[type="checkbox"]').click();
    await expect(page.locator("#importConfirmBtn")).toHaveText("Invitar a los 1 seleccionados");

    let confirmedBody = null;
    await page.route("**/api/v1/admin/groups/g1/students/import", (route) => {
      confirmedBody = route.request().postDataJSON();
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { invited: 1, skipped: 0, total_submitted: 1 } }),
      });
    });

    await page.click("#importConfirmBtn");
    await expect(page.locator("#importResult")).toContainText("1 invitado(s), 0 omitido(s) de 1");

    // Solo se manda la fila que seguía seleccionada (Marta), no la deseleccionada ni la inválida.
    expect(confirmedBody.rows).toHaveLength(1);
    expect(confirmedBody.rows[0].email).toBe("marta.ruiz@example.com");

    // La revisión se limpia tras confirmar — no queda estado intermedio.
    await expect(page.locator("#importReview")).toHaveClass(/\bhidden\b/);

    await context.close();
  });

  test("subir un .xlsx real también dispara la previsualización (mismo flujo que .csv)", async ({ browser }) => {
    const { context, page } = await gotoGroupAlumnos(browser);

    let previewRequestSeen = false;
    await page.route("**/api/v1/admin/groups/g1/students/import/preview", (route) => {
      previewRequestSeen = true;
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PREVIEW_RESPONSE) });
    });

    await page.click("#toggleImportBtn");
    await page.setInputFiles("#importFileInput", XLSX_FIXTURE);
    await expect(page.locator("#importReview")).not.toHaveClass(/\bhidden\b/);
    expect(previewRequestSeen).toBe(true);

    await context.close();
  });

  test("error de previsualización (columnas no reconocidas) se muestra y no deja la revisión abierta", async ({ browser }) => {
    const { context, page } = await gotoGroupAlumnos(browser);

    await page.route("**/api/v1/admin/groups/g1/students/import/preview", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "columns_not_found", message: 'No se encontraron las columnas de nombre y email.' }, requestId: "r1" }),
      })
    );

    await page.click("#toggleImportBtn");
    await page.setInputFiles("#importFileInput", CSV_FIXTURE);

    await expect(page.locator("#importError")).toContainText("columnas de nombre y email");
    await expect(page.locator("#importReview")).toHaveClass(/\bhidden\b/);

    await context.close();
  });
});
