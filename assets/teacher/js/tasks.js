import { parseDate, formatDate, addDays, formatFileSize, escapeHtml } from "./utils.js";
import { TYPE_LABELS } from "./state.js";
import { setOverlay } from "./dom.js";
import { deleteFile } from "../../shared/js/filesStore.js";
import { persistPendingAttachments, resetPendingAttachments, renderPendingAttachments } from "./attachments.js";
import { apiFetch, clearSession } from "../../shared/js/auth.js";

function getRequestId(body) {
  return body?.requestId || body?.request_id || "";
}

function truncateName(name) {
  if (!name || name.length <= 40) return name;
  return name.slice(0, 20) + "..." + name.slice(-15);
}

function mapAttachment(att) {
  if (!att) return att;
  return {
    id: att.id,
    name: att.file_name || att.name || "",
    size: att.size,
    type: att.mime || att.type || "",
    storagePath: att.storage_path || att.storagePath || "",
  };
}

export function mapTaskFromApi(item, tenantId, fallbackTeacherId) {
  if (!item) return item;
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    dueDate: item.due_date || item.dueDate || "",
    desc: item.desc ?? item.description ?? null,
    teacherNotes: item.teacher_notes || item.teacherNotes || "",
    groupId: item.group_id || item.groupId || "",
    teacherId: item.teacher_id || item.teacherId || fallbackTeacherId || null,
    tenantId,
    attachments: Array.isArray(item.attachments) ? item.attachments.map(mapAttachment) : [],
    createdAt: item.created_at || item.createdAt || null,
    subjectName: item.subject_name || item.subjectName || "",
  };
}

export function filterTasks(ctx) {
  const groupId = ctx.state.currentGroupId;
  const today = new Date();
  const start = parseDate(formatDate(today));
  let end = start;

  if (ctx.state.range === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
  } else if (ctx.state.range === "week") {
    end = addDays(start, 6);
  }

  const subjectFilter = ctx.state.currentSubjectFilter || "";
  return ctx.state.data.tasks.filter(task => {
    if (task.tenantId !== ctx.state.tenantId) return false;
    if (task.groupId !== groupId) return false;
    if (!task.dueDate) return false;
    if (subjectFilter && (task.subjectName || "") !== subjectFilter) return false;
    const due = parseDate(task.dueDate);
    return due >= start && due <= end;
  });
}

export function taskMeta(ctx, task) {
  const group = ctx.state.data.groups.find(g => g.id === task.groupId);
  const due = parseDate(task.dueDate);
  const label = due.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  return `${escapeHtml(label)} · ${escapeHtml(group ? group.name : "Grupo")}`;
}

export function renderPlanner(ctx) {
  const tasks = filterTasks(ctx);
  const sections = {
    homework: [],
    exam: [],
    work: []
  };

  tasks.forEach(task => {
    if (sections[task.type]) sections[task.type].push(task);
  });

  Object.keys(sections).forEach(type => {
    sections[type].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  });

  renderTaskList(ctx, ctx.elements.taskListHomework, sections.homework);
  renderTaskList(ctx, ctx.elements.taskListExam, sections.exam);
  renderTaskList(ctx, ctx.elements.taskListWork, sections.work);

  ctx.elements.emptyHomework.style.display = sections.homework.length ? "none" : "block";
  ctx.elements.emptyExam.style.display = sections.exam.length ? "none" : "block";
  ctx.elements.emptyWork.style.display = sections.work.length ? "none" : "block";
}

export function renderTaskList(ctx, container, tasks) {
  container.innerHTML = "";
  tasks.forEach(task => {
    const attachmentCount = (task.attachments || []).length;
    const item = document.createElement("div");
    item.className = "taskItem";
    item.dataset.taskId = task.id;
    item.innerHTML = `
      <button class="taskDeleteBtn" data-task-id="${task.id}" type="button" aria-label="Eliminar tarea">✕</button>
      <div class="taskTitle">${escapeHtml(task.title)}</div>
      <div class="taskMeta">${taskMeta(ctx, task)}</div>
      ${attachmentCount ? `<span class="taskChip">📎 ${attachmentCount} adjunto${attachmentCount === 1 ? "" : "s"}</span>` : ""}
      ${task.desc ? `<div class="taskMeta">${escapeHtml(task.desc)}</div>` : ""}
    `;
    container.appendChild(item);
  });
}

