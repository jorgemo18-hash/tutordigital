// Smoke test de Ajustes › Horario › "Cursos por hora": la rejilla de días
// por horas con un desplegable en cada casilla, para reservar una hora a un
// curso (Primaria, ESO, Bachillerato). Lo que se marca aquí sale impreso en
// la hoja para familias.
//
// El modelo (claves por hora, saneado, limpieza de horas que ya no existen)
// está probado en tests/academiaHorario/horarioReservas.test.mjs. Aquí se
// comprueba el cableado: que la rejilla tiene la forma del horario del
// centro y que al guardar sale del navegador la clave correcta.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

// El horario real de Lyceo: cinco clases de una hora, de lunes a viernes.
const CONFIG = {
  franja_inicio: "15:30",
  franja_fin: "20:30",
  franja_duracion: 60,
  dias_laborables: [1, 2, 3, 4, 5],
};

async function gotoCursosPorHora(browser, { config = CONFIG } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["admin"],
    routes: { "**/api/v1/academia/config": { data: { config } } },
  });

  await page.goto("/assets/academia/admin/index.html", { waitUntil: "networkidle" });
  await page.click('.ac-sidebar-item[data-section-id="ajustes"]');
  // Acotado a la barra de pestañas: "Horario" también es una entrada del
  // menú lateral, y sin acotar Playwright encuentra dos botones.
  await page.locator(".ac-tabs").getByRole("button", { name: "Horario", exact: true }).click();
  await expect(page.locator(".ac-panel-title", { hasText: "Cursos por hora" })).toBeVisible();
  return { context, page };
}

async function capturarGuardado(page) {
  const enviado = [];
  await page.route("**/api/v1/academia/config", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    enviado.push(JSON.parse(route.request().postData() || "{}"));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { config: {} } }) });
  });
  return enviado;
}

function rejilla(page) {
  return page.locator(".ac-reservas");
}

test.describe("academia admin — Ajustes › Cursos por hora", () => {
  test("la rejilla tiene una fila por clase del centro y una columna por día laborable", async ({ browser }) => {
    // Cinco clases (15:30 a 20:30, de una hora) y cinco días: 25 casillas.
    // Si fuera por medias horas saldrían diez filas, que es justo lo que se
    // quitó del cuadrante por ilegible.
    const { context, page } = await gotoCursosPorHora(browser);
    await expect(rejilla(page).locator("tbody tr")).toHaveCount(5);
    await expect(rejilla(page).locator(".ac-reserva-hora").first()).toHaveText("15:30 – 16:30");
    await expect(rejilla(page).locator(".ac-reserva-select")).toHaveCount(25);
    await context.close();
  });

  test("solo salen los días laborables del centro", async ({ browser }) => {
    const { context, page } = await gotoCursosPorHora(browser, { config: { ...CONFIG, dias_laborables: [2, 4] } });
    await expect(rejilla(page).locator(".ac-reserva-dia")).toHaveText(["Mar", "Jue"]);
    await expect(rejilla(page).locator(".ac-reserva-select")).toHaveCount(10);
    await context.close();
  });

  test("las horas ya reservadas llegan marcadas en su casilla", async ({ browser }) => {
    const { context, page } = await gotoCursosPorHora(browser, {
      config: { ...CONFIG, horario_reservas: { "1|17:30": "primaria" } },
    });
    // Fila 3 (17:30-18:30), columna 1 (lunes).
    const lunes1730 = rejilla(page).locator("tbody tr").nth(2).locator(".ac-reserva-select").first();
    await expect(lunes1730).toHaveValue("primaria");
    await expect(rejilla(page).locator("tbody tr").nth(0).locator(".ac-reserva-select").first()).toHaveValue("");
    await context.close();
  });

  test("Guardar manda la reserva con la clave día|hora, no con el número de fila", async ({ browser }) => {
    const { context, page } = await gotoCursosPorHora(browser);
    const enviado = await capturarGuardado(page);

    // Miércoles (3ª columna) a las 18:30 (4ª fila) para Bachillerato.
    await rejilla(page).locator("tbody tr").nth(3).locator(".ac-reserva-select").nth(2)
      .selectOption("bachillerato");
    await page.locator(".ac-panel.ancho").getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator(".ac-panel.ancho .ac-foot-hint")).toHaveText("✓ Guardado");

    expect(enviado).toHaveLength(1);
    expect(enviado[0].horario_reservas).toEqual({ "3|18:30": "bachillerato" });
    await context.close();
  });

  test("volver a dejar una hora en '—' la quita del objeto que se guarda", async ({ browser }) => {
    // Guardar "" en vez de borrar dejaría la hoja imprimiéndose como
    // rejilla con las veinticinco casillas diciendo "Todos".
    const { context, page } = await gotoCursosPorHora(browser, {
      config: { ...CONFIG, horario_reservas: { "1|17:30": "primaria" } },
    });
    const enviado = await capturarGuardado(page);

    await rejilla(page).locator("tbody tr").nth(2).locator(".ac-reserva-select").first().selectOption("");
    await page.locator(".ac-panel.ancho").getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator(".ac-panel.ancho .ac-foot-hint")).toHaveText("✓ Guardado");

    expect(enviado[0].horario_reservas).toEqual({});
    await context.close();
  });

  test("una reserva de una hora que el centro ya no abre no se devuelve a la base de datos", async ({ browser }) => {
    // El centro cerró a las 19:30 y quedaba una reserva a las 19:30: no se
    // ve en la rejilla, así que tampoco puede volver a guardarse — si no,
    // se arrastraría para siempre sin forma de verla ni de borrarla.
    const { context, page } = await gotoCursosPorHora(browser, {
      config: { ...CONFIG, franja_fin: "19:30", horario_reservas: { "1|18:30": "eso", "1|19:30": "primaria" } },
    });
    const enviado = await capturarGuardado(page);

    await expect(rejilla(page).locator("tbody tr")).toHaveCount(4);
    await page.locator(".ac-panel.ancho").getByRole("button", { name: "Guardar" }).click();
    await expect(page.locator(".ac-panel.ancho .ac-foot-hint")).toHaveText("✓ Guardado");

    expect(enviado[0].horario_reservas).toEqual({ "1|18:30": "eso" });
    await context.close();
  });
});
