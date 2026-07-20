// Tres flujos nuevos del drawer de alumno (panel academia-admin):
//  1. Aviso no bloqueante al archivar, si la familia conserva descuentos.
//  2. Cambio de familia con confirmación explícita origen/destino.
//  3. Bloque "Familia — foto económica" con datos reales.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const FAMILIA_A = { id: "f1", nombre: "Familia García" };
const FAMILIA_B = { id: "f2", nombre: "Familia López" };
const ALUMNO_LISTA = { id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso", familia: FAMILIA_A };
const ALUMNO_COMPLETO = {
  id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso", activo: true,
  fecha_alta: "2026-01-10", familia: FAMILIA_A, tarifa: null, horario: [],
};

async function gotoAcademiaAdminConAlumno(browser, rutasExtra = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/academia/alumnos*": { data: { alumnos: [ALUMNO_LISTA], total: 1, page: 1, pageSize: 30 } },
      "**/api/v1/academia/familias/f1/economico": { data: { familia: FAMILIA_A, alumnos: [], totalBruto: 0, totalDescuento: 0, totalNeto: 0, mes: 6, anio: 2026 } },
      ...rutasExtra,
      // Más específico que el catch-all de arriba — va al final para ganar.
      "**/api/v1/academia/alumnos/a1": { data: { alumno: ALUMNO_COMPLETO } },
    },
  });
  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  await page.click(".ac-list .ac-list-row");
  await expect(page.locator(".ac-drawer-overlay.open .ac-drawer-title")).toHaveText("Editar alumno");
  return { context, page };
}

test.describe("academia admin — drawer de alumno: aviso al archivar", () => {
  test("familia con UN hermano activo con descuento -> toast singular, nombrándolo explícitamente", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/alumnos/a1/archivar": {
        data: { archived: true, id: "a1", hermanosConDescuento: [{ id: "a2", nombre: "Luis", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }] }] },
      },
    });

    await page.click('.ac-drawer-foot button:has-text("Archivar")');
    await page.click('.ac-drawer-foot button:has-text("Sí, archivar")');

    await expect(page.locator("#acToast")).toHaveClass(/ac-toast--visible/);
    await expect(page.locator("#acToast")).toContainText('La familia queda con un solo alumno activo (Luis) que conserva "Hermanos 15%"');

    await context.close();
  });

  test("familia con VARIOS hermanos activos con descuento -> toast plural, listando a cada uno", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/alumnos/a1/archivar": {
        data: {
          archived: true, id: "a1",
          hermanosConDescuento: [
            { id: "a2", nombre: "Luis", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }] },
            { id: "a3", nombre: "Marta", descuentos: [{ concepto: "Hermanos", porcentaje: 15 }] },
          ],
        },
      },
    });

    await page.click('.ac-drawer-foot button:has-text("Archivar")');
    await page.click('.ac-drawer-foot button:has-text("Sí, archivar")');

    await expect(page.locator("#acToast")).toHaveClass(/ac-toast--visible/);
    await expect(page.locator("#acToast")).toContainText("La familia queda con 2 alumno(s) activo(s) con descuentos asignados: Luis — Hermanos 15%; Marta — Hermanos 15%");

    await context.close();
  });

  test("sin hermanos con descuento asignado -> archiva sin mostrar ningún toast", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/alumnos/a1/archivar": { data: { archived: true, id: "a1", hermanosConDescuento: [] } },
    });

    await page.click('.ac-drawer-foot button:has-text("Archivar")');
    await page.click('.ac-drawer-foot button:has-text("Sí, archivar")');

    await page.waitForTimeout(300);
    await expect(page.locator("#acToast")).toHaveCount(0);

    await context.close();
  });
});

