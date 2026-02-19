import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { getActiveGroupId } from "../../../shared/js/groupState.js";
import { formatRequestId } from "../api/teacherApiHelpers.js";
import { getTenant } from "../bootstrap/teacherBootstrap.js";

export function normalizeStudentStatus(raw) {
  const value = String(raw || "").toLowerCase().trim();
  if (!value) return "pending";
  if (["needs_teacher", "needs-professor", "necesita_profesor"].includes(value)) return "needs_teacher";
  if (["pending", "pendiente"].includes(value)) return "pending";
  if (["ok", "done", "submitted"].includes(value)) return "submitted";
  return "pending";
}

export function mapStudentFromApi(item, tenantId) {
  const display = String(item?.display_name || item?.name || "").trim();
  return {
    id: item?.id,
    name: display,
    groupId: item?.group_id || item?.groupId || "",
    status: normalizeStudentStatus(item?.status),
    approval_status: item?.approval_status || "approved",
    tenantId,
  };
}

export function ensureCurrentGroup(state) {
  const allowedGroupIds = state.activeUser?.groupIds?.length ? new Set(state.activeUser.groupIds) : null;
  const groups = state.data.groups.filter(group => {
    if (group.tenantId !== state.tenantId) return false;
    if (allowedGroupIds && !allowedGroupIds.has(group.id)) return false;
    return true;
  });
  if (!groups.length) {
    state.currentGroupId = null;
    return;
  }
  if (!groups.some(group => group.id === state.currentGroupId)) {
    state.currentGroupId = groups[0].id;
  }
}

export async function loadStudentsForActiveGroup(ctx) {
  const { elements, state } = ctx;
  const groupId = getActiveGroupId(getTenant());
  if (!groupId) {
    if (elements.studentList) elements.studentList.innerHTML = "";
    if (elements.studentEmpty) {
      elements.studentEmpty.textContent = "Selecciona un grupo.";
      elements.studentEmpty.style.display = "block";
    }
    await ctx.refreshNotebookForActiveGroup();
    return;
  }
  if (elements.studentEmpty) {
    elements.studentEmpty.textContent = "Cargando…";
    elements.studentEmpty.style.display = "block";
  }
  const approval = state.studentApprovalView || "pending";
  const res = await apiFetch(
    `/api/v1/students?group_id=${encodeURIComponent(groupId)}&approval_status=${encodeURIComponent(approval)}&limit=200&offset=0`
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/index.html";
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    if (elements.studentEmpty) {
      const msg =
        res.status === 429
          ? `Demasiadas peticiones${rid}`
          : `Error cargando alumnos${rid}`;
      elements.studentEmpty.textContent = msg;
      elements.studentEmpty.style.display = "block";
    }
    return;
  }
  const items = body?.data?.items || [];
  state.currentGroupId = groupId;
  if (elements.studentEmpty) {
    elements.studentEmpty.textContent = "No hay alumnos en este grupo.";
  }
  state.data.students = items.map((item) => mapStudentFromApi(item, state.tenantId));
  ctx.renderStudents();
  await ctx.refreshNotebookForActiveGroup();
}
