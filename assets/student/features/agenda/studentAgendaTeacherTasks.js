import { apiFetch } from "../../../shared/js/auth.js";
import { escHtml } from "../../../shared/js/escHtml.js";
import { setTasks, setCtxAttachment } from "./taskContext.js";
import { populateContextPane } from "./ctxPane.js";
import {
  renderCard,
  renderAtrasadas,
  renderLoadingState,
  renderEmptyState,
  getOrCreateList,
  initAgendaTaskHandlers
} from "./agendaCards.js";

export function initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, btnAtrasadas, selectTask }) {
  const TYPE_TO_MODE = {
    homework: "DEBERES",
    exam: "EXAMEN",
    work: "TRABAJO",
  };

  let teacherTasksById = new Map();
  let taskStatusMap = new Map(); // taskId → "done" | "pending" | "needs_teacher" | null

  const _lsKey = `ttd_ts_${ACTIVE_USER?.userId || "anon"}`;
  function _lsLoad() {
    try { return JSON.parse(localStorage.getItem(_lsKey) || "{}"); } catch { return {}; }
  }
  function _lsSave(taskId, status) {
    try {
      const m = _lsLoad();
      if (!status || status === "pending") { delete m[taskId]; } else { m[taskId] = status; }
      localStorage.setItem(_lsKey, JSON.stringify(m));
    } catch {}
  }

  function handleCardClick(taskId) {
    const task = teacherTasksById.get(taskId);
    if (!task) return;
    const mode = TYPE_TO_MODE[task.type];
    if (!mode) return;
    populateContextPane(task);
    if (typeof selectTask === "function") {
      selectTask(mode, { taskId: task.id, title: task.title, tipo: task.type });
    }
  }

  function countDone(taskList) {
    return taskList.filter((t) => taskStatusMap.get(t.id) === "done").length;
  }

  function refreshColumnCounts(groups) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    const atrasadasVisible = groups.atrasadas.filter((t) => t.type === "homework" || t.type === "work");
    set("countAtrasadas",    `${countDone(atrasadasVisible)}/${atrasadasVisible.length}`);
    set("countDeberes",      `${countDone(groups.homework)}/${groups.homework.length}`);
    set("countExamenTrabajo",`${countDone([...groups.exam, ...groups.work])}/${groups.exam.length + groups.work.length}`);
  }

  function injectApiTasks(apiTasks) {
    const tasks = (Array.isArray(apiTasks) ? apiTasks : []).map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title || "",
      desc: t.desc || t.description || "",
      teacher_notes: t.teacher_notes || "",
      dueDate: t.due_date || "",
      subjectName: t.subject_name || t.subjectName || "",
      subject: t.subject || "",
      estimatedMinutes: t.estimated_minutes || t.estimatedMinutes || 0,
      myStatus: t.my_status || null,
      attachments: (t.attachments || []).map((a) => ({
        id: a.id, file_name: a.file_name || "", size: a.size || 0, mime: a.mime || "",
      })),
    }));

    // Populate status map from API data
    taskStatusMap = new Map(tasks.map((t) => [t.id, t.myStatus]));

    teacherTasksById = new Map(tasks.map((t) => [t.id, t]));
    setTasks(tasks);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fallback: si el servidor no devolvió my_status (código antiguo en Render o
    // fallo silencioso en la query), usar el estado guardado en localStorage.
    const _lsStatuses = _lsLoad();
    if (Object.keys(_lsStatuses).length) {
      let augmented = false;
      for (const task of tasks) {
        if (!task.myStatus && _lsStatuses[task.id]) {
          task.myStatus = _lsStatuses[task.id];
          augmented = true;
        }
      }
      if (augmented) taskStatusMap = new Map(tasks.map((t) => [t.id, t.myStatus]));
    }

    const groups = { atrasadas: [], homework: [], exam: [], work: [] };

    for (const task of tasks) {
      if (task.dueDate) {
        const due = new Date(`${task.dueDate}T00:00:00`);
        due.setHours(0, 0, 0, 0);
        if (due < today) {
          // Deberes completados no van a atrasadas (el servidor ya los filtra;
          // este check es el fallback para la sesión actual)
          if ((task.type === "homework" || task.type === "work") && (task.myStatus === "done" || task.myStatus === "needs_teacher")) continue;
          groups.atrasadas.push(task);
          continue;
        }
      }
      const type = task.type === "exam" ? "exam" : task.type === "work" ? "work" : "homework";
      // Trabajos entregados no aparecen en la lista activa
      if (type === "work" && (task.myStatus === "done" || task.myStatus === "needs_teacher")) continue;
      groups[type].push(task);
    }

    // Store groups for later counter refreshes
    window._tdGroups = groups;

    const columns = [
      { group: "atrasadas", btn: btnAtrasadas, kind: "atrasada" },
      { group: "homework",  btn: btnDeberes,   kind: "deberes" },
      { group: "exam",      btn: btnExamen,    kind: "examen" },
      { group: "work",      btn: btnTrabajo,   kind: "trabajo" },
    ];

    columns.forEach(({ group, btn, kind }) => {
      if (!btn) return;
      if (group === "atrasadas") {
        renderAtrasadas(btn, groups.atrasadas, { taskStatusMap });
        return;
      }
      const list = getOrCreateList(btn);
      list.innerHTML = "";
      const sorted = groups[group]
        .slice()
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      if (sorted.length === 0) {
        renderEmptyState(list);
      } else {
        sorted.forEach((task) => list.appendChild(renderCard(task, kind, { taskStatusMap })));
      }
    });

    refreshColumnCounts(groups);

    const greeting = document.getElementById("studentGreeting");
    if (greeting) {
      const name = ACTIVE_USER?.displayName || "";
      const firstName = name.split(" ")[0];
      greeting.innerHTML = firstName ? `Bienvenido, <em>${escHtml(firstName)}</em>` : "Bienvenido";
    }

    const eyebrow = document.querySelector(".td-main-eyebrow");
    if (eyebrow) {
      const now = new Date();
      const day = now.toLocaleDateString("es-ES", { weekday: "long" });
      const d = now.getDate();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = String(now.getFullYear()).slice(-2);
      eyebrow.textContent = `${day.charAt(0).toUpperCase() + day.slice(1)} ${d}/${m}/${y}`;
    }
  }

  renderLoadingState([btnDeberes, btnExamen, btnTrabajo, btnAtrasadas]);
  initAgendaTaskHandlers(handleCardClick);

  function refreshTaskContext(taskId) {
    const task = teacherTasksById.get(String(taskId || ""));
    if (task) populateContextPane(task);
  }

  async function refreshTaskList() {
    try {
      const res = await apiFetch("/api/v1/tasks");
      const body = await res.json().catch(() => ({}));
      injectApiTasks(res.ok ? (body?.data?.items || []) : []);
    } catch {
      // silently ignore — agenda stays as-is
    }
  }
  window._tdRefreshTasks = refreshTaskList;

  return { injectApiTasks, refreshTaskContext };
}