test.describe("academia admin — drawer de alumno: cambio de familia", () => {
  test("elegir otra familia pide confirmación nombrando origen y destino, y actualiza tras aceptar", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/familias": { data: { familias: [FAMILIA_A, FAMILIA_B] } },
      "**/api/v1/academia/familias/f2/economico": { data: { familia: FAMILIA_B, alumnos: [], totalBruto: 0, totalDescuento: 0, totalNeto: 0, mes: 6, anio: 2026 } },
    });

    let dialogMessage = null;
    page.once("dialog", (dialog) => {
      dialogMessage = dialog.message();
      dialog.accept();
    });

    await page.click('.ac-familia-acciones button:has-text("Cambiar familia")');
    await page.click(".ac-familia-buscador-row-nombre:has-text(\"Familia López\")");

    await expect.poll(() => dialogMessage).toContain('Familia García');
    expect(dialogMessage).toContain("Familia López");
    expect(dialogMessage).toContain("recibos ya emitidos no se ven afectados");

    await expect(page.locator(".ac-familia-existente-name")).toHaveText("Familia López");

    await context.close();
  });

  test("cancelar la confirmación deja la familia original sin cambios", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/familias": { data: { familias: [FAMILIA_A, FAMILIA_B] } },
    });

    page.once("dialog", (dialog) => dialog.dismiss());

    await page.click('.ac-familia-acciones button:has-text("Cambiar familia")');
    await page.click(".ac-familia-buscador-row-nombre:has-text(\"Familia López\")");

    await page.waitForTimeout(300);
    await expect(page.locator(".ac-familia-existente-name")).toHaveText("Familia García");

    await context.close();
  });
});

test.describe("academia admin — drawer de alumno: foto económica familiar", () => {
  test("muestra tarifa, descuentos con porcentaje y el total mensual estimado por alumno real", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/familias/f1/economico": {
        data: {
          familia: FAMILIA_A,
          alumnos: [
            { id: "a1", nombre: "Ana García", tarifa: { precio_bruto: 75, precio_neto: 67.5 }, descuentos: [{ concepto: "primer mes", porcentaje: 20, importe: 15 }], subtotalNeto: 60 },
            { id: "a2", nombre: "Luis García", tarifa: { precio_bruto: 45, precio_neto: 40.5 }, descuentos: [], subtotalNeto: 45 },
          ],
          totalBruto: 120, totalDescuento: 15, totalNeto: 105, mes: 6, anio: 2026,
        },
      },
    });

    const bloque = page.locator(".ac-drawer .ac-section-title:has-text(\"FAMILIA — FOTO ECONÓMICA\")").locator("..");
    await expect(bloque).toContainText("estimado");

    const filas = bloque.locator(".ac-econ-fila");
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText("Ana García");
    await expect(filas.nth(0)).toContainText("primer mes (-20.00%)");
    await expect(filas.nth(0)).toContainText("-15.00 €");
    await expect(filas.nth(1)).toContainText("Luis García");

    await expect(page.locator(".ac-econ-total")).toContainText("105.00 €");

    await context.close();
  });

  test("alumno sin familia asignada -> mensaje informativo, sin llamar al backend", async ({ browser }) => {
    const context = await browser.newContext();
    await forceTheme(context, "dark");
    await forceFakeSession(context);
    const page = await context.newPage();
    const alumnoSinFamilia = { ...ALUMNO_COMPLETO, familia: null };
    let economicoLlamado = false;
    await installApiMocks(page, {
      roles: ["admin"],
      routes: {
        "**/api/v1/academia/alumnos*": { data: { alumnos: [{ ...ALUMNO_LISTA, familia: null }], total: 1, page: 1, pageSize: 30 } },
        "**/api/v1/academia/alumnos/a1": { data: { alumno: alumnoSinFamilia } },
      },
    });
    await page.route("**/api/v1/academia/familias/*/economico", (route) => { economicoLlamado = true; route.fulfill({ status: 200, body: "{}" }); });

    await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
    await page.click(".ac-list .ac-list-row");
    await expect(page.locator(".ac-drawer-overlay.open .ac-drawer-title")).toHaveText("Editar alumno");

    await expect(page.locator(".ac-drawer-overlay.open .ac-drawer")).toContainText("todavía no tiene familia asignada");
    expect(economicoLlamado).toBe(false);

    await context.close();
  });
});

