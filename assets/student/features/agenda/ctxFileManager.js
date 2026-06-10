import { apiFetch } from "../../../shared/js/auth.js";
import { setCtxAttachment } from "./taskContext.js";
import { truncateName, inferMimeType, renderPdfThumb } from "./agendaUtils.js";

let _ctxFilePickHandler = null;
let _ctxUploadBtnWired  = false;

export function bindCtxFilePickListener(taskId = null) {
  const ctxFilePick = document.getElementById("ctxFilePick");
  if (!ctxFilePick) return;

  if (!_ctxUploadBtnWired) {
    const btnCtxUpload = document.getElementById("btnCtxUpload");
    if (btnCtxUpload) {
      btnCtxUpload.addEventListener("click", () => ctxFilePick.click());
    }
    _ctxUploadBtnWired = true;
  }

  if (_ctxFilePickHandler) {
    ctxFilePick.removeEventListener("change", _ctxFilePickHandler);
  }

  _ctxFilePickHandler = async () => {
    const file = ctxFilePick.files?.[0];
    if (!file) {
      _clearPreview();
      return;
    }
    await showCtxFilePreview(file, taskId);
  };

  ctxFilePick.addEventListener("change", _ctxFilePickHandler);
  try { ctxFilePick.value = ""; } catch {}
}

function _clearPreview() {
  const previewEl = document.getElementById("ctxFilePreview");
  const uploadArea = document.getElementById("ctxUploadArea");
  const teacherFilesEl = document.getElementById("ctxTeacherFiles");
  if (previewEl) { previewEl.hidden = true; previewEl.innerHTML = ""; }
  if (uploadArea && (!teacherFilesEl || teacherFilesEl.hidden)) uploadArea.style.display = "";
}

export async function showCtxFilePreview(file, taskId, { skipUpload = false } = {}) {
  const previewEl = document.getElementById("ctxFilePreview");
  const uploadArea = document.getElementById("ctxUploadArea");
  if (!previewEl) return;

  previewEl.innerHTML = "";
  previewEl.hidden = false;
  if (uploadArea) uploadArea.style.display = "none";

  const blobUrl = URL.createObjectURL(file);
  const wrap = document.createElement("div");
  wrap.className = "ctx-file-preview-wrap";

  const doClear = () => {
    _clearPreview();
    setCtxAttachment(null);
    if (taskId) {
      localStorage.removeItem(`ctxFiles_${taskId}`);
      localStorage.removeItem(`ctxFile_${taskId}`);
    }
  };

  const makeClearBtn = () => {
    const btn = document.createElement("button");
    btn.className = "ctx-preview-clear";
    btn.textContent = "✕";
    btn.addEventListener("click", doClear);
    return btn;
  };

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.className = "ctx-file-img";
    img.src = blobUrl;
    img.addEventListener("click", () => window.open(blobUrl, "_blank"));
    wrap.appendChild(img);
    wrap.appendChild(makeClearBtn());
    previewEl.appendChild(wrap);
  } else if (file.type === "application/pdf") {
    const canvas = await renderPdfThumb(file);
    if (canvas) {
      canvas.addEventListener("click", () => window.open(blobUrl, "_blank"));
      wrap.appendChild(canvas);
      wrap.appendChild(makeClearBtn());
    } else {
      _showFallbackPill(file.name, file.type, blobUrl, taskId, wrap, doClear);
    }
    previewEl.appendChild(wrap);
  } else {
    _showFallbackPill(file.name, file.type, blobUrl, taskId, wrap, doClear);
    previewEl.appendChild(wrap);
  }

  if (!skipUpload && taskId) {
    const prevEntries = _readCtxFiles(taskId);
    if (prevEntries.length > 0) _fetchAndAppendHistoryPills(prevEntries, taskId, previewEl);
    _uploadCtxFile(file, taskId).catch(console.error);
  }
}

