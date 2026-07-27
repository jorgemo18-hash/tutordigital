// Regresión: grade-drawer.js y bulk-grade-drawer.js (panel teacher) ahora
// usan el helper compartido de "cambios sin guardar" (ver
// assets/shared/js/unsavedChanges/) — antes cerraban en silencio al
// pinchar fuera o pulsar Escape, perdiendo notas de evaluación sin
// avisar. Este spec abre los drawers REALES vía la UI (nunca llamando a
// las funciones JS directamente) y comprueba el comportamiento en el DOM,
// mismo criterio que academia-admin-fichar-fab-drawer-overlap.spec.mjs.
//
// bulk-grade-drawer solo se abre "stacked" bajo task-picker-drawer en la
// UI real. La CSS de "stacked" (.dd-overlay--stacked, _task-list-drawer.css)
// intenta hacer pointer-events:none en el overlay propio de bulk para que
// el clic-fuera lo reciba task-picker-drawer (Level 1) — pero en la
// práctica NO gana esa pelea de especificidad CSS: `.dd-overlay.open`
// (dos clases) es más específico que `.dd-overlay--stacked` (una clase) y
// sigue imponiendo pointer-events:auto, así que hoy el clic-fuera real SÍ
// llega directo al overlay de bulk-grade-drawer (confirmado con
// getComputedStyle en una página real). Es un bug de CSS preexistente,
// fuera del alcance de esta tarea — no se toca aquí, solo se documenta
// para que estos tests reflejen el comportamiento REAL, no el que la CSS
// pretendía. Por eso los tests de clic-fuera apuntan a
// #bulkGradeDrawerOverlay directamente (cierra solo ese nivel, sin
// arrastrar a task-picker-drawer). El teclado Escape sí funciona como se
// pretendía originalmente (dos listeners en `document`, uno por drawer, y
// pointer-events no les afecta) — de ahí que task-picker-drawer.js consulte
// el guard de bulk-grade-drawer antes de cerrarse por Escape (ver
// isBulkGradeDrawerOpen/intentarCerrarBulkGradeDrawer) y que bulk-grade-drawer.js
// ignore su propio Escape mientras esté "stacked" (evita pedir
// confirmación dos veces para la misma pulsación).
import { test, expect } from "@playwright/test";
import { forceTheme, forceFakeSession } from "../fixtures/theme.mjs";
import { installApiMocks } from "../fixtures/api-mocks.mjs";

const MOCK_GROUP_ID = "b3a1e2d4-1234-4abc-8def-1234567890ab";
const MOCK_GROUP = { id: MOCK_GROUP_ID, name: "1º ESO A", level: "eso", created_at: "2026-01-01" };
const MOCK_STUDENT_1 = { id: "s1", display_name: "Ana García", group_id: MOCK_GROUP_ID, status: "active", approval_status: "approved" };
const MOCK_STUDENT_2 = { id: "s2", display_name: "Bea López", group_id: MOCK_GROUP_ID, status: "active", approval_status: "approved" };

// Frozen clock: enero cae en el trimestre t2 (ene-mar) — mismo criterio
// que teacher.spec.mjs, sin depender de la fecha real de ejecución.
const FROZEN_DATE = new Date("2026-01-15T12:00:00");

// Examen CON nota ya puesta para s1 (caso "Ver" -> autorrelleno) y
// trabajo SIN ninguna nota (caso "+ Añadir nota" -> formulario vacío).
const MOCK_TASK_EXAM = { id: "task_exam_1", type: "exam", title: "Examen de matemáticas", due_date: "2026-01-14", group_id: MOCK_GROUP_ID };
const MOCK_TASK_WORK = { id: "task_work_1", type: "work", title: "Trabajo de historia", due_date: "2026-02-10", group_id: MOCK_GROUP_ID };
const MOCK_GRADE_EXAM_S1 = { id: "grade_1", task_id: "task_exam_1", student_id: "s1", score: "8", date: "2026-01-14", title: "Examen de matemáticas" };