test.describe("academia admin — drawer de alumno: descuentos recurrentes", () => {
  test("marcar un descuento repinta la foto económica sin recargar la página (vuelve a pedirla al backend)", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/alumnos/a1/descuentos": { data: { descuentos: [{ id: "dt1", concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", asignado: false, activo: false }] } },
      "**/api/v1/academia/familias/f1/economico": {
        data: {
          familia: FAMILIA_A,
          alumnos: [{ id: "a1", nombre: "Ana García", tarifa: { precio_bruto: 100, precio_neto: 100 }, descuentos: [], subtotalNeto: 100 }],
          totalBruto: 100, totalDescuento: 0, totalNeto: 100, mes: 6, anio: 2026,
        },
      },
    });

    const bloqueEconomico = page.locator(".ac-drawer-overlay.open .ac-section-title:has-text(\"FAMILIA — FOTO ECONÓMICA\")").locator("..");
    await expect(bloqueEconomico.locator(".ac-econ-total")).toContainText("100.00 €");

    // Tras marcar, la foto económica debe volver a pedirse al backend (motor
    // único) — se sobreescribe la respuesta simulando que el backend ya
    // aplicó el descuento, y se comprueba que el bloque lo refleja sin
    // ningún page.reload()/page.goto() de por medio.
    let economicoRellamado = false;
    await page.route("**/api/v1/academia/familias/f1/economico", (route) => {
      economicoRellamado = true;
      route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          data: {
            familia: FAMILIA_A,
            alumnos: [{ id: "a1", nombre: "Ana García", tarifa: { precio_bruto: 100, precio_neto: 100 }, descuentos: [{ concepto: "Hermanos", porcentaje: 15, importe: 15 }], subtotalNeto: 85 }],
            totalBruto: 100, totalDescuento: 15, totalNeto: 85, mes: 6, anio: 2026,
          },
        }),
      });
    });

    const seccionDescuentos = page.locator(".ac-drawer-overlay.open .ac-section-title:has-text(\"DESCUENTOS RECURRENTES\")").locator("..");
    await seccionDescuentos.locator('input[type="checkbox"]').check();

    await expect(bloqueEconomico.locator(".ac-econ-total")).toContainText("85.00 €");
    expect(economicoRellamado).toBe(true); // sin reload — la misma page sigue viva y volvió a pedir el dato

    await context.close();
  });

  test("marcar un descuento con hermanos activos ofrece propagar, nombrándolos; aceptar lo asigna a todos", async ({ browser }) => {
    const { context, page } = await gotoAcademiaAdminConAlumno(browser, {
      "**/api/v1/academia/alumnos/a1/descuentos": { data: { descuentos: [{ id: "dt1", concepto: "Hermanos", porcentaje: 15, acumulable: true, intervalo: "siempre", asignado: false, activo: false }] } },
      "**/api/v1/academia/familias/f1/economico": {
        data: { familia: FAMILIA_A, alumnos: [{ id: "a1", nombre: "Ana García" }, { id: "a2", nombre: "Luis García" }], totalBruto: 0, totalDescuento: 0, totalNeto: 0, mes: 6, anio: 2026 },
      },
    });

    const putCalls = [];
    await page.route("**/api/v1/academia/alumnos/*/descuentos", (route) => {
      if (route.request().method() === "PUT") putCalls.push({ url: route.request().url(), body: route.request().postDataJSON() });
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { updated: true } }) });
    });

    let dialogMessage = null;
    page.once("dialog", (dialog) => { dialogMessage = dialog.message(); dialog.accept(); });

    const seccionDescuentos = page.locator(".ac-drawer-overlay.open .ac-section-title:has-text(\"DESCUENTOS RECURRENTES\")").locator("..");
    await seccionDescuentos.locator('input[type="checkbox"]').check();
    await expect.poll(() => dialogMessage).toContain('¿Aplicar "Hermanos (15.00%)" también a los otros 1 alumnos de la familia? (Luis García)');

    await expect.poll(() => putCalls.length).toBe(2);
    const idsActualizados = putCalls.map((c) => c.url.match(/alumnos\/([^/]+)\/descuentos/)[1]).sort();
    expect(idsActualizados).toEqual(["a1", "a2"]);

    await context.close();
  });
});
