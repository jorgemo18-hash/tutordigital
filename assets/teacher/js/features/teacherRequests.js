import { apiFetch, clearSession } from "../../../shared/js/auth.js";
import { formatRequestId } from "../api/teacherApiHelpers.js";

export function renderTeacherRequests(elements, items = [], view = "pending") {
  const listEl = elements.teacherRequestsList;
  const emptyEl = elements.teacherRequestsEmpty;
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = "";
  if (!items.length) {
    emptyEl.textContent = view === "approved" ? "Sin profesores activos." : "Sin solicitudes.";
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";
  const list = document.createElement("ul");
  list.className = "ticketList";
  items.forEach((item) => {
    const li = document.createElement("li");
    li.dataset.requestId = item.id;
    const email = item.email || item.requested_by || "Usuario";
    const baseDate = view === "approved" ? item.decided_at : item.created_at;
    const date = baseDate ? new Date(baseDate).toLocaleDateString("es-ES") : "";
    const statusText = view === "approved" ? "Aprobado" : "Pendiente";
    li.innerHTML = `
      <div class="ticketMeta">
        <div class="ticketTitle">${email}</div>
        <div class="ticketHint">${statusText}${date ? ` · ${date}` : ""}</div>
      </div>
      ${
        view === "pending"
          ? `<div class="ticketActions">
               <button class="btn ghost" data-teacher-action="approve">Aprobar</button>
               <button class="btn ghost" data-teacher-action="reject">Rechazar</button>
             </div>`
          : ""
      }
    `;
    list.appendChild(li);
  });
  listEl.appendChild(list);
}

export async function loadTeacherRequests(ctx) {
  const { state, elements } = ctx;
  if (state.currentRole !== "admin") return;
  if (!elements.teacherRequestsList) return;
  if (elements.teacherRequestsError) elements.teacherRequestsError.textContent = "";
  elements.teacherRequestsList.textContent = "Cargando…";
  const view = state.teacherRequestView || "pending";
  const res = await apiFetch(`/api/v1/teacher/requests?status=${encodeURIComponent(view)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/login";
      return;
    }
    const rid = formatRequestId(body) ? ` (ref: ${formatRequestId(body)})` : "";
    if (elements.teacherRequestsError) {
      elements.teacherRequestsError.textContent = `Error cargando solicitudes${rid}`;
    }
    elements.teacherRequestsList.innerHTML = "";
    if (elements.teacherRequestsEmpty) elements.teacherRequestsEmpty.style.display = "none";
    return;
  }
  const items = body?.data?.items || [];
  renderTeacherRequests(elements, items, view);
}
