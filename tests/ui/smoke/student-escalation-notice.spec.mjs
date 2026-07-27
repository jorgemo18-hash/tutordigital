// Verifica el aviso visible de escalación (onEscalate ya no es un no-op).
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
  id: "task_esc",
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

test("student — el servidor escala y el alumno ve un aviso en el chat (no el no-op de antes)", async ({ browser }) => {
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
        data: {
          status: "ready",
          sessionId: "sess_esc_1", // real, no null — activa el camino streaming
          resumed: true,
          steps: [],
          currentStep: 0,
          exercises: [],
          messages: [],
        },
      },
    },
  });

  await page.route("**/api/v1/chat", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: sseBody([
        { type: "token", text: "Vale, " },
        { type: "token", text: "vamos a verlo con calma." },
        { type: "escalate", reason: "alumno insiste en pedir la solución tras varios intentos" },
      ]),
    })
  );

  await page.goto("/assets/student/index.html", { waitUntil: "networkidle" });

  // due_date = hoy (reloj congelado): confirma que la tarjeta está en su
  // columna activa, no en Atrasadas (ver comentario de FROZEN_DATE arriba).
  await expect(page.locator('#btnDeberes li[data-card-task-id="task_esc"]')).toBeVisible();
  await expect(page.locator('#btnAtrasadas li[data-card-task-id="task_esc"]')).toHaveCount(0);

  await page.click('li[data-card-task-id="task_esc"]');

  await page.fill("#inp", "No lo entiendo, dime la solución");
  await page.click("#sendIn");

  const notice = page.locator(".escalationNotice");
  await expect(notice).toBeVisible();
  await expect(notice.locator(".escalationNoticeTitle")).toContainText("Tu profesor va a revisar esto contigo");
  // El motivo interno (server-side, para el profesor) NUNCA se muestra tal cual al alumno.
  await expect(notice).not.toContainText("alumno insiste en pedir la solución");

  await context.close();
});