export function setRange(ctx, range) {
  ctx.state.range = range;
  ctx.elements.tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.range === range);
  });
  ctx.loadTasksForActiveGroup?.();
}

export function openTaskDetailModal(ctx, taskId) {
  const task = ctx.state.data.tasks.find(item => item.id === taskId);
  if (!task) return;
  const group = ctx.state.data.groups.find(item => item.id === task.groupId);
  ctx.elements.taskDetailTitle.textContent = task.title;
  ctx.elements.taskDetailBody.innerHTML = `
    <div><strong>Tipo:</strong> ${escapeHtml(TYPE_LABELS[task.type] || "Tarea")}</div>
    <div><strong>Grupo:</strong> ${escapeHtml(group ? group.name : "-")}</div>
    <div><strong>Entrega:</strong> ${escapeHtml(task.dueDate)}</div>
    ${task.teacherNotes ? `<div><strong>Nota para el alumno:</strong></div><div>${escapeHtml(task.teacherNotes)}</div>` : ""}
  `;
  renderTaskDetailAttachments(ctx, task.attachments || []);
  ctx.state.activeTaskId = taskId;
  setOverlay(ctx.elements.taskDetailModal, true);
}

export function closeTaskDetailModal(ctx) {
  setOverlay(ctx.elements.taskDetailModal, false);
  ctx.state.activeTaskId = null;
}

