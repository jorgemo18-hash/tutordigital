import { parseDate, formatDate, addDays, formatFileSize } from "./utils.js";
import { TYPE_LABELS } from "./state.js";
import { setOverlay } from "./dom.js";
import { deleteFile } from "../../shared/js/filesStore.js";
import { persistPendingAttachments, resetPendingAttachments, renderPendingAttachments } from "./attachments.js";

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

  return ctx.state.data.tasks.filter(task => {
    if (task.groupId !== groupId) return false;
    const due = parseDate(task.dueDate);
    return due >= start && due <= end;
  });
}

export function taskMeta(ctx, task) {
  const group = ctx.state.data.groups.find(g => g.id === task.groupId);
  const due = parseDate(task.dueDate);
  const label = due.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  return `${label} · ${group ? group.name : "Grupo"}`;
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
      <div class="taskTitle">${task.title}</div>
      <div class="taskMeta">${taskMeta(ctx, task)}</div>
      ${attachmentCount ? `<span class="taskChip">📎 ${attachmentCount} adjunto${attachmentCount === 1 ? "" : "s"}</span>` : ""}
      ${task.desc ? `<div class="taskMeta">${task.desc}</div>` : ""}
    `;
    container.appendChild(item);
  });
}

export function setRange(ctx, range) {
  ctx.state.range = range;
  ctx.elements.tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.range === range);
  });
  renderPlanner(ctx);
}

export function openTaskDetailModal(ctx, taskId) {
  const task = ctx.state.data.tasks.find(item => item.id === taskId);
  if (!task) return;
  const group = ctx.state.data.groups.find(item => item.id === task.groupId);
  ctx.elements.taskDetailTitle.textContent = task.title;
  ctx.elements.taskDetailBody.innerHTML = `
    <div><strong>Tipo:</strong> ${TYPE_LABELS[task.type] || "Tarea"}</div>
    <div><strong>Grupo:</strong> ${group ? group.name : "-"}</div>
    <div><strong>Entrega:</strong> ${task.dueDate}</div>
    ${task.desc ? `<div><strong>Descripción:</strong></div><div>${task.desc}</div>` : ""}
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
        <div class="attachmentName">${file.name}</div>
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

  ctx.state.data.tasks.splice(taskIndex, 1);
  if (ctx.state.data.taskStatus && typeof ctx.state.data.taskStatus === "object") {
    delete ctx.state.data.taskStatus[taskId];
  }

  ctx.saveData();
  renderPlanner(ctx);
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

export async function handleTaskSubmit(ctx, event) {
  event.preventDefault();
  const type = ctx.elements.taskType.value;
  const title = ctx.elements.taskTitle.value.trim();
  const dueDate = ctx.elements.taskDate.value;
  const desc = ctx.elements.taskDesc.value.trim();
  const groupId = ctx.elements.taskGroup.value;

  if (!title || !dueDate || !groupId) return;

  const attachments = await persistPendingAttachments();

  ctx.state.data.tasks.push({
    id: `t${Date.now()}`,
    type,
    title,
    dueDate,
    desc,
    groupId,
    attachments,
    createdAt: Date.now()
  });

  ctx.saveData();
  resetPendingAttachments();
  renderPendingAttachments(ctx);
  ctx.closeTaskModal();
  ctx.refreshData();
  renderPlanner(ctx);
  ctx.renderTickets();
  ctx.renderStudents();
}
