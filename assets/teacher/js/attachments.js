import { putFile, getFile, deleteFile } from "../../shared/js/filesStore.js";
import { formatFileSize } from "./utils.js";

let pendingAttachments = [];

function generateId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function resetPendingAttachments() {
  pendingAttachments = [];
}

export function renderPendingAttachments(ctx) {
  if (!ctx.elements.taskAttachmentList) return;
  ctx.elements.taskAttachmentList.innerHTML = "";
  pendingAttachments.forEach(item => {
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName">${item.file.name}</div>
        <div class="attachmentMeta">${formatFileSize(item.file.size)}</div>
      </div>
      <button class="btn ghost" data-attachment-id="${item.id}" type="button">Quitar</button>
    `;
    ctx.elements.taskAttachmentList.appendChild(li);
  });
  ctx.elements.taskAttachmentEmpty.style.display = pendingAttachments.length ? "none" : "block";
}

export function handleAttachmentInput(ctx, event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    pendingAttachments.push({ id: generateId(), file });
  });
  event.target.value = "";
  renderPendingAttachments(ctx);
}

export function handleAttachmentRemove(ctx, event) {
  const button = event.target.closest("button[data-attachment-id]");
  if (!button) return;
  const id = button.dataset.attachmentId;
  pendingAttachments = pendingAttachments.filter(item => item.id !== id);
  renderPendingAttachments(ctx);
}

export async function handleAttachmentAction(ctx, event) {
  const button = event.target.closest("button[data-file-action]");
  if (!button) return;
  const id = button.dataset.fileId;
  const action = button.dataset.fileAction;
  try {
    if (action === "remove") {
      const task = ctx.state.data.tasks.find(item => item.id === ctx.state.activeTaskId);
      if (!task) return;
      task.attachments = (task.attachments || []).filter(file => file.id !== id);
      try {
        await deleteFile(id);
      } catch (error) {
        console.warn("No se pudo borrar adjunto:", error);
      }
      ctx.saveData();
      ctx.renderTaskDetailAttachments(task.attachments || []);
      return;
    }
    const record = await getFile(id);
    if (!record || !record.blob) return;
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = record.name || "adjunto";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.warn("No se pudo abrir el adjunto:", error);
  }
}

export async function persistPendingAttachments() {
  const attachments = [];
  for (const item of pendingAttachments) {
    try {
      await putFile({
        id: item.id,
        name: item.file.name,
        type: item.file.type,
        size: item.file.size,
        blob: item.file
      });
      attachments.push({
        id: item.id,
        name: item.file.name,
        type: item.file.type,
        size: item.file.size
      });
    } catch (error) {
      console.warn("No se pudo guardar adjunto:", error);
    }
  }
  return attachments;
}
