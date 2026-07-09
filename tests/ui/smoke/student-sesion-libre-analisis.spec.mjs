// Regresión del bug de producción (2026-07-09): en una sesión libre de
// academia, el alumno entra al tutor ANTES de subir el enunciado — la tarea
// nace sin adjuntos, así que /api/v1/session/start (llamado al entrar)
// devuelve una sesión "muerta" (steps:[], exercises:[]). El backend real ya
// se autocura (sessionLifecycle.js relanza el análisis en cuanto detecta un
// adjunto de enunciado disponible), pero aquí mockeamos el backend, así que
// estos tests cubren el contrato del FRONTEND: (1) subir el enunciado debe
// relanzar la inicialización de sesión sin que el alumno haga nada más, y
// (2) si el estado sigue "muerto" (adjunto ya subido, sin pasos), la
// re-entrada debe ofrecer un "Reintentar" explícito — nunca una pantalla
// muerta sin salida (ver assets/student/controllers/onSessionReady.js).
//
// La entrada se dispara aquí con un click de tarjeta (harness de
// student.spec.mjs), no con el botón "Sesión libre" de academia: desde
// "un solo camino de entrada" (commit d4f6a72) ambos convergen en
// enterTask() -> selectTaskRef -> initSession, así que ejercitan el mismo
// código bajo prueba sin montar el bootstrap completo de tenant academia.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function sessionStartBody(overrides) {
  return { data: { sessionId: "sess_1", currentStep: 0, exercises: [], messages: [], ...overrides } };
}

async function gotoStudentWithTask(browser, { attachments = [] } = {}) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();

  const task = {
    id: "task_sl_1",
    type: "sesion_libre",
    title: "Sesión libre",
    desc: "",
    teacher_notes: "",
    due_date: null,
    subject_name: "",
    estimated_minutes: 0,
    my_status: null,
    attachments,
  };

  await installApiMocks(page, {
    roles: ["student"],
    routes: {
      "**/api/v1/student/status": {
        data: { student: { id: "stu_1", approval_status: "approved", display_name: "Alumna Test", group_id: null } },
      },
      "**/api/v1/tasks*": { data: { items: [task] } },
      "**/api/v1/chat": { text: "Respuesta mockeada del tutor" },
    },
  });

  await page.goto("/assets/student/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("sesión libre — el análisis nunca se queda muerto", () => {
  test("subir el enunciado relanza el análisis automáticamente (sesión creada antes del adjunto)", async ({ browser }) => {
    const { context, page } = await gotoStudentWithTask(browser, { attachments: [] });

    let startCalls = 0;
    await page.route("**/api/v1/session/start", (route) => {
      startCalls += 1;
      const body =
        startCalls === 1
          ? sessionStartBody({ status: "ready", resumed: true, steps: [] })
          : sessionStartBody({
              status: "ready",
              resumed: false,
              steps: [{ index: 0, title: "Paso 1", completed: false }],
              exercises: [{ index: 1, title: "Ejercicio 1" }],
              guideOk: true,
            });
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.route("**/api/v1/attachments", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { id: "att_1", file_name: "enunciado.png", mime: "image/png" } }),
      });
    });

    await page.click('li[data-card-task-id="task_sl_1"]');

    // Estado inicial: sesión creada sin adjunto -> placeholder neutro, sin pasos
    await expect(page.locator(".ctx-sub-steps-placeholder")).toBeVisible();
    await expect(page.locator(".ctx-sub-steps-placeholder")).toHaveText("Los pasos aparecerán aquí");
    await expect(page.locator("#ctxSubSteps .step-map-panel")).toHaveCount(0);

    await page.setInputFiles("#ctxFilePick", {
      name: "enunciado.png",
      mimeType: "image/png",
      buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
    });

    // El upload dispara ttd:statement-uploaded -> initSession se relanza ->
    // segunda llamada a session/start ya con el adjunto -> pasos reales.
    await expect(page.locator("#ctxSubSteps .step-map-panel")).toBeVisible();
    await expect(page.locator(".ctx-sub-steps-placeholder")).toBeHidden();
    await expect(page.locator("#messages .row.a .bubble").last()).toContainText("Vamos con el ejercicio 1");
    expect(startCalls).toBeGreaterThanOrEqual(2);

    await context.close();
  });

  test("adjunto ya subido pero sin pasos: ofrece 'Reintentar', nunca una pantalla muerta sin salida", async ({ browser }) => {
    const existingAttachment = { id: "att_prev", file_name: "enunciado.png", mime: "image/png" };
    const { context, page } = await gotoStudentWithTask(browser, { attachments: [existingAttachment] });

    let startCalls = 0;
    await page.route("**/api/v1/session/start", (route) => {
      startCalls += 1;
      const body =
        startCalls === 1
          ? sessionStartBody({ status: "ready", resumed: true, steps: [] })
          : sessionStartBody({
              status: "ready",
              resumed: false,
              steps: [{ index: 0, title: "Paso 1", completed: false }],
              exercises: [{ index: 1, title: "Ejercicio 1" }],
              guideOk: true,
            });
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });

    await page.click('li[data-card-task-id="task_sl_1"]');

    // Tarea con adjunto pero sin pasos -> nunca el texto muerto de siempre,
    // debe ofrecer un botón de reintento.
    const placeholder = page.locator(".ctx-sub-steps-placeholder");
    await expect(placeholder).toBeVisible();
    await expect(placeholder).not.toHaveText("Los pasos aparecerán aquí");
    const retryBtn = placeholder.locator(".ctx-sub-steps-retry");
    await expect(retryBtn).toBeVisible();
    await expect(retryBtn).toHaveText("Reintentar");

    await retryBtn.click();

    await expect(page.locator("#ctxSubSteps .step-map-panel")).toBeVisible();
    await expect(placeholder).toBeHidden();
    expect(startCalls).toBeGreaterThanOrEqual(2);

    await context.close();
  });
});