export function renderTaskDetailAttachments(ctx, attachments) {
  ctx.elements.taskDetailAttachments.innerHTML = "";
  attachments.forEach(file => {
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName" title="${escapeHtml(file.name)}">${escapeHtml(truncateName(file.name))}</div>
        <div class="attachmentMeta">${formatFileSize(file.size)}</div>
      </div>
      <div class="attachmentActions">
        <button class="btn primary" data-file-action="remove" data-file-id="${file.id}" type="button">Quitar</button>
      </div>
    `;
    ctx.elements.taskDetailAttachments.appendChild(li);
  });
  ctx.elements.taskDetailEmpty.style.display = attachments.length ? "none" : "block";
}

export async function deleteTaskById(ctx, taskId) {
  const taskIndex = ctx.state.data.tasks.findIndex(task => task.id === taskId);
  if (taskIndex === -1) return;

  const task = ctx.state.data.tasks[taskIndex];
  const attachments = task.attachments || [];
  for (const attachment of attachments) {
    try {
      await deleteFile(attachment.id);
    } catch (error) {
      console.warn("No se pudo borrar adjunto:", error);
    }
  }

  const res = await apiFetch(`/api/v1/tasks?id=${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 || body?.error?.code === "unauthorized") {
      clearSession();
      window.location.href = "/login";
      return;
    }
    const rid = getRequestId(body);
    alert(`Error eliminando tarea${rid ? ` (ref: ${rid})` : ""}`);
    return;
  }

  ctx.state.data.tasks.splice(taskIndex, 1);
  if (ctx.state.data.taskStatus && typeof ctx.state.data.taskStatus === "object") {
    delete ctx.state.data.taskStatus[taskId];
  }

  renderPlanner(ctx);
  ctx.refreshNotebookForActiveGroup?.();
}

export function handleTaskDelete(ctx, event) {
  const button = event.target.closest(".taskDeleteBtn");
  if (!button) return false;
  const taskId = button.dataset.taskId;
  if (!taskId) return true;
  const ok = confirm("¿Eliminar esta tarea?");
  if (!ok) return true;
  deleteTaskById(ctx, taskId);
  return true;
}

// ── Validación del formulario de tarea ──────────────────────────────────────

function _showFieldError(input, message) {
  const field = input?.closest?.(".formField");
  if (!field) return;
  field.classList.add("formField--error");
  let msg = field.querySelector(".formField-error-msg");
  if (!msg) {
    msg = document.createElement("span");
    msg.className = "formField-error-msg";
    field.appendChild(msg);
  }
  msg.textContent = message;
  msg.hidden = false;
}

export function clearTaskFormErrors() {
  document.querySelectorAll("#taskForm .formField--error").forEach(field => {
    field.classList.remove("formField--error");
    const msg = field.querySelector(".formField-error-msg");
    if (msg) msg.hidden = true;
  });
}

export async function handleTaskSubmit(ctx, event) {
  event.preventDefault();

  const btn = document.querySelector('[type="submit"][form="taskForm"]');
  if (btn?.disabled) return;

  // Validar antes de deshabilitar el botón para dar feedback inmediato
  const title   = ctx.elements.taskTitle.value.trim();
  const dueDate = ctx.elements.taskDate.value;
  const groupId = ctx.elements.taskGroup.value;

  clearTaskFormErrors();

  let firstInvalid = null;
  if (!title) {
    _showFieldError(ctx.elements.taskTitle, "El título es obligatorio");
    firstInvalid = firstInvalid || ctx.elements.taskTitle;
  }
  if (!dueDate) {
    _showFieldError(ctx.elements.taskDate, "La fecha de entrega es obligatoria");
    firstInvalid = firstInvalid || ctx.elements.taskDate;
  }
  if (!groupId) {
    _showFieldError(ctx.elements.taskGroup, "Selecciona un grupo");
    firstInvalid = firstInvalid || ctx.elements.taskGroup;
  }
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    firstInvalid.focus();
    return;
  }

  let dotInterval = null;

  if (btn) {
    btn.style.minWidth = btn.offsetWidth + "px";
    btn.disabled = true;
    btn.textContent = "Guardando.";
    let dots = 1;
    dotInterval = setInterval(() => {
      dots = (dots % 3) + 1;
      btn.textContent = "Guardando" + ".".repeat(dots);
    }, 400);
  }

  try {
    const type        = ctx.elements.taskType.value;
    const subjectName = ctx.elements.taskSubject?.value?.trim() || "";
    const teacherNotes = ctx.elements.taskNotes?.value?.trim() || "";
    const res = await apiFetch("/api/v1/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_id: groupId,
        type,
        title,
        due_date: dueDate,
        subject_name: subjectName || undefined,
        teacher_notes: teacherNotes || undefined,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || body?.error?.code === "unauthorized") {
        clearSession();
        window.location.href = "/login";
        return;
      }
      const rid = getRequestId(body);
      alert(`Error creando tarea${rid ? ` (ref: ${rid})` : ""}`);
      return;
    }

    const created = mapTaskFromApi(body?.data, ctx.state.tenantId, ctx.state.currentTeacherId);

    // Subir adjuntos al servidor ahora que tenemos el ID de la tarea
    const pendingCount = ctx.elements.taskAttachmentEmpty?.style.display === "none"
      ? (ctx.elements.taskAttachmentList?.querySelectorAll("li")?.length || 0)
      : 0;
    const uploadedAttachments = await persistPendingAttachments(created.id);
    if (uploadedAttachments.length > 0) {
      // mapAttachment normaliza file_name → name (y otros campos) para el estado local
      created.attachments = uploadedAttachments.map(mapAttachment);
    }

    ctx.state.data.tasks.push(created);
    resetPendingAttachments();
    renderPendingAttachments(ctx);
    ctx.closeTaskModal();

    if (pendingCount > 0 && uploadedAttachments.length === 0) {
      alert("La tarea se guardó pero no se pudieron subir los adjuntos. Puede que el archivo sea demasiado grande o haya un error de red.");
    }
    renderPlanner(ctx);
    ctx.refreshNotebookForActiveGroup?.();
  } finally {
    clearInterval(dotInterval);
    if (btn) {
      btn.style.minWidth = "";
      btn.disabled = false;
      btn.textContent = "Guardar";
    }
  }
}
