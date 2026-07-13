// Verifica el indicador de sesiones pendientes de revisión (badge junto a
// "Cuaderno") y que abrir una sesión desde ahí marca teacher_reviewed=true
// automáticamente (sin exigir el click extra del botón "Marcar como
// revisado" que ya existía para el resto de entradas al drawer).
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_GROUP_ID = "b3a1e2d4-1234-4abc-8def-1234567890ab";
const FROZEN_DATE = new Date("2026-01-15T12:00:00");
const TODAY_ISO = FROZEN_DATE.toISOString().slice(0, 10);

const MOCK_GROUP = { id: MOCK_GROUP_ID, name: "1º ESO A", level: "eso", created_at: "2026-01-01" };
const MOCK_TASK = {
  id: "task_1",
  type: "homework",
  title: "Ejercicios de álgebra",
  due_date: TODAY_ISO,
  group_id: MOCK_GROUP_ID,
};
const MOCK_STUDENT = { id: "s1", display_name: "Ana García", group_id: MOCK_GROUP_ID, status: "active", approval_status: "approved" };
const MOCK_SESSION = {
  id: "sess_1",
  student_id: "s1",
  task_id: "task_1",
  duration_seconds: 120,
  needs_help: true,
  teacher_reviewed: false,
  session_date: TODAY_ISO,
  created_at: `${TODAY_ISO}T10:00:00Z`,
};

test("teacher — el badge de pendientes abre la sesión y la marca revisada sin click extra", async ({ browser }) => {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(FROZEN_DATE);
  await installApiMocks(page, {
    roles: ["teacher"],
    routes: {
      "**/api/v1/groups*": { data: { items: [MOCK_GROUP] } },
      "**/api/v1/tasks*": { data: { items: [MOCK_TASK] } },
      "**/api/v1/students*": { data: { items: [MOCK_STUDENT] } },
      "**/api/v1/tutor-sessions*": { data: [MOCK_SESSION] },
      "**/api/v1/student-notes*": { data: [] },
      "**/api/v1/grades*": { data: [] },
      "**/api/v1/subjects*": { data: [] },
      "**/api/v1/grade-weights*": { data: [] },
      "**/api/v1/session/by-task/task_1*": {
        data: { sessions: [{ ...MOCK_SESSION, outcome: "abandoned", step_count: 3, current_step: 1, message_count: 4 }], totalExercises: 1 },
      },
    },
  });

  let reviewPatchCalled = false;
  await page.route("**/api/v1/tutor-sessions/sess_1/review", (route) => {
    reviewPatchCalled = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { ok: true } }) });
  });

  await page.goto("/assets/teacher/index.html", { waitUntil: "networkidle" });

  const badge = page.locator("#notebookReviewBadge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText("1");

  await badge.click();
  const popoverItem = page.locator(".nbReviewItem");
  await expect(popoverItem).toBeVisible();
  await expect(popoverItem.locator(".nbReviewItemName")).toContainText("García");

  await popoverItem.click();

  const reviewBtn = page.locator("#ddTaskRevisar");
  await expect(reviewBtn).toContainText("Revisado");
  await expect(reviewBtn).toBeDisabled();
  expect(reviewPatchCalled).toBe(true);

  await context.close();
});
