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

async function gotoAcademiaProfesor(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["teacher"],
    routes: {
      "**/api/v1/academia/horario*": { data: { franjas: [MOCK_FRANJA] } },
      "**/api/v1/academia/sesiones*": { data: { fecha: "2026-01-15", alumnos: [MOCK_DIARIO_ALUMNO] } },
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
});
