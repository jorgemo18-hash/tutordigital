// Smoke test de teacher: carga con sesión mockeada, la Agenda renderiza una
// tarea mockeada y el Cuaderno (vista semana, la que carga por defecto)
// renderiza la tabla de alumnos. Agenda y Cuaderno se pintan a la vez en
// desktop — no hace falta navegar entre pestañas.
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

// El grupo activo requiere un id con forma de UUID v4 real — si no,
// teacherApiHelpers.js descarta el grupo y Agenda/Cuaderno quedan vacíos.
const MOCK_GROUP_ID = "b3a1e2d4-1234-4abc-8def-1234567890ab";
const TODAY_ISO = new Date().toISOString().slice(0, 10);

const MOCK_GROUP = { id: MOCK_GROUP_ID, name: "1º ESO A", level: "eso", created_at: "2026-01-01" };
const MOCK_TASK = {
  id: "task_1",
  type: "homework",
  title: "Ejercicios de álgebra",
  due_date: TODAY_ISO,
  group_id: MOCK_GROUP_ID,
};
const MOCK_STUDENT = { id: "s1", display_name: "Ana García", group_id: MOCK_GROUP_ID, status: "active", approval_status: "approved" };

async function gotoTeacher(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await installApiMocks(page, {
    roles: ["teacher"],
    routes: {
      "**/api/v1/groups*": { data: { items: [MOCK_GROUP] } },
      "**/api/v1/tasks*": { data: { items: [MOCK_TASK] } },
      "**/api/v1/students*": { data: { items: [MOCK_STUDENT] } },
      // El catch-all genérico de installApiMocks responde {data:{}} — estos
      // 4 endpoints del Cuaderno esperan `data` como ARRAY directamente
      // (assets/teacher/js/features/notebook.js:101,102,114,140,141: `body?.data || []`).
      // Con {data:{}}, `{} || []` da `{}` (truthy) y notebook-week.js:300
      // revienta con "studentNotes.filter is not a function" — hay que
      // sobreescribirlos explícitamente como array vacío.
      "**/api/v1/tutor-sessions*": { data: [] },
      "**/api/v1/student-notes*": { data: [] },
      "**/api/v1/grades*": { data: [] },
      "**/api/v1/subjects*": { data: [] },
      "**/api/v1/grade-weights*": { data: [] },
    },
  });
  await page.goto("/assets/teacher/index.html", { waitUntil: "networkidle" });
  return { context, page };
}

test.describe("teacher — sesión, Agenda y Cuaderno", () => {
  test("la Agenda renderiza la tarea mockeada de hoy", async ({ browser }) => {
    const { context, page } = await gotoTeacher(browser);

    const task = page.locator('#taskListHomework .taskItem[data-task-id="task_1"]');
    await expect(task).toBeVisible();
    await expect(task.locator(".taskTitle")).toContainText("Ejercicios de álgebra");

    await context.close();
  });

  test("el Cuaderno renderiza la tabla de alumnos", async ({ browser }) => {
    const { context, page } = await gotoTeacher(browser);

    const row = page.locator('#notebookGrid table.nbWeekTable tbody tr[data-student-id]');
    await expect(row).toHaveCount(1);
    await expect(row.locator("td.nbName")).toContainText("García");

    await context.close();
  });
});
