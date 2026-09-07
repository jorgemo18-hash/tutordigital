// Smoke test de academia profesor: carga, el Horario (vista por defecto)
// renderiza una franja mockeada, y el Diario del día renderiza un alumno
// mockeado. fetchMe() aquí solo bloquea si me.role === "student" — "teacher"
// pasa igual que "admin".
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_FRANJA = {
  dia_semana: 1,
  hora_inicio: "09:00",
  alumno: { id: "a1", nombre: "Ana García", curso: "1º ESO", nivel: "eso" },
};
const MOCK_DIARIO_ALUMNO = { nombre: "Bea Pérez", curso: "2º ESO", nivel: "eso" };

// Una tarde con varios alumnos por hora, que es el caso normal de una
// academia: tres a las 17:30 y uno suelto sin horario fijo.
const conHora = (nombre, hora) => ({
  nombre, curso: "1º ESO", nivel: "eso",
  horarios: hora ? [{ hora_inicio: `${hora}:00`, hora_fin: "00:00:00" }] : [],
});
const MOCK_TARDE = [
  conHora("Daniel Esteban", "15:30"), conHora("Alejandra Ferrer", "15:30"),
  conHora("Eric Val", "16:30"),
  conHora("Rakel Trallero", "17:30"), conHora("Antonio Sarvisé", "17:30"), conHora("Noah Muñoz", "17:30"),
  conHora("Sara Extra", null),
];

async function gotoAcademiaProfesor(browser, { alumnos = [MOCK_DIARIO_ALUMNO] } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["teacher"],
    routes: {
      "**/api/v1/academia/horario*": { data: { franjas: [MOCK_FRANJA] } },
      "**/api/v1/academia/sesiones*": { data: { fecha: "2026-01-15", alumnos } },
    },
  });
  await page.goto("/assets/academia/profesor/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("academia profesor — Horario y Diario", () => {
  test("el Horario (vista por defecto) renderiza la franja mockeada", async ({ browser }) => {
    const { context, page } = await gotoAcademiaProfesor(browser);

    const slot = page.locator(".ac-grid .ac-slot");
    await expect(slot).toHaveCount(1);
    // En el cuadrante va el nombre de pila (ver shared/js/nombrePila.js): en
    // una columna de día los apellidos solo consiguen que se corte. El
    // completo se queda en el title, y eso es lo que se comprueba aquí.
    await expect(slot.locator(".ac-slot-name")).toHaveText("Ana");
    await expect(slot.locator(".ac-slot-name")).toHaveAttribute("title", "Ana García");

    await context.close();
  });

  test("el Diario del día renderiza el alumno mockeado", async ({ browser }) => {
    const { context, page } = await gotoAcademiaProfesor(browser);

    await page.getByRole("button", { name: "Diario" }).click();

    const card = page.locator(".ac-diario-list .ac-card");
    await expect(card).toHaveCount(1);
    await expect(card.locator(".ac-card-name")).toContainText("Bea Pérez");

    await context.close();
  });

  test("el Diario separa los tramos horarios con una raya, y ninguna al principio", async ({ browser }) => {
    const { context, page } = await gotoAcademiaProfesor(browser, { alumnos: MOCK_TARDE });
    await page.getByRole("button", { name: "Diario" }).click();

    // 4 tramos (15:30, 16:30, 17:30 y los sin horario) → 3 rayas: van ENTRE
    // grupos. Una cuarta raya significaría una suelta antes del primero, que
    // se lee como el borde de algo que falta arriba.
    await expect(page.locator(".ac-diario-list .ac-card")).toHaveCount(7);
    await expect(page.locator(".ac-diario-list .ac-diario-sep")).toHaveCount(3);

    // Y la raya cae donde cambia la hora, no entre dos alumnos de la misma.
    const hijos = page.locator(".ac-diario-list > *");
    await expect(hijos.nth(2)).toHaveClass(/ac-diario-sep/, "tras los dos de las 15:30");
    await expect(hijos.nth(1)).toHaveClass(/ac-card/, "el segundo de las 15:30 no lleva raya delante");

    await context.close();
  });

  test("un solo alumno en el día no dibuja ninguna raya", async ({ browser }) => {
    const { context, page } = await gotoAcademiaProfesor(browser);
    await page.getByRole("button", { name: "Diario" }).click();
    await expect(page.locator(".ac-diario-list .ac-card")).toHaveCount(1);
    await expect(page.locator(".ac-diario-list .ac-diario-sep")).toHaveCount(0);
    await context.close();
  });
});