// La query de periodGrades (?group_id=...) decide qué botón pinta cada
// sección (Ver si ya hay nota, + si no) — la de grade-drawer/bulk-grade
// (?task_id=...) decide el autorrelleno al abrir. Distintas queries del
// mismo endpoint necesitan distinta respuesta, así que se sirven a mano
// después de installApiMocks (gana el último route() registrado).
async function mockGrades(page, { periodGrades, byTask }) {
  await page.route("**/api/v1/grades*", (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("group_id")) {
      return route.fulfill({ json: { data: periodGrades } });
    }
    const taskId = url.searchParams.get("task_id");
    return route.fulfill({ json: { data: byTask[taskId] || [] } });
  });
}

async function gotoTeacherTerm(browser) {
  const context = await browser.newContext();
  await forceTheme(context, "dark");
  await forceFakeSession(context);
  const page = await context.newPage();
  await page.clock.setFixedTime(FROZEN_DATE);
  await installApiMocks(page, {
    roles: ["teacher"],
    routes: {
      "**/api/v1/groups*": { data: { items: [MOCK_GROUP] } },
      "**/api/v1/tasks*": { data: { items: [MOCK_TASK_EXAM, MOCK_TASK_WORK] } },
      "**/api/v1/students*": { data: { items: [MOCK_STUDENT_1, MOCK_STUDENT_2] } },
      "**/api/v1/tutor-sessions*": { data: [] },
      "**/api/v1/student-notes*": { data: [] },
      "**/api/v1/subjects*": { data: [] }, // showNotaMedia=false -> "Ver"/"+ " quedan editables, no de solo lectura
      "**/api/v1/grade-weights*": { data: [] },
    },
  });
  await mockGrades(page, {
    periodGrades: [MOCK_GRADE_EXAM_S1],
    byTask: { task_exam_1: [MOCK_GRADE_EXAM_S1], task_work_1: [] },
  });
  await page.goto("/assets/teacher/index.html", { waitUntil: "networkidle" });

  // Cuaderno -> vista Trimestre: la vista Semana siempre abre el drawer en
  // modo solo-lectura (readonly, ver notebook-week.js) — Trimestre es la
  // única vía real con el formulario editable.
  await page.selectOption("#notebookMode", "term");
  await expect(page.locator('.nbStudentCard[data-student-id="s1"]')).toBeVisible();

  return { context, page };
}

// openGradeDrawer no se espera desde el propio click handler (modals.js
// la llama "fire and forget") — _guard.marcarLimpio() se dispara al
// final de su propio fetch async (_loadGrades), después de que el botón
// ya sea clicable. Sin esperar a que el fetch resuelva, escribir
// "demasiado rápido" cae ANTES de marcarLimpio() y ese texto se confunde
// con el estado "limpio" de partida — exactamente el mismo tipo de
// carrera que la regresión de autorrelleno que este spec quiere cubrir.
//
// #gdEmpty NO sirve de señal aquí (a diferencia de .bgd-score-input en
// bulk-grade-drawer): ya viene visible desde la plantilla estática, antes
// de que _loadGrades haya hecho nada — esperar a que "aparezca" no
// distingue "aún no ha cargado" de "cargó y no hay notas". Por eso se
// espera la respuesta de red real de la que depende _loadGrades.
async function abrirGradeDrawerParaNuevaNota(page) {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/v1/grades") && r.url().includes("task_id=task_work_1")),
    page.locator('.nbStudentCard[data-student-id="s1"] .nbAddNoteBtn[data-task-id="task_work_1"]').click(),
  ]);
  await expect(page.locator("#gradeDrawerOverlay")).toHaveClass(/\bopen\b/);
  // Tras la respuesta de red aún queda trabajo síncrono en _loadGrades
  // (parsear el JSON + renderGradeList + marcarLimpio) — un margen
  // pequeño evita medir a mitad de esos últimos pasos.
  await page.waitForTimeout(100);
}

