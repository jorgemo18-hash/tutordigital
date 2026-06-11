import { apiFetch } from "../../../shared/js/auth.js";
import { setCtxAttachment } from "./taskContext.js";
import { slugifySubject, truncateName, renderPdfThumb } from "./agendaUtils.js";
import { bindCtxFilePickListener, restoreCtxFile } from "./ctxFileManager.js";

let _teacherRenderGen = 0;

export function populateContextPane(task) {
  bindCtxFilePickListener(task.id);

  const subjectTagEl = document.getElementById("ctxSubjectTag");
  const taskTitleEl = document.getElementById("ctxTaskTitle");
  const uploadArea = document.getElementById("ctxUploadArea");
  const filePreview = document.getElementById("ctxFilePreview");
  const teacherFilesEl = document.getElementById("ctxTeacherFiles");

  if (subjectTagEl) {
    const label = task.subjectName || task.subject || "";
    subjectTagEl.textContent = label;
    subjectTagEl.className = `ctx-subject-tag td-tag ${slugifySubject(label)}`;
    subjectTagEl.hidden = !label;
  }
  if (taskTitleEl) taskTitleEl.textContent = task.title || "";

  if (filePreview) { filePreview.hidden = true; filePreview.innerHTML = ""; }
  
  setCtxAttachment(null);
  restoreCtxFile(task.id).catch(() => {});

  const teacherAttachments = Array.isArray(task.attachments) ? task.attachments : [];
  if (teacherFilesEl) {
    teacherFilesEl.innerHTML = "";
    if (teacherAttachments.length > 0) {
      if (uploadArea) uploadArea.style.display = "none";
      teacherFilesEl.hidden = false;
      const loadingEl = document.createElement("p");
      loadingEl.textContent = "Cargando...";
      teacherFilesEl.appendChild(loadingEl);
      _renderTeacherAttachments(teacherAttachments, teacherFilesEl, loadingEl, ++_teacherRenderGen);
    } else {
      teacherFilesEl.hidden = true;
      if (uploadArea) uploadArea.style.display = "";
    }
  }
}

async function _renderTeacherAttachments(attachments, containerEl, loadingEl, gen) {
  for (const att of attachments) {
    if (_teacherRenderGen !== gen) { loadingEl.remove(); return; }
    try {
      const r = await apiFetch(`/api/v1/attachments/${att.id}/signed-url`);
      if (_teacherRenderGen !== gen) { loadingEl.remove(); return; }
      const body = await r.json();
      if (body?.data?.url) await _appendTeacherPreview(body.data.file_name || att.file_name, body.data.mime || att.mime, body.data.url, att.id, containerEl, loadingEl);
    } catch {}
  }
  if (_teacherRenderGen === gen) loadingEl.remove();
}

async function _appendTeacherPreview(fileName, mime, signedUrl, attachmentId, containerEl, loadingEl) {
  const wrap = document.createElement("div");
  wrap.className = "ctx-teacher-preview";
  
  let thumbEl = null;
  if (mime === "application/pdf") {
    const blob = await (await fetch(signedUrl)).blob();
    thumbEl = await renderPdfThumb(new File([blob], fileName, { type: mime }));
  } else if (mime.startsWith("image/")) {
    thumbEl = document.createElement("img");
    thumbEl.src = signedUrl;
    thumbEl.className = "ctx-file-img";
  }

  if (thumbEl) {
    thumbEl.onclick = () => window.open(signedUrl, "_blank");
    wrap.appendChild(thumbEl);
  } else {
    const pill = document.createElement("div");
    pill.className = "ctx-file-pill";
    pill.textContent = truncateName(fileName);
    wrap.appendChild(pill);
  }

  setCtxAttachment({ id: attachmentId, mime, file_name: fileName });

  if (loadingEl.parentNode === containerEl) containerEl.insertBefore(wrap, loadingEl);
  else containerEl.appendChild(wrap);
}