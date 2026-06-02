import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { getActiveGroupId } from "../../../shared/js/groupState.js";
import { getTenant } from "../bootstrap/teacherBootstrap.js";

export function mapTicketFromApi(item, tenantId) {
  if (!item) return item;
  return {
    id: item.id,
    title: item.title,
    detail: item.detail || "",
    status: item.status,
    studentId: item.student_id || null,
    groupId: item.group_id || null,
    teacherId: item.teacher_id || null,
    createdAt: item.created_at || null,
    tenantId,
  };
}

export async function loadTicketsForActiveGroup(ctx) {
  const { state } = ctx;
  const groupId = getActiveGroupId(getTenant());
  if (!groupId) {
    state.data.tickets = [];
    ctx.renderTickets();
    return;
  }

  const res = await apiFetch(
    `/api/v1/tickets?status=open&group_id=${encodeURIComponent(groupId)}&limit=200&offset=0`
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/login";
      return;
    }
    state.data.tickets = [];
    ctx.renderTickets();
    return;
  }

  const items = body?.data?.items || [];
  state.data.tickets = items.map((item) => mapTicketFromApi(item, state.tenantId));
  ctx.renderTickets();
}
