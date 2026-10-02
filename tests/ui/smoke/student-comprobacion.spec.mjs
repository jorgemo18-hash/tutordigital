// LA TARJETA ✓/✗ DEL COMPROBADOR (2/10/2026): el servidor manda el evento
// «comprobacion» ANTES que los tokens del tutor, y la tarjeta tiene que salir
// encima de su comentario, parada en el primer ✗.
// (Mismo montaje que student-escalation-notice.spec.mjs:)
// El streaming SSE (única vía por la que viaja el evento "escalate") solo se
// activa cuando /session/start devuelve un sessionId real — a diferencia del
// resto de tests de student.spec.mjs, que usan sessionId:null a propósito
// para forzar el camino síncrono. Aquí se mockea /api/v1/chat como
// text/event-stream con un evento "escalate" real.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

// Reloj congelado — mismo motivo que en student.spec.mjs/teacher.spec.mjs:
// studentAgendaTeacherTasks.js clasifica por due_date contra el reloj real,
// sin override, y este test necesita que la tarjeta exista y sea clicable
// (no importa la columna, pero sí que no desaparezca por quedar "atrasada"
// y sin sitio en el DOM que este test conozca).
const FROZEN_DATE = new Date("2026-07-10T12:00:00");
const TODAY_ISO = FROZEN_DATE.toISOString().slice(0, 10);

const MOCK_TASK = {
  id: "task_comp",
  type: "homework",
  title: "Ejercicios de álgebra",
  desc: "",
  teacher_notes: "",
  due_date: TODAY_ISO,
  subject_name: "Matemáticas",
  estimated_minutes: 20,
  my_status: null,
  attachments: [],
};

function sseBody(events) {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
}

test("student — la tarjeta ✓/✗ sale antes que el comentario del tutor y se para en el primer ✗", async ({ browser }) => {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(FROZEN_DATE);
  await installApiMocks(page, {
    roles: ["student"],
    routes: {
      "**/api/v1/student/status": {
        data: { student: { id: "stu_1", approval_status: "approved", display_name: "Alumna Test", group_id: "g1" } },
      },
      "**/api/v1/tasks*": { data: { items: [MOCK_TASK] } },
      "**/api/v1/session/start": {
        data: { status: "ready", sessionId: "sess_comp_1", resumed: true, steps: [], currentStep: 0, exercises: [], messages: [] },
      },
    },
  });

  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody([
        { type: "comprobacion", comprobacion: { apartado: "a", todoHecho: false, nivel: 1, lineas: [{ texto: "3x = 19 + 4", estado: "mal" }], hitos: [
          { titulo: "El término con x", estado: "mal" },
          { titulo: "Despejar la x", estado: "pendiente" },
        ] } },
        { type: "token", text: "Casi lo tienes. " },
        { type: "token", text: "Revisa ese paso: ¿qué le pasa al 4 cuando cambia de lado?" },
        { type: "done", usage: null },
      ]),
    })
  );

  await page.goto("/assets/student/index.html", { waitUntil: "networkidle" });
  await page.click('li[data-card-task-id="task_comp"]');
  await page.fill("#inp", "3x = 19 + 4");
  await page.click("#sendIn");

  const tarjeta = page.locator(".comprobacionCard");
  await expect(tarjeta).toBeVisible();
  await expect(tarjeta.locator(".comprobacionPaso--mal")).toContainText("El término con x");
  await expect(tarjeta).not.toContainText("Despejar la x");
  await expect(page.getByText("Revisa ese paso")).toBeVisible();

  // La tarjeta va ANTES que el comentario del tutor.
  const antes = await page.evaluate(() => {
    const t = document.querySelector(".comprobacionCard");
    const c = [...document.querySelectorAll(".bubble")].find((b) => b.textContent.includes("Revisa ese paso"));
    return Boolean(t && c && (t.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(antes).toBe(true);

  await context.close();
});
