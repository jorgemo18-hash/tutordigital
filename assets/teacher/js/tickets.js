import { formatStudentName, normalizeStudent } from "./state.js";
import { setOverlay } from "./dom.js";
import { apiFetch, clearSession } from "../../shared/js/auth.js";
import { openSessionDrawer, closeSessionDrawer } from "./session-drawer.js";
import { escapeHtml } from "./utils.js";

function formatTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function getRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

export function renderTickets(ctx) {
  if (!ctx.elements.ticketList) return;
  const groupId = ctx.state.currentGroupId;
  const openTickets = ctx.state.data.tickets.filter(ticket => (
    ticket.status === "open" &&
    ticket.groupId === groupId &&
    ticket.tenantId === ctx.state.tenantId &&
    (!ticket.teacherId || ticket.teacherId === ctx.state.currentTeacherId)
  ));

  ctx.elements.ticketList.innerHTML = "";

  openTickets.forEach(ticket => {
    const student = normalizeStudent(ctx.state.data.students.find(item => item.id === ticket.studentId));
    const item = document.createElement("li");
    item.className = "ticketItem";
    const studentName = student ? formatStudentName(student) : "";
    const displayTitle = studentName ? `${studentName} necesita ayuda` : ticket.title;
    item.innerHTML = `
      <div class="ticketInfo">
        <div class="ticketTitle">${escapeHtml(displayTitle)}</div>
        <div class="ticketMeta">${escapeHtml(formatTs(ticket.createdAt))}</div>
      </div>
      <div class="ticketActions">
        <button class="btn ghost" data-action="open" data-ticket-id="${ticket.id}">Abrir</button>
        <button class="btn primary" data-action="resolve" data-ticket-id="${ticket.id}">Marcar resuelto</button>
      </div>
    `;
    ctx.elements.ticketList.appendChild(item);
  });

  ctx.elements.ticketEmpty.style.display = openTickets.length ? "none" : "block";
}

export function openTicketModal(ctx, ticketId, readonly = false) {
  const ticket = ctx.state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;

  const student = normalizeStudent(ctx.state.data.students.find(item => item.id === ticket.studentId));
  const group = ctx.state.data.groups.find(item => item.id === ticket.groupId);
  ctx.elements.ticketTitle.textContent = ticket.title;
  ctx.elements.ticketDetail.innerHTML = `
    <div><strong>Alumno:</strong> ${escapeHtml(student ? formatStudentName(student) : "-")}</div>
    <div><strong>Grupo:</strong> ${escapeHtml(group ? group.name : "-")}</div>
    <div><strong>Fecha:</strong> ${escapeHtml(formatTs(ticket.createdAt))}</div>
    <div><strong>Detalle:</strong></div>
    <div>${escapeHtml(ticket.detail)}</div>
  `;
  if (ctx.elements.ticketResolveBtn) ctx.elements.ticketResolveBtn.style.display = readonly ? "none" : "";
  ctx.state.activeTicketId = readonly ? null : ticketId;
  setOverlay(ctx.elements.ticketModal, true);
}

export function openSessionModal(ctx, { studentId, dayKey, taskTitle, sessionId, taskId, readonly = false, dotColor = "pending", isAlreadyReviewed = false }) {
  openSessionDrawer(ctx, { studentId, dayKey, taskTitle, sessionId, taskId, readonly, dotColor, isAlreadyReviewed });
}

export function closeTicketModal(ctx) {
  setOverlay(ctx.elements.ticketModal, false);
  ctx.state.activeTicketId = null;
}

export async function resolveTicket(ctx, ticketId) {
  const ticket = ctx.state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;
  const res = await apiFetch("/api/v1/tickets", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ticketId, status: "resolved" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/login";
      return;
    }
    const rid = getRequestId(body);
    alert(`Error resolviendo ticket${rid ? ` (ref: ${rid})` : ""}`);
    return;
  }
  ticket.status = "resolved";
  const student = ctx.state.data.students.find(item => item.id === ticket.studentId);
  if (student && student.status === "needs_teacher") {
    student.status = "pending";
  }
  ctx.saveData();
  renderTickets(ctx);
}

export function handleTicketActions(ctx, event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const ticketId = button.dataset.ticketId;
  if (button.dataset.action === "open") {
    openTicketModal(ctx, ticketId);
  }
  if (button.dataset.action === "resolve") {
    resolveTicket(ctx, ticketId);
  }
}
