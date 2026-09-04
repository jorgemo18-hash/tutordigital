// Smoke test de Ajustes › Información para familias › "Cursos por hora":
// la rejilla donde se reservan horas a un curso pintando —se elige un curso
// arriba y se pinchan las horas—, en vez de rellenar veinticinco
// desplegables.
//
// El modelo (claves por hora, varios cursos por hora, limpieza de horas que
// ya no existen) está probado en tests/academiaHorario/horarioReservas.test.mjs.
// Aquí se comprueba el cableado: que la rejilla tiene la forma del horario
// del centro, que pinchar marca, y que al guardar sale del navegador lo que
// se ve en pantalla.
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
  await page.locator(".ac-tabs").getByRole("button", { name: "Información para familias" }).click();
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

function panelCursos(page) {
  return page.locator(".ac-panel", { has: page.locator(".ac-horas") });
}

// La casilla de un día y una hora: fila `fila` (0 = la primera del centro),
// columna `dia` (0 = lunes).
function celda(page, fila, dia) {
  return page.locator(".ac-horas tbody tr").nth(fila).locator(".ac-hora-celda").nth(dia);
}

async function guardar(page) {
  await panelCursos(page).getByRole("button", { name: "Guardar" }).click();
  await expect(panelCursos(page).locator(".ac-foot-hint")).toHaveText("✓ Guardado");
}

test.describe("academia admin — Cursos por hora", () => {
  test("la rejilla tiene una fila por clase del centro y una columna por día laborable", async ({ browser }) => {
    // Cinco clases (15:30 a 20:30, de una hora) y cinco días: 25 casillas.
    // Si fuera por medias horas saldrían diez filas, que es justo lo que se
    // quitó del cuadrante por ilegible.
    const { context, page } = await gotoCursosPorHora(browser);
    await expect(page.locator(".ac-horas tbody tr")).toHaveCount(5);
    await expect(page.locator(".ac-hora-etiqueta").first()).toHaveText("15:30 – 16:30");
    await expect(page.locator(".ac-hora-celda")).toHaveCount(25);
    await context.close();
  });

  test("las casillas empiezan en blanco: sin marcar es 'abierta a cualquier curso'", async ({ browser }) => {
    // En pantalla el blanco se entiende; escribir "Todos" veinticinco veces
    // sería el mismo ruido que se quitó con los desplegables. En el papel
    // impreso sí se escribe, que allí un hueco se lee como "no hay clase".
    const { context, page } = await gotoCursosPorHora(browser);
    await expect(celda(page, 0, 0)).toHaveText("");
    await context.close();
  });

  test("solo salen los días laborables del centro", async ({ browser }) => {
    const { context, page } = await gotoCursosPorHora(browser, { config: { ...CONFIG, dias_laborables: [2, 4] } });
    await expect(page.locator(".ac-hora-dia")).toHaveText(["Mar", "Jue"]);
    await expect(page.locator(".ac-hora-celda")).toHaveCount(10);
    await context.close();
  });

  test("las horas ya reservadas llegan marcadas en su casilla", async ({ browser }) => {
    const { context, page } = await gotoCursosPorHora(browser, {
      config: { ...CONFIG, horario_reservas: { "1|17:30": ["primaria"] } },
    });
    await expect(celda(page, 2, 0)).toHaveText("Primaria");
    await expect(celda(page, 0, 0)).toHaveText("");
    await context.close();
  });

  test("se elige un curso arriba y se pinchan las horas", async ({ browser }) => {
    const { context, page } = await gotoCursosPorHora(browser);
    const enviado = await capturarGuardado(page);

    await page.locator(".ac-pincel-chip", { hasText: "Bachillerato" }).click();
    // Miércoles (3ª columna) a las 18:30 (4ª fila).
    await celda(page, 3, 2).click();
    await expect(celda(page, 3, 2)).toHaveText("Bachillerato");

    await guardar(page);
    expect(enviado[0].horario_reservas).toEqual({ "3|18:30": ["bachillerato"] });
    await context.close();
  });

  test("VARIOS PROFESORES: una misma hora admite dos cursos", async ({ browser }) => {
    // A las 17:30 una profesora lleva Primaria y otro ESO. Con la versión de
    // desplegables había que elegir cuál de las dos mentir.
    const { context, page } = await gotoCursosPorHora(browser);
    const enviado = await capturarGuardado(page);

    await page.locator(".ac-pincel-chip", { hasText: "Primaria" }).click();
    await celda(page, 2, 0).click();
    await page.locator(".ac-pincel-chip", { hasText: "ESO" }).click();
    await celda(page, 2, 0).click();

    await expect(celda(page, 2, 0)).toHaveText("Primaria · ESO");
    await guardar(page);
    expect(enviado[0].horario_reservas).toEqual({ "1|17:30": ["primaria", "eso"] });
    await context.close();
  });

  test("volver a pinchar el mismo curso lo quita y la hora desaparece del guardado", async ({ browser }) => {
    // Dejar una lista vacía en vez de borrar dejaría la hoja imprimiéndose
    // como rejilla con las veinticinco casillas diciendo "Todos".
    const { context, page } = await gotoCursosPorHora(browser, {
      config: { ...CONFIG, horario_reservas: { "1|17:30": ["primaria"] } },
    });
    const enviado = await capturarGuardado(page);

    await page.locator(".ac-pincel-chip", { hasText: "Primaria" }).click();
    await celda(page, 2, 0).click();
    await expect(celda(page, 2, 0)).toHaveText("");

    await guardar(page);
    expect(enviado[0].horario_reservas).toEqual({});
    await context.close();
  });

  test("una reserva de una hora que el centro ya no abre no se devuelve a la base de datos", async ({ browser }) => {
    // El centro cerró a las 19:30 y quedaba una reserva a las 19:30: no se
    // ve en la rejilla, así que tampoco puede volver a guardarse — si no,
    // se arrastraría para siempre sin forma de verla ni de borrarla.
    const { context, page } = await gotoCursosPorHora(browser, {
      config: { ...CONFIG, franja_fin: "19:30", horario_reservas: { "1|18:30": ["eso"], "1|19:30": ["primaria"] } },
    });
    const enviado = await capturarGuardado(page);

    await expect(page.locator(".ac-horas tbody tr")).toHaveCount(4);
    await guardar(page);
    expect(enviado[0].horario_reservas).toEqual({ "1|18:30": ["eso"] });
    await context.close();
  });
});
