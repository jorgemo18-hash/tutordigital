import { STATUS_CONFIG, STATUS_ORDER, compareBySurname, normalizeStudent, formatStudentName } from "./state.js";
import { formatDate } from "./utils.js";

export function renderStudents(ctx) {
  const { state, elements } = ctx;
  const groupId = state.currentGroupId;
  const students = state.data.students
    .filter(student => student.tenantId === state.tenantId && student.groupId === groupId)
    .map(student => normalizeStudent(student));

  elements.studentList.innerHTML = "";

  if (state.studentOrder === "surname") {
    const ordered = [...students].sort(compareBySurname);
    ordered.forEach(student => {
      elements.studentList.appendChild(renderStudentItem(student));
    });
  } else {
    STATUS_ORDER.forEach(statusKey => {
      const group = students.filter(student => student.status === statusKey).sort(compareBySurname);
      if (!group.length) return;
      const section = document.createElement("div");
      section.className = "studentGroup";
      section.dataset.group = statusKey;
      const header = document.createElement("div");
      header.className = "studentGroupHeader";
      const isOpen = Boolean(state.studentGroupOpen[statusKey]);
      header.innerHTML = `
        <button class="studentGroupToggle" type="button" data-group="${statusKey}">
          <span>${STATUS_CONFIG[statusKey].label} (${group.length})</span>
          <span class="toggleIcon">${isOpen ? "−" : "+"}</span>
        </button>
      `;
      section.appendChild(header);
      const content = document.createElement("div");
      content.className = "studentGroupBody";
      if (!isOpen) {
        content.setAttribute("hidden", "hidden");
        content.style.display = "none";
      } else {
        content.removeAttribute("hidden");
        content.style.display = "flex";
      }
      group.forEach(student => {
        content.appendChild(renderStudentItem(student));
      });
      section.appendChild(content);
      elements.studentList.appendChild(section);
    });
  }

  elements.studentEmpty.style.display = students.length ? "none" : "block";
}

export function renderStudentItem(student) {
  const status = STATUS_CONFIG[student.status] || STATUS_CONFIG.pending;
  const item = document.createElement("div");
  item.className = "studentItem";
  item.innerHTML = `
    <div class="studentInfo">
      <span class="statusDot">${status.emoji}</span>
      <div>
        <div class="studentName">${formatStudentName(student)}</div>
        <div class="studentMeta">${status.label}</div>
      </div>
    </div>
    <select class="statusSelect copper-chip" data-student-id="${student.id}">
      <option value="pending">Pendiente</option>
      <option value="submitted">Ok</option>
      <option value="needs_teacher">Necesita profesor</option>
    </select>
  `;
  const select = item.querySelector("select");
  select.value = student.status;
  return item;
}

export function handleStudentStatusChange(ctx, event) {
  const select = event.target.closest(".statusSelect");
  if (!select) return;
  const student = ctx.state.data.students.find(item => item.id === select.dataset.studentId);
  if (!student) return;
  student.status = select.value;
  const groupId = student.groupId;
  if (student.status === "needs_teacher") {
    const hasOpen = ctx.state.data.tickets.some(ticket => (
      ticket.studentId === student.id &&
      ticket.groupId === groupId &&
      ticket.status === "open" &&
      ticket.teacherId === ctx.state.currentTeacherId &&
      ticket.tenantId === ctx.state.tenantId
    ));
    if (!hasOpen) {
      ctx.state.data.tickets.push({
        id: `k${Date.now()}`,
        title: `Necesita profesor · ${student.firstName || student.name}`,
        detail: "Marcado desde alumnos.",
        studentId: student.id,
        groupId,
        status: "open",
        createdAt: formatDate(new Date()),
        teacherId: ctx.state.currentTeacherId,
        tenantId: ctx.state.tenantId
      });
    }
  } else {
    ctx.state.data.tickets.forEach(ticket => {
      if (
        ticket.studentId === student.id &&
        ticket.groupId === groupId &&
        ticket.status === "open" &&
        ticket.teacherId === ctx.state.currentTeacherId &&
        ticket.tenantId === ctx.state.tenantId
      ) {
        ticket.status = "resolved";
      }
    });
  }
  ctx.saveData();
  ctx.renderStudents();
  ctx.renderTickets();
}

export function handleStudentSubmit(ctx, event) {
  event.preventDefault();
  const name = ctx.elements.studentName.value.trim();
  const surname = ctx.elements.studentSurname.value.trim();
  const groupId = ctx.elements.studentGroup.value;
  if (!name || !surname || !groupId) return;

  ctx.state.data.students.push({
    id: `s${Date.now()}`,
    firstName: name,
    lastName: surname,
    name: `${name} ${surname}`.trim(),
    groupId,
    status: "pending",
    tenantId: ctx.state.tenantId
  });

  ctx.saveData();
  ctx.closeStudentModal();
  ctx.refreshData();
  ctx.renderStudents();
  ctx.renderTickets();
}
