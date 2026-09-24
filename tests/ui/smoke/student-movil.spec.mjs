// Smoke del alumno: la descripción que escribe el profesor se ve.
//
// Antes llegaba al tutor pero no al alumno: en el ordenador #ctxTaskDesc no
// se rellenaba; en el móvil el título lleva una flecha ⌄ y tocarlo no abría
// nada. Ahora el ordenador la enseña bajo el título y el móvil abre la hoja
// "La tarea". La tarea lleva un archivo del profesor para que el móvil entre
// directo al chat (sin archivo pide antes una foto del enunciado).
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const FROZEN_DATE = new Date("2026-07-10T12:00:00");
const DESC = "Haz del 3 al 7 de la página 42.";
const MOCK_TASK = {
  id: "task_123", type: "homework", title: "Ejercicios de álgebra", desc: DESC,
  teacher_notes: "", due_date: "2026-07-10", subject_name: "Matemáticas", estimated_minutes: 20,
  my_status: null, attachments: [{ id: "a1", file_name: "ficha.pdf", mime: "application/pdf", size: 10 }],
};

async function abrirTarea(browser, viewport) {
  const movil = viewport.width < 700;
  const context = await browser.newContext({ viewport, isMobile: movil, hasTouch: movil });
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(FROZEN_DATE);
  await installApiMocks(page, {
    roles: ["student"],
    routes: {
      "**/api/v1/student/status": { data: { student: { id: "stu_1", approval_status: "approved", display_name: "Alumna Test", group_id: "g1" } } },
      "**/api/v1/tasks*": { data: { items: [MOCK_TASK] } },
      "**/api/v1/session/start": { data: { status: "ready", sessionId: null, resumed: true, steps: [], currentStep: 0, exercises: [], messages: [{ role: "assistant", content: "Hola, ¿en qué te ayudo?" }] } },
    },
  });
  await page.goto("/assets/student/index.html", { waitUntil: "networkidle" });
  await page.locator('li[data-card-task-id="task_123"] >> visible=true').first().click();
  await expect(page.locator("#messages .row.a .bubble")).toContainText("Hola, ¿en qué te ayudo?");
  return { context, page };
}

test.describe("alumno — la descripción de la tarea", () => {
  test("en el móvil, tocar el título abre «La tarea» con la descripción", async ({ browser }) => {
    const { context, page } = await abrirTarea(browser, { width: 390, height: 844 });
    await expect(page.locator("#mobileTaskSheet")).toBeHidden();
    await page.click("#mthTitleBtn");
    const hoja = page.locator("#mobileTaskSheet");
    await expect(hoja).toBeVisible();
    await expect(hoja).toContainText(DESC);
    await expect(hoja.locator(".mtd-adjunto")).toHaveText("ficha.pdf");
    const caja = await hoja.boundingBox();
    expect(caja.x).toBeGreaterThanOrEqual(0);
    expect(caja.x + caja.width).toBeLessThanOrEqual(391);
    await page.click("#mobileTaskClose");
    await expect(hoja).toBeHidden();
    await context.close();
  });

  test("en el ordenador, la descripción sale bajo el título", async ({ browser }) => {
    const { context, page } = await abrirTarea(browser, { width: 1280, height: 800 });
    await expect(page.locator("#ctxTaskDesc")).toBeVisible();
    await expect(page.locator("#ctxTaskDesc")).toHaveText(DESC);
    await context.close();
  });
});