function _readCtxFiles(taskId) {
  try {
    const raw = localStorage.getItem(`ctxFiles_${taskId}`) || localStorage.getItem(`ctxFile_${taskId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed?.attachmentId ? [parsed] : []);
  } catch { return []; }
}

function _saveCtxFiles(taskId, entries) {
  const seen = new Set();
  const deduped = entries.filter(e => e?.attachmentId && !seen.has(e.attachmentId) && seen.add(e.attachmentId));
  localStorage.setItem(`ctxFiles_${taskId}`, JSON.stringify(deduped));
  localStorage.removeItem(`ctxFile_${taskId}`);
}

async function _uploadCtxFile(file, taskId) {
  const dataUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  const res = await apiFetch("/api/v1/attachments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId, file_name: file.name, mime: file.type || "application/octet-stream", data: dataUrl, role: "statement" }),
  });
  const body = await res.json();
  const att = body?.data;
  if (!att?.id) throw new Error("no id");

  const newEntry = { attachmentId: att.id, file_name: att.file_name || file.name, mime: att.mime || file.type };
  _saveCtxFiles(taskId, [newEntry, ..._readCtxFiles(taskId)]);
  setCtxAttachment({ id: att.id, mime: att.mime, file_name: att.file_name });
}

async function _fetchAndAppendHistoryPills(entries, taskId, previewEl) {
  const loadingEl = document.createElement("p");
  loadingEl.textContent = "Cargando archivos anteriores...";
  loadingEl.className = "ctx-history-loading";
  previewEl.appendChild(loadingEl);

  for (const entry of entries) {
    if (!entry?.attachmentId || previewEl.querySelector(`[data-attachment-id="${entry.attachmentId}"]`)) continue;
    try {
      const r = await apiFetch(`/api/v1/attachments/${entry.attachmentId}/signed-url`);
      if (!r.ok) continue;
      const body = await r.json();
      const url = body?.data?.url;
      if (url) _appendHistoryPill(body.data.file_name || entry.file_name, entry.mime, url, entry.attachmentId, taskId, previewEl);
    } catch {}
  }
  loadingEl.remove();
}

export async function restoreCtxFile(taskId) {
  const previewEl = document.getElementById("ctxFilePreview");
  const entries = _readCtxFiles(taskId);
  if (entries.length === 0 || !previewEl) return;

  const resolved = [];
  const keep = [];
  for (const entry of entries) {
    try {
      const r = await apiFetch(`/api/v1/attachments/${entry.attachmentId}/signed-url`);
      if (!r.ok) continue;
      const url = (await r.json())?.data?.url;
      if (url) { resolved.push({ entry, url }); keep.push(entry); }
    } catch { keep.push(entry); }
  }

  _saveCtxFiles(taskId, keep);
  if (resolved.length === 0) return;

  const { entry: main, url: mainUrl } = resolved[0];
  const blob = await (await fetch(mainUrl)).blob();
  const file = new File([blob], main.file_name, { type: main.mime || inferMimeType(main.file_name) });
  
  await showCtxFilePreview(file, taskId, { skipUpload: true });
  setCtxAttachment({ id: main.attachmentId, mime: main.mime, file_name: main.file_name });

  for (const { entry, url } of resolved.slice(1)) {
    _appendHistoryPill(entry.file_name, entry.mime, url, entry.attachmentId, taskId, previewEl);
  }
}

function _appendHistoryPill(fileName, mime, signedUrl, attachmentId, taskId, previewEl) {
  const wrap = document.createElement("div");
  wrap.dataset.attachmentId = attachmentId;
  const item = document.createElement("div");
  item.className = "ctx-attach-item";
  
  const nameEl = document.createElement("span");
  nameEl.className = "ctx-attach-name";
  nameEl.textContent = truncateName(fileName);

  const btns = document.createElement("div");
  btns.className = "ctx-attach-btns";

  const openBtn = document.createElement("button");
  openBtn.textContent = "Abrir";
  openBtn.onclick = () => window.open(signedUrl, "_blank");

  const sendBtn = document.createElement("button");
  sendBtn.textContent = "Enviar";
  sendBtn.onclick = () => {
    setCtxAttachment({ id: attachmentId, mime, file_name: fileName });
    showToast("Archivo enviado");
  };

  btns.append(openBtn, sendBtn);
  item.append(nameEl, btns);
  wrap.appendChild(item);
  previewEl.appendChild(wrap);
}

function _showFallbackPill(fileName, mime, openUrl, taskId, wrap, doClear) {
  const item = document.createElement("div");
  item.className = "ctx-attach-item";
  const nameEl = document.createElement("span");
  nameEl.textContent = truncateName(fileName);
  
  const openBtn = document.createElement("button");
  openBtn.textContent = "Abrir";
  openBtn.onclick = () => window.open(openUrl, "_blank");

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.onclick = doClear;

  item.append(nameEl, openBtn, closeBtn);
  wrap.appendChild(item);
}

export function showToast(msg) {
  const toast = document.createElement("div");
  toast.textContent = msg;
  toast.className = "ttd-toast";
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 350);
  }, 1800);
}