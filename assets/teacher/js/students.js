import { STATUS_CONFIG, STATUS_ORDER, compareBySurname, normalizeStudent, formatStudentName } from "./state.js";
import { apiFetch, clearSession, getTenantSlug } from "../../shared/js/auth.js";
import { getActiveGroupId } from "../../shared/js/groupState.js";

function getRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

function getTenant() {
  return getTenantSlug() || "";
}

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
          window.location.href = "/index.html";
          return;
        }
        const rid = getRequestId(body);
        alert(`Error actualizando alumno${rid ? ` (ref: ${rid})` : ""}`);
        select.value = student.status;
        return;
      }
      student.status = nextStatus;
      ctx.renderStudents();
    })
    .catch(() => {
      select.value = student.status;
    });
}

export function handleStudentSubmit(ctx, event) {
  event.preventDefault();
  const name = ctx.elements.studentName.value.trim();
  const surname = ctx.elements.studentSurname.value.trim();
  const groupId = getActiveGroupId(getTenant());
  const errorEl = ctx.elements.studentCreateError;
  if (errorEl) errorEl.textContent = "";
  if (!name || !surname || !groupId) {
    if (errorEl) errorEl.textContent = "Completa nombre, apellidos y selecciona un grupo.";
    return;
  }
  const displayName = `${name} ${surname}`.trim();
  apiFetch("/api/v1/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ display_name: displayName, group_id: groupId }),
  })
    .then((res) => res.json().then((body) => ({ res, body })))
    .then(({ res, body }) => {
      if (!res.ok) {
        if (res.status === 401 || body?.error?.code === "unauthorized") {
          clearSession();
          window.location.href = "/index.html";
          return;
        }
        const rid = getRequestId(body);
        if (errorEl) {
          errorEl.textContent = `Error creando alumno${rid ? ` (ref: ${rid})` : ""}`;
        }
        return;
      }
      if (errorEl) errorEl.textContent = "";
      ctx.closeStudentModal();
      ctx.loadStudentsForActiveGroup?.();
    })
    .catch(() => {
      if (errorEl) errorEl.textContent = "Error creando alumno.";
    });
}
