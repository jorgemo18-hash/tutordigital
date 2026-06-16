// Mobile homework prep screen.
// Shown on mobile when task type='homework' and no teacher attachment exists.
// Collects the student's enunciado files before the AI session starts.

import { uploadPrepFile, readPrepFiles } from "./prepUpload.js";

function truncateName(name) {
  return name.length > 22 ? name.slice(0, 21) + "…" : name;
}

function buildThumb(file, blobUrl, onRemove) {
  const wrap = document.createElement("div");
  wrap.className = "mhp-thumb";

  if (file.type.startsWith("image/")) {
    const img = document.createElement("img");
    img.src       = blobUrl;
    img.className = "mhp-thumb-img";
    img.alt       = file.name;
    wrap.appendChild(img);
  } else {
    const badge = document.createElement("div");
    badge.className   = "mhp-thumb-pdf";
    badge.textContent = "PDF";
    wrap.appendChild(badge);
  }

  const name = document.createElement("span");
  name.className   = "mhp-thumb-name";
  name.textContent = truncateName(file.name);
  wrap.appendChild(name);

  const removeBtn = document.createElement("button");
  removeBtn.type      = "button";
  removeBtn.className = "mhp-thumb-remove";
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", `Eliminar ${file.name}`);
  removeBtn.addEventListener("click", () => { wrap.remove(); onRemove(); });
  wrap.appendChild(removeBtn);

  return wrap;
}

// Returns true when the mobile prep screen should appear instead of jumping straight to chat.
export function needsMobileHomeworkPrep({ isMobile, tipo, attachments, taskId }) {
  if (!isMobile) return false;
  if (tipo !== "homework") return false;
  if (attachments?.length > 0) return false;
  return readPrepFiles(taskId).length === 0;
}

// Wires the prep screen DOM once on boot and returns show/hide functions.
// All external dependencies arrive as explicit parameters — no scope closure.
export function initMobileHomeworkPrep({ apiFetch, setCtxAttachment }) {
  const screenEl  = document.getElementById("mobileHomeworkPrep");
  const titleEl   = document.getElementById("mhpTitle");
  const thumbsEl  = document.getElementById("mhpThumbs");
  const startBtn  = document.getElementById("mhpStartBtn");
  const filePick  = document.getElementById("mhpFilePick");
  const dropzoneEl = document.getElementById("mhpDropzone");

  if (!screenEl) return { showPrepScreen: () => {}, hidePrepScreen: () => {} };

  let _taskId  = null;
  let _onStart = null;

  function countThumbs() {
    return thumbsEl?.querySelectorAll(".mhp-thumb").length ?? 0;
  }

  function updateStartBtn() {
    if (startBtn) startBtn.disabled = countThumbs() === 0;
  }

  async function handleFiles(files) {
    for (const file of Array.from(files)) {
      const blobUrl = URL.createObjectURL(file);
      thumbsEl?.appendChild(buildThumb(file, blobUrl, updateStartBtn));
      updateStartBtn();
      uploadPrepFile(file, _taskId, apiFetch)
        .then(entry => {
          setCtxAttachment({ id: entry.attachmentId, mime: entry.mime, file_name: entry.file_name });
        })
        .catch(err => console.error("[mhp] upload failed", err));
    }
  }

  filePick?.addEventListener("change", () => {
    if (filePick.files?.length) handleFiles(filePick.files);
    try { filePick.value = ""; } catch {}
  });

  dropzoneEl?.addEventListener("click", () => filePick?.click());
  dropzoneEl?.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); filePick?.click(); }
  });

  startBtn?.addEventListener("click", () => {
    if (startBtn.disabled) return;
    screenEl.hidden = true;
    document.body.classList.remove("mobile-prep-active");
    _onStart?.();
  });

  // Clean up when the user navigates back to agenda.
  document.getElementById("btnBackToAgenda")?.addEventListener("click", () => {
    screenEl.hidden = true;
    document.body.classList.remove("mobile-prep-active");
  });

  function showPrepScreen({ taskTitle, taskId, onStart }) {
    _taskId  = taskId;
    _onStart = onStart;
    if (titleEl)  titleEl.textContent = taskTitle;
    if (thumbsEl) thumbsEl.innerHTML  = "";
    if (startBtn) startBtn.disabled   = true;
    screenEl.hidden = false;
    document.body.classList.add("mobile-prep-active");
  }

  function hidePrepScreen() {
    screenEl.hidden = true;
    document.body.classList.remove("mobile-prep-active");
  }

  return { showPrepScreen, hidePrepScreen };
}
