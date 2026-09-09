import { STATUS_CONFIG, STATUS_ORDER, compareBySurname, normalizeStudent, formatStudentName } from "./state.js";
import { apiFetch, clearSession } from "../../shared/js/auth.js";
import { escapeHtml } from "./utils.js";

function getRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

function renderPendingList(ctx, students) {
  const { elements } = ctx;
  elements.studentList.innerHTML = "";
  students.forEach((student) => {
    const item = document.createElement("div");
    item.className = "studentItem";
    item.dataset.studentId = student.id;
    item.innerHTML = `
      <div class="studentInfo">
        <span class="statusDot">🕒</span>
        <div>
          <div class="studentName">${escapeHtml(formatStudentName(student))}</div>
          <div class="studentMeta">Pendiente de que lo apruebe el administrador</div>
        </div>
      </div>
    `;
    elements.studentList.appendChild(item);
  });
}

function renderRejectedList(ctx, students) {
  const { elements } = ctx;
  elements.studentList.innerHTML = "";
  students.forEach((student) => {
    const item = document.createElement("div");
    item.className = "studentItem";
    item.dataset.studentId = student.id;
    const reason = student.rejected_reason ? ` · ${student.rejected_reason}` : "";
    const when = student.rejected_at ? ` · ${new Date(student.rejected_at).toLocaleDateString("es-ES")}` : "";
    item.innerHTML = `
      <div class="studentInfo">
        <span class="statusDot">⛔</span>
        <div>
          <div class="studentName">${escapeHtml(formatStudentName(student))}</div>
          <div class="studentMeta">Rechazado${escapeHtml(reason)}${escapeHtml(when)}</div>
        </div>
      </div>
      <div class="studentActionsRow">
        <button class="btn ghost" data-action="delete" data-student-id="${student.id}" type="button">Eliminar ahora</button>
      </div>
    `;
    elements.studentList.appendChild(item);
  });
}

export function renderStudents(ctx) {
  const { state, elements } = ctx;
  if (!elements.studentList) return;
  const groupId = state.currentGroupId;
  const students = state.data.students
    .filter(student => student.tenantId === state.tenantId && student.groupId === groupId)
    .map(student => normalizeStudent(student));

  elements.studentList.innerHTML = "";

  const approvalView = state.studentApprovalView || "pending";
  const approved = students.filter(s => !s.approval_status || s.approval_status === "approved");
  const pending = students.filter(s => s.approval_status === "pending");
  const rejected = students.filter(s => s.approval_status === "rejected");

  if (approvalView === "pending") {
    renderPendingList(ctx, pending);
    elements.studentEmpty.style.display = pending.length ? "none" : "block";
    return;
  }
  if (approvalView === "rejected") {
    renderRejectedList(ctx, rejected);
    elements.studentEmpty.style.display = rejected.length ? "none" : "block";
    return;
  }

  if (state.studentOrder === "surname") {
    const ordered = [...approved].sort(compareBySurname);
    ordered.forEach(student => {
      elements.studentList.appendChild(renderStudentItem(student));
    });
  } else {
    STATUS_ORDER.forEach(statusKey => {
      const group = approved.filter(student => student.status === statusKey).sort(compareBySurname);
      if (!group.length) return;
      const section = document.createElement("div");
      section.className = "studentGroup";
      section.dataset.group = statusKey;
      const header = document.createElement("div");
      header.className = "studentGroupHeader";
      const isOpen = Boolean(state.studentGroupOpen[statusKey]);
      header.innerHTML = `
        <button class="studentGroupToggle" type="button" data-group="${escapeHtml(statusKey)}">
          <span>${escapeHtml(STATUS_CONFIG[statusKey].label)} (${group.length})</span>
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

  elements.studentEmpty.style.display = approved.length ? "none" : "block";
}

export function renderStudentItem(student) {
  const status = STATUS_CONFIG[student.status] || STATUS_CONFIG.pending;
  const item = document.createElement("div");
  item.className = "studentItem";
  item.innerHTML = `
    <div class="studentInfo">
      <span class="statusDot">${status.emoji}</span>
      <div>
        <div class="studentName">${escapeHtml(formatStudentName(student))}</div>
        <div class="studentMeta">${escapeHtml(status.label)}</div>
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
  const nextStatus = select.value;
  apiFetch("/api/v1/students", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: student.id, status: nextStatus }),
  })
    .then((res) => res.json().then((body) => ({ res, body })))
    .then(({ res, body }) => {
      if (!res.ok) {
        if (res.status === 401 || body?.error?.code === "unauthorized") {
          clearSession();
          window.location.href = "/login";
          return;
        }
        const rid = getRequestId(body);
        alert(`Error actualizando alumno${rid ? ` (ref: ${rid})` : ""}`);
        select.value = student.status;
        return;
      }
      student.status = nextStatus;
      ctx.renderStudents();
      ctx.refreshNotebookForActiveGroup?.();
    })
    .catch(() => {
      select.value = student.status;
    });
}

// AQUÍ VIVÍAN handleStudentApprovalAction y handleStudentSubmit — aprobar,
// rechazar, borrar y dar de alta a un alumno desde el panel del profesor.
// Se borraron el 09/09/2026 por dos motivos que se acumulan:
//
// 1. ERAN CÓDIGO MUERTO. De este módulo solo se importa `renderStudents`
//    (ver assets/teacher/teacher.js); nadie enganchaba esos handlers, y los
//    diálogos que buscaban —approveStudentModal, rejectStudentModal— no
//    existen en el HTML del profesor. Los botones "Aprobar" y "Rechazar" se
//    pintaban y no hacían nada al pulsarlos: peor que no estar.
// 2. NO ERAN SUYAS. En un instituto es el admin quien asigna profesores y
//    clases, así que dar de alta y borrar alumnos —que se lleva su
//    expediente— es de secretaría (Jorge, 09/09/2026). El backend ya lo
//    impide: POST y DELETE de /api/v1/students son `roles: ["admin"]`.
//
// La aprobación de verdad está en el panel de admin
// (assets/admin/modules/admin-student-approval.js), contra
// /api/v1/admin/students/:id, que siempre fue solo de admin.
