// Smoke test de Ajustes › Inscripción: los toggles de "Campos de la hoja"
// reflejan la config recibida, el maestro de un bloque deshabilita sus
// campos, Guardar manda el objeto completo por PUT /academia/config, y el
// editor de texto (bloque B) carga/guarda el texto de protección de datos.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const INSCRIPCION_CONFIG = {
  alumno: { fecha_nacimiento: false, dni: false, curso: true, email: true, telefono: false },
  familia: {
    activo: true,
    nombre_tutor: true,
    apellidos: true,
    dni: true,
    direccion: true,
    codigo_postal: true,
    telefono: true,
    email: true,
  },
  metodo_pago: { activo: true, domiciliado: true, transferencia: true, bizum: true, efectivo: true },
  preferencia_cobro: { activo: true },
  autorizaciones: { activo: false, salida_sin_acompanante: false },
};

async function gotoInscripcionTab(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: {
      "**/api/v1/academia/config": { data: { config: { inscripcion_config: INSCRIPCION_CONFIG } } },
      "**/api/v1/academia/documentos/inscripcion-texto": { data: { contenido: "Texto legal existente." } },
    },
  });

  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  await page.click('.ac-sidebar-item[data-section-id="ajustes"]');
  await page.getByRole("button", { name: "Inscripción" }).click();
  await expect(page.locator(".ac-panel-title", { hasText: "Campos de la hoja" })).toBeVisible();
  return { context, page };
}

test.describe("academia admin — Ajustes › Inscripción", () => {
  test("los toggles reflejan la config recibida", async ({ browser }) => {
    const { context, page } = await gotoInscripcionTab(browser);

    const camposPanel = page.locator(".ac-panel", { hasText: "Campos de la hoja" });
    await expect(camposPanel.getByLabel("DNI del alumno")).not.toBeChecked();
    await expect(camposPanel.getByLabel("Curso / nivel")).toBeChecked();
    await expect(camposPanel.getByLabel("Email del alumno")).toBeChecked();

    const autorizacionesBloque = camposPanel.locator(".ac-inscripcion-bloque", { hasText: "Autorizaciones" });
    await expect(autorizacionesBloque.getByLabel("Incluir bloque")).not.toBeChecked();
    await expect(autorizacionesBloque.getByLabel("Salida del centro sin acompañante")).toBeDisabled();

    await context.close();
  });

  test("apagar el maestro de un bloque deshabilita sus campos", async ({ browser }) => {
    const { context, page } = await gotoInscripcionTab(browser);

    const familiaBloque = page.locator(".ac-inscripcion-bloque", { hasText: "Datos familia / tutor" });
    const dniFamilia = familiaBloque.getByLabel("DNI", { exact: true });
    await expect(dniFamilia).toBeEnabled();

    await familiaBloque.getByLabel("Incluir bloque").click();
    await expect(dniFamilia).toBeDisabled();

    await context.close();
  });

  test("Guardar en 'Campos de la hoja' manda el objeto completo por PUT", async ({ browser }) => {
    const { context, page } = await gotoInscripcionTab(browser);

    let cuerpoEnviado = null;
    await page.route("**/api/v1/academia/config", (route) => {
      if (route.request().method() === "PUT") {
        cuerpoEnviado = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ data: { config: { inscripcion_config: cuerpoEnviado.inscripcion_config } } }),
        });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { config: { inscripcion_config: INSCRIPCION_CONFIG } } }) });
    });

    const camposPanel = page.locator(".ac-panel", { hasText: "Campos de la hoja" });
    await camposPanel.getByLabel("DNI del alumno").check();
    await camposPanel.getByRole("button", { name: "Guardar" }).click();
    await expect(camposPanel.locator(".ac-foot-hint")).toHaveText("✓ Guardado");

    expect(cuerpoEnviado.inscripcion_config.alumno.dni).toBe(true);
    expect(cuerpoEnviado.inscripcion_config.alumno.curso).toBe(true);
    expect(cuerpoEnviado.inscripcion_config.familia).toEqual(INSCRIPCION_CONFIG.familia);
    expect(cuerpoEnviado.inscripcion_config.preferencia_cobro).toEqual({ activo: true });

    await context.close();
  });

  test("el editor de texto carga el contenido guardado y permite editarlo/guardarlo", async ({ browser }) => {
    const { context, page } = await gotoInscripcionTab(browser);

    const textoPanel = page.locator(".ac-panel", { hasText: "Protección de datos (cara trasera)" });
    const textarea = textoPanel.locator("textarea");
    await expect(textarea).toHaveValue("Texto legal existente.");

    let cuerpoEnviado = null;
    await page.route("**/api/v1/academia/documentos/inscripcion-texto", (route) => {
      if (route.request().method() !== "PUT") return route.fallback();
      cuerpoEnviado = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { contenido: cuerpoEnviado.contenido } }),
      });
    });

    await textarea.fill("Texto editado a mano.");
    await textoPanel.getByRole("button", { name: "Guardar" }).click();
    await expect(textoPanel.locator(".ac-foot-hint")).toHaveText("✓ Guardado");
    expect(cuerpoEnviado.contenido).toBe("Texto editado a mano.");

    await context.close();
  });
});
