// Punto de entrada "Importar lista" desde la pestaña Alumnos (nivel
// superior), junto a "+ Invitar alumno" — mismo patrón que ese botón:
// selector de grupo (curso → vía) y, tras elegir grupo, el flujo de import
// existente con su pantalla de revisión. No hace falta navegar a Grupos →
// grupo para nada de este camino.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const GROUP = { id: "g1", name: "1º ESO A", stage: "eso", year: 1, track: "A" };

const PREVIEW_RESPONSE = {
  data: {
    rows: [
      { name: "Marta Ruiz Soler", email: "marta.ruiz@example.com", status: "listo", reason: null, selectable: true },
      { name: "Sin Email", email: null, status: "email_invalido", reason: "Email no válido", selectable: false },
    ],
  },
};

async function gotoAlumnos(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/admin/groups": { data: { items: [GROUP] } },
      "**/api/v1/admin/students/unified": { data: { items: [], groups: [GROUP], total: 0 } },
    },
  });
  await page.goto("/assets/admin/index.html", { waitUntil: "networkidle" });
  await page.click('.td-sidebar-item[data-tab="alumnos"]');
  return { context, page };
}

test.describe("admin instituto — importar lista desde Alumnos", () => {
  test("Alumnos → Importar lista → elegir grupo (curso → vía) → revisar → confirmar", async ({ browser }) => {
    const { context, page } = await gotoAlumnos(browser);

    await page.click("#showImportStudentBtn");
    await expect(page.locator("#importStudentPanel")).not.toHaveClass(/\bhidden\b/);

    // El formulario de archivo no aparece hasta elegir un grupo.
    await expect(page.locator("#alumnosImportForm")).toHaveClass(/\bhidden\b/);

    await page.click("#alumnosImportGroupPicker [data-open-picker]");
    await page.click("#alumnosImportGroupPicker [data-pick-course]");
    await page.click("#alumnosImportGroupPicker [data-pick-via]");

    await expect(page.locator("#alumnosImportGroupPicker")).toContainText("1º ESO A");
    await expect(page.locator("#alumnosImportForm")).not.toHaveClass(/\bhidden\b/);

    await page.route("**/api/v1/admin/groups/g1/students/import/preview", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PREVIEW_RESPONSE) })
    );

    const csvPath = new URL("../../fixtures/import-alumnos.csv", import.meta.url).pathname;
    await page.setInputFiles("#alumnosImportFileInput", csvPath);
    await expect(page.locator("#alumnosImportReview")).not.toHaveClass(/\bhidden\b/);

    const rows = page.locator("#alumnosImportReviewTable .av-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0).locator('input[type="checkbox"]')).toBeChecked();
    await expect(rows.nth(1).locator('input[type="checkbox"]')).toBeDisabled();
    await expect(page.locator("#alumnosImportConfirmBtn")).toHaveText("Invitar a los 1 seleccionados");

    let confirmedGroupId = null;
    await page.route("**/api/v1/admin/groups/g1/students/import", (route) => {
      confirmedGroupId = "g1";
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: { invited: 1, skipped: 0, total_submitted: 1 } }),
      });
    });

    await page.click("#alumnosImportConfirmBtn");
    await expect(page.locator("#alumnosImportResult")).toContainText("1 invitado(s), 0 omitido(s) de 1");
    expect(confirmedGroupId).toBe("g1");

    await context.close();
  });

  test("abrir 'Importar lista' cierra '+ Invitar alumno' si estaba abierto, y viceversa", async ({ browser }) => {
    const { context, page } = await gotoAlumnos(browser);

    await page.click("#showInviteStudentBtn");
    await expect(page.locator("#inviteStudentPanel")).not.toHaveClass(/\bhidden\b/);

    await page.click("#showImportStudentBtn");
    await expect(page.locator("#importStudentPanel")).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator("#inviteStudentPanel")).toHaveClass(/\bhidden\b/);

    await page.click("#showInviteStudentBtn");
    await expect(page.locator("#inviteStudentPanel")).not.toHaveClass(/\bhidden\b/);
    await expect(page.locator("#importStudentPanel")).toHaveClass(/\bhidden\b/);

    await context.close();
  });
});