test.describe("teacher — grade-drawer: cambios sin guardar", () => {
  test("sin tocar nada, clic fuera -> cierra sin pedir confirmación", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirGradeDrawerParaNuevaNota(page);

    await page.locator("#gradeDrawerOverlay").click({ position: { x: 10, y: 10 } });
    await expect(page.locator("#gradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  test("escribir una nota, clic fuera -> pide confirmación; cancelar deja el drawer abierto con la nota", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirGradeDrawerParaNuevaNota(page);
    await page.fill("#gdScoreInput", "7,5");

    page.once("dialog", (d) => d.dismiss());
    await page.locator("#gradeDrawerOverlay").click({ position: { x: 10, y: 10 } });

    await expect(page.locator("#gradeDrawerOverlay")).toHaveClass(/\bopen\b/);
    await expect(page.locator("#gdScoreInput")).toHaveValue("7,5");

    await context.close();
  });

  test("escribir una nota, clic fuera -> confirmar -> cierra", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirGradeDrawerParaNuevaNota(page);
    await page.fill("#gdScoreInput", "7,5");

    page.once("dialog", (d) => d.accept());
    await page.locator("#gradeDrawerOverlay").click({ position: { x: 10, y: 10 } });

    await expect(page.locator("#gradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  test("Escape — sin tocar nada -> cierra sin pedir confirmación", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirGradeDrawerParaNuevaNota(page);

    await page.keyboard.press("Escape");
    await expect(page.locator("#gradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  test("Escape — con una nota escrita pide confirmación; cancelar deja el drawer abierto con la nota", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirGradeDrawerParaNuevaNota(page);
    await page.fill("#gdScoreInput", "6");

    page.once("dialog", (d) => d.dismiss());
    await page.keyboard.press("Escape");

    await expect(page.locator("#gradeDrawerOverlay")).toHaveClass(/\bopen\b/);
    await expect(page.locator("#gdScoreInput")).toHaveValue("6");

    await context.close();
  });

  test("Escape — con una nota escrita, confirmar -> cierra", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirGradeDrawerParaNuevaNota(page);
    await page.fill("#gdScoreInput", "6");

    page.once("dialog", (d) => d.accept());
    await page.keyboard.press("Escape");

    await expect(page.locator("#gradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  // REGRESIÓN — el caso sutil: el autorrelleno de una nota YA existente
  // (al abrir "Ver" sobre un examen con nota puesta) no debe confundirse
  // con un cambio del profesor. Si _guard.marcarLimpio() se llamara antes
  // del autorrelleno (en vez de después, ver _loadGrades() en
  // grade-drawer.js) este test fallaría con un diálogo de confirmación
  // inesperado.
  test("REGRESIÓN autorrelleno — abrir sobre una nota ya existente, no tocar nada, clic fuera -> cierra sin confirmar", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await page.locator('.nbStudentCard[data-student-id="s1"] .nbVerBtn[data-task-id="task_exam_1"]').click();
    await expect(page.locator("#gradeDrawerOverlay")).toHaveClass(/\bopen\b/);
    await expect(page.locator("#gdScoreInput")).toHaveValue("8"); // confirma que el autorrelleno sí ocurrió

    await page.locator("#gradeDrawerOverlay").click({ position: { x: 10, y: 10 } });
    await expect(page.locator("#gradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });
});

test.describe("teacher — bulk-grade-drawer: cambios sin guardar (mayor riesgo de la auditoría)", () => {
  // Ver el comentario largo al principio del archivo: el clic-fuera real
  // de hoy llega al overlay propio de bulk-grade-drawer (bug de
  // especificidad CSS en .dd-overlay--stacked), que cierra SOLO ese
  // nivel — task-picker-drawer (la lista de tareas) se queda abierto
  // detrás, sin "is-stacked". Es un comportamiento razonable de todos
  // modos (volver a la lista de tareas, no a la pestaña del Cuaderno).
  async function abrirBulkGradeDrawer(page) {
    await page.locator("#notesPerTaskBtn").click();
    const row = page.locator('.tgp-row[data-tpd-task-id="task_work_1"]');
    await expect(row).toBeVisible();
    await row.click();
    // Señal de que openBulkGradeDrawer (fire-and-forget desde
    // task-picker-drawer.js) ya terminó su fetch y _guard.marcarLimpio() —
    // sin esto, el mismo riesgo de carrera que en grade-drawer.
    await expect(page.locator('.bgd-score-input[data-student-id="s1"]')).toBeVisible();
  }

  test("sin tocar nada, clic fuera -> cierra sin pedir confirmación", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirBulkGradeDrawer(page);

    await page.locator("#bulkGradeDrawerOverlay").click({ position: { x: 10, y: 10 } });
    await expect(page.locator("#bulkGradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  test("notas de VARIOS alumnos escritas, clic fuera -> pide confirmación; cancelar deja el drawer abierto con las notas", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirBulkGradeDrawer(page);

    await page.fill('.bgd-score-input[data-student-id="s1"]', "7");
    await page.fill('.bgd-score-input[data-student-id="s2"]', "9");

    page.once("dialog", (d) => d.dismiss());
    await page.locator("#bulkGradeDrawerOverlay").click({ position: { x: 10, y: 10 } });

    await expect(page.locator("#bulkGradeDrawerOverlay")).toHaveClass(/\bopen\b/);
    await expect(page.locator('.bgd-score-input[data-student-id="s1"]')).toHaveValue("7");
    await expect(page.locator('.bgd-score-input[data-student-id="s2"]')).toHaveValue("9");

    await context.close();
  });

  test("notas de varios alumnos, clic fuera -> confirmar -> cierra", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirBulkGradeDrawer(page);

    await page.fill('.bgd-score-input[data-student-id="s1"]', "7");
    await page.fill('.bgd-score-input[data-student-id="s2"]', "9");

    page.once("dialog", (d) => d.accept());
    await page.locator("#bulkGradeDrawerOverlay").click({ position: { x: 10, y: 10 } });

    await expect(page.locator("#bulkGradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  // El caso "vía Escape con task-picker-drawer abierto detrás" es el que
  // de verdad ejercita isBulkGradeDrawerOpen/intentarCerrarBulkGradeDrawer
  // (closeTaskPickerDrawer consultando el guard de bulk antes de cerrarse) —
  // y confirma que NO aparecen dos diálogos para la misma pulsación (ver
  // el `!_stacked` en el propio listener de Escape de bulk-grade-drawer.js).
  test("Escape — sin tocar nada -> cierra todo (task-picker + bulk) sin pedir confirmación", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirBulkGradeDrawer(page);

    await page.keyboard.press("Escape");
    await expect(page.locator("#bulkGradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);
    await expect(page.locator("#taskPickerDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });

  test("Escape — con notas de varios alumnos pide UNA sola confirmación; cancelar deja todo abierto con las notas", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirBulkGradeDrawer(page);

    await page.fill('.bgd-score-input[data-student-id="s1"]', "7");
    await page.fill('.bgd-score-input[data-student-id="s2"]', "9");

    let diálogos = 0;
    page.on("dialog", (d) => { diálogos += 1; d.dismiss(); });
    await page.keyboard.press("Escape");
    // Deja pasar un instante por si un segundo listener disparara un
    // segundo diálogo (el bug que !_stacked evita) — sin esto, un
    // page.once no lo detectaría al haberse ya consumido con el primero.
    await page.waitForTimeout(200);

    expect(diálogos).toBe(1);
    await expect(page.locator("#bulkGradeDrawerOverlay")).toHaveClass(/\bopen\b/);
    await expect(page.locator("#taskPickerDrawerOverlay")).toHaveClass(/\bopen\b/);
    await expect(page.locator('.bgd-score-input[data-student-id="s1"]')).toHaveValue("7");
    await expect(page.locator('.bgd-score-input[data-student-id="s2"]')).toHaveValue("9");

    await context.close();
  });

  test("Escape — con notas de varios alumnos, confirmar -> cierra todo", async ({ browser }) => {
    const { context, page } = await gotoTeacherTerm(browser);
    await abrirBulkGradeDrawer(page);

    await page.fill('.bgd-score-input[data-student-id="s1"]', "7");
    await page.fill('.bgd-score-input[data-student-id="s2"]', "9");

    page.once("dialog", (d) => d.accept());
    await page.keyboard.press("Escape");

    await expect(page.locator("#bulkGradeDrawerOverlay")).not.toHaveClass(/\bopen\b/);
    await expect(page.locator("#taskPickerDrawerOverlay")).not.toHaveClass(/\bopen\b/);

    await context.close();
  });
});
