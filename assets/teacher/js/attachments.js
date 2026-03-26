import { getFile, deleteFile } from "../../shared/js/filesStore.js";
import { apiFetch } from "../../shared/js/auth.js";
import { formatFileSize } from "./utils.js";

let pendingAttachments = [];

function generateLocalId() {
  return (crypto && typeof crypto.randomUUID === "function")
    ? crypto.randomUUID()
    : `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
      <button class="btn ghost" data-attachment-id="${item.localId}" type="button">Quitar</button>
    `;
    ctx.elements.taskAttachmentList.appendChild(li);
  });
  ctx.elements.taskAttachmentEmpty.style.display = pendingAttachments.length ? "none" : "block";
}

export function handleAttachmentInput(ctx, event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    pendingAttachments.push({ localId: generateLocalId(), file });
  });
  event.target.value = "";
  renderPendingAttachments(ctx);
}

export function handleAttachmentRemove(ctx, event) {
  const button = event.target.closest("button[data-attachment-id]");
  if (!button) return;
  const id = button.dataset.attachmentId;
  pendingAttachments = pendingAttachments.filter(item => item.localId !== id);
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
      // Borrar del servidor si tiene storage_path (fue subido a Supabase)
      const hadStoragePath = (task.attachments || []).find(f => f.id === id)?.storage_path;
      try {
        await apiFetch(`/api/v1/attachments/${id}`, { method: "DELETE" });
      } catch {}
      // Compatibilidad: intentar borrar también de IndexedDB (adjuntos viejos)
      try { await deleteFile(id); } catch {}
      ctx.saveData();
      ctx.renderTaskDetailAttachments(task.attachments || []);
      return;
    }

    // Descargar: primero intentar URL firmada del servidor
    try {
      const r = await apiFetch(`/api/v1/attachments/${id}/signed-url`);
      if (r.ok) {
        const body = await r.json().catch(() => ({}));
        const url = body?.data?.url;
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.download = body?.data?.file_name || "adjunto";
          link.target = "_blank";
          document.body.appendChild(link);
          link.click();
          link.remove();
          return;
        }
      }
    } catch {}

    // Fallback: IndexedDB (adjuntos viejos antes de la migración)
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

// Sube los adjuntos pendientes al servidor una vez que la tarea ya existe
export async function persistPendingAttachments(taskId) {
  const attachments = [];
  for (const item of pendingAttachments) {
    try {
      const dataUrl = await fileToDataUrl(item.file);
      const res = await apiFetch("/api/v1/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          file_name: item.file.name,
          mime: item.file.type || "application/octet-stream",
          data: dataUrl,
        }),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body?.data) attachments.push(body.data);
      } else {
        console.warn("No se pudo subir adjunto:", item.file.name, res.status);
      }
    } catch (error) {
      console.warn("No se pudo subir adjunto:", error);
    }
  }
  return attachments;
}
