import { STATUS_CONFIG, STATUS_ORDER, compareBySurname, normalizeStudent, formatStudentName } from "./state.js";
import { apiFetch, clearSession, getTenantSlug } from "../../shared/js/auth.js";
import { getActiveGroupId } from "../../shared/js/groupState.js";
import { escapeHtml } from "./utils.js";

function getRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

function getTenant() {
  return getTenantSlug() || "";
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
          <div class="studentMeta">Pendiente de aprobación</div>
        </div>
      </div>
      <div class="studentActionsRow">
        <button class="btn copper-chip" data-action="approve" data-student-id="${student.id}" type="button">Aprobar</button>
        <button class="btn ghost" data-action="reject" data-student-id="${student.id}" type="button">Rechazar</button>
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
      ctx.loadTicketsForActiveGroup?.();
    })
    .catch(() => {
      select.value = student.status;
    });
}

export function handleStudentApprovalAction(ctx, event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return false;
  const studentId = button.dataset.studentId;
  const action = button.dataset.action;
  if (!studentId || !action) return true;

  if (action === "approve") {
    ctx.state.activeApprovalStudentId = studentId;
    const student = ctx.state.data.students.find(item => item.id === studentId);
    if (ctx.elements.approveStudentName) {
      ctx.elements.approveStudentName.value = formatStudentName(student);
    }
    if (ctx.elements.approveStudentGroup) {
      ctx.elements.approveStudentGroup.innerHTML = "";
      (ctx.state.data.groups || []).forEach(group => {
        const opt = document.createElement("option");
        opt.value = group.id;
        opt.textContent = group.name;
        ctx.elements.approveStudentGroup.appendChild(opt);
      });
      ctx.elements.approveStudentGroup.value = student?.groupId || ctx.state.currentGroupId || "";
    }
    if (ctx.elements.approveStudentError) ctx.elements.approveStudentError.textContent = "";
    ctx.elements.approveStudentModal?.classList.add("open");
    return true;
  }
  if (action === "reject") {
    ctx.state.activeApprovalStudentId = studentId;
    const student = ctx.state.data.students.find(item => item.id === studentId);
    if (ctx.elements.rejectStudentName) {
      ctx.elements.rejectStudentName.value = formatStudentName(student);
    }
    if (ctx.elements.rejectStudentError) ctx.elements.rejectStudentError.textContent = "";
    ctx.elements.rejectStudentModal?.classList.add("open");
    return true;
  }
  if (action === "delete") {
    apiFetch("/api/v1/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: studentId }),
    })
      .then(() => ctx.loadStudentsForActiveGroup?.())
      .catch(() => {});
    return true;
  }
  return true;
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
          window.location.href = "/login";
          return;
        }
        const rid = getRequestId(body);
        if (errorEl) {
          errorEl.textContent = `Error creando alumno${rid ? ` (ref: ${rid})` : ""}`;
        }
        return;
      }
      if (errorEl) errorEl.textContent = "";
      ctx.loadStudentsForActiveGroup?.();
    })
    .catch(() => {
      if (errorEl) errorEl.textContent = "Error creando alumno.";
    });
}
