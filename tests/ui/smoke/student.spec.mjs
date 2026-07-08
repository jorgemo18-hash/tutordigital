// Smoke test de student: el chat renderiza mensajes mockeados (al entrar en
// una tarea vía /api/v1/session/start con resumed:true), el composer envía
// (POST /api/v1/chat sync), y la agenda abre/cierra. Tenant "instituto" (no
// "academia") para que el panel arranque en la agenda, con botón propio.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_TASK = {
  id: "task_123",
  type: "homework",
  title: "Ejercicios de álgebra",
  desc: "",
  teacher_notes: "",
  due_date: "2026-07-10",
  subject_name: "Matemáticas",
  estimated_minutes: 20,
  my_status: null,
  attachments: [],
};

async function gotoStudent(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["student"],
    routes: {
      "**/api/v1/student/status": {
        data: { student: { id: "stu_1", approval_status: "approved", display_name: "Alumna Test", group_id: "g1" } },
      },
      "**/api/v1/tasks*": { data: { items: [MOCK_TASK] } },
      "**/api/v1/session/start": {
        data: {
          status: "ready",
          sessionId: null,
          resumed: true,
          steps: [],
          currentStep: 0,
          exercises: [],
          messages: [
            { role: "user", content: "Hola" },
            { role: "assistant", content: "Hola, ¿en qué te ayudo?" },
          ],
        },
      },
      "**/api/v1/chat": { text: "Respuesta mockeada del tutor" },
    },
  });
  await page.goto("/assets/student/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("student — chat, composer y agenda", () => {
  test("la agenda es la vista inicial con la tarea mockeada", async ({ browser }) => {
    const { context, page } = await gotoStudent(browser);

    await expect(page.locator("#agendaView")).not.toHaveClass(/\bv-hidden\b/);
    await expect(page.locator("#chatPanel")).toHaveClass(/\bv-hidden\b/);
    await expect(page.locator('li[data-card-task-id="task_123"]')).toContainText("Ejercicios de álgebra");

    await context.close();
  });

  test("abrir una tarea entra al chat y pinta el historial mockeado", async ({ browser }) => {
    const { context, page } = await gotoStudent(browser);

    await page.click('li[data-card-task-id="task_123"]');

    await expect(page.locator("#chatPanel")).not.toHaveClass(/\bv-hidden\b/);
    await expect(page.locator("#agendaView")).toHaveClass(/\bv-hidden\b/);
    await expect(page.locator("#messages .row.u .bubble")).toContainText("Hola");
    await expect(page.locator("#messages .row.a .bubble")).toContainText("Hola, ¿en qué te ayudo?");

    await context.close();
  });

  test("el composer envía un mensaje y aparece la respuesta mockeada", async ({ browser }) => {
    const { context, page } = await gotoStudent(browser);
    await page.click('li[data-card-task-id="task_123"]');
    await expect(page.locator("#messages .row.a .bubble")).toContainText("Hola, ¿en qué te ayudo?");

    await page.fill("#inp", "¿Cómo resuelvo esta ecuación?");
    await expect(page.locator("#sendIn")).toBeEnabled();
    await page.click("#sendIn");

    await expect(page.locator("#messages .row.u .bubble").last()).toContainText("¿Cómo resuelvo esta ecuación?");
    await expect(page.locator("#messages .row.a .bubble").last()).toContainText("Respuesta mockeada del tutor");

    await context.close();
  });

  test("volver a la agenda desde el chat oculta el chat y muestra la agenda", async ({ browser }) => {
    const { context, page } = await gotoStudent(browser);
    await page.click('li[data-card-task-id="task_123"]');
    await expect(page.locator("#chatPanel")).not.toHaveClass(/\bv-hidden\b/);

    await page.click("#btnSideAgenda");

    await expect(page.locator("#agendaView")).not.toHaveClass(/\bv-hidden\b/);
    await expect(page.locator("#chatPanel")).toHaveClass(/\bv-hidden\b/);

    await context.close();
  });
});
