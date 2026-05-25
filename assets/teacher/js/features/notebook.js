import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { clearActiveGroupId, getActiveGroupId, setActiveGroupId } from "../../../shared/js/groupState.js";
import { renderNotebook } from "../notebook.js";
import { formatRequestId, getNotebookRangeParams, isUuid, isYMD } from "../api/teacherApiHelpers.js";
import { getTenant } from "../bootstrap/teacherBootstrap.js";
import { mapTaskFromApi } from "../tasks.js";

let notebookInflight = null;
const DEBUG_NOTEBOOK = Boolean(window.RUNTIME_CONFIG?.DEBUG_NOTEBOOK);

export function refreshNotebookForActiveGroup(ctx) {
  const { state, elements } = ctx;

  if (notebookInflight) return notebookInflight;
  notebookInflight = (async () => {
    const tenant = getTenant();
    let groupId = getActiveGroupId(tenant);
    if (groupId && !isUuid(groupId)) {
      clearActiveGroupId(tenant);
      const fallback = (state.data?.groups || []).find((g) => isUuid(g?.id))?.id || "";
      if (fallback) {
        setActiveGroupId(tenant, fallback);
        groupId = fallback;
      } else {
        groupId = "";
      }
    }
    if (!groupId) {
      if (elements.notebookGrid) elements.notebookGrid.innerHTML = "";
      if (elements.notebookEmpty) {
        elements.notebookEmpty.textContent = "Selecciona un grupo.";
        elements.notebookEmpty.style.display = "block";
      }
      return;
    }

    const range = getNotebookRangeParams(state);
    if (DEBUG_NOTEBOOK) {
      console.log("[NOTEBOOK_SUMMARY] range raw =", range, {
        fromType: typeof range?.from,
        toType: typeof range?.to,
        fromIsArray: Array.isArray(range?.from),
        toIsArray: Array.isArray(range?.to),
      });
    }
    if (!isYMD(String(range.from)) || !isYMD(String(range.to))) {
      console.warn("[notebook/summary] invalid date range", range);
      if (elements.notebookEmpty) {
        elements.notebookEmpty.textContent = "Rango de fechas inválido.";
        elements.notebookEmpty.style.display = "block";
      }
      return;
    }

    const url =
      `/api/v1/notebook/summary?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
    if (DEBUG_NOTEBOOK) console.log("[NOTEBOOK_SUMMARY] url=", url);
    const res = await apiFetch(url);
    if (DEBUG_NOTEBOOK) console.log("[NOTEBOOK_SUMMARY] status=", res.status);
    if (!res.ok) {
      const errorText = await res.clone().text();
      if (DEBUG_NOTEBOOK) console.log("[NOTEBOOK_SUMMARY] error=", errorText);
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || body?.error?.code === "unauthorized") {
        clearSession();
        window.location.href = "/index.html";
        return;
      }
      state.data.notebookSummary = null;
      if (elements.notebookEmpty) {
        const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
        elements.notebookEmpty.textContent = `Error cargando cuaderno${rid}`;
        elements.notebookEmpty.style.display = "block";
      }
      return;
    }

    state.data.notebookSummary = body?.data || null;
    state.currentGroupId = groupId;

    const isCustomReady = state.notebookMode === "custom" && state.notebookCustomFrom && state.notebookCustomTo;
    if (state.notebookMode === "week" || state.notebookMode === "month" || state.notebookMode === "term" || isCustomReady) {
      try {
        const sessUrl = `/api/v1/tutor-sessions?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
        const sessRes = await apiFetch(sessUrl);
        const sessBody = await sessRes.json().catch(() => ({}));
        state.data.tutorSessions = sessRes.ok ? (sessBody?.data || []) : [];
      } catch {
        state.data.tutorSessions = [];
      }
    }

    if (state.notebookMode === "week" || state.notebookMode === "month" || state.notebookMode === "term" || isCustomReady) {
      try {
        const gradesUrl = `/api/v1/grades?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
        const gradesRes = await apiFetch(gradesUrl);
        const gradesBody = await gradesRes.json().catch(() => ({}));
        state.data.periodGrades = gradesRes.ok ? (gradesBody?.data || []) : [];
      } catch {
        state.data.periodGrades = [];
      }
    } else {
      state.data.periodGrades = null;
    }

    // Week view needs its own task fetch — planner tasks use a different date range
    if (state.notebookMode === "week") {
      try {
        const tasksUrl = `/api/v1/tasks?group_id=${encodeURIComponent(groupId)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&limit=200&offset=0`;
        const tasksRes = await apiFetch(tasksUrl);
        const tasksBody = await tasksRes.json().catch(() => ({}));
        const items = tasksRes.ok ? (tasksBody?.data?.items || []) : [];
        state.data.weekTasks = items.map(item => mapTaskFromApi(item, state.tenantId, state.currentTeacherId));
      } catch {
        state.data.weekTasks = [];
      }
    } else {
      state.data.weekTasks = null;
    }

    renderNotebook(ctx);
  })().finally(() => {
    notebookInflight = null;
  });

  return notebookInflight;
}
