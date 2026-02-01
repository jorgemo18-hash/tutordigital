import { formatStudentName, normalizeStudent } from "./state.js";
import { setOverlay } from "./dom.js";

export function renderTickets(ctx) {
  const groupId = ctx.state.currentGroupId;
  const openTickets = ctx.state.data.tickets.filter(ticket => ticket.status === "open" && ticket.groupId === groupId);

  ctx.elements.ticketList.innerHTML = "";

  openTickets.forEach(ticket => {
    const student = normalizeStudent(ctx.state.data.students.find(item => item.id === ticket.studentId));
    const item = document.createElement("li");
    item.className = "ticketItem";
    item.innerHTML = `
      <div class="ticketInfo">
        <div class="ticketTitle">${ticket.title}</div>
        <div class="ticketMeta">${student ? formatStudentName(student) : "Alumno"} · ${ticket.createdAt}</div>
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

export function openTicketModal(ctx, ticketId) {
  const ticket = ctx.state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;

  const student = normalizeStudent(ctx.state.data.students.find(item => item.id === ticket.studentId));
  const group = ctx.state.data.groups.find(item => item.id === ticket.groupId);
  ctx.elements.ticketTitle.textContent = ticket.title;
  ctx.elements.ticketDetail.innerHTML = `
    <div><strong>Alumno:</strong> ${student ? formatStudentName(student) : "-"}</div>
    <div><strong>Grupo:</strong> ${group ? group.name : "-"}</div>
    <div><strong>Fecha:</strong> ${ticket.createdAt}</div>
    <div><strong>Detalle:</strong></div>
    <div>${ticket.detail}</div>
  `;
  ctx.state.activeTicketId = ticketId;
  setOverlay(ctx.elements.ticketModal, true);
}

export function closeTicketModal(ctx) {
  setOverlay(ctx.elements.ticketModal, false);
  ctx.state.activeTicketId = null;
}

export function resolveTicket(ctx, ticketId) {
  const ticket = ctx.state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;
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
