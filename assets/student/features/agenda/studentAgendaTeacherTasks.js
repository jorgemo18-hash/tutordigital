import { apiFetch } from "../../../shared/js/auth.js";
import { setTasks, setCtxAttachment } from "./taskContext.js";

export function initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, btnAtrasadas, selectTask }) {
  const TASK_TYPE_LABELS = {
    homework: "Esta semana",
    exam: "Exámenes",
    work: "Trabajos",
  };

  const TYPE_TO_MODE = {
    homework: "DEBERES",
    exam: "EXAMEN",
    work: "TRABAJO",
  };

  let teacherTasksById = new Map();
  let teacherTasksGroupName = "";
  let activeViewerUrl = "";
  let taskStatusMap = new Map(); // taskId → "done" | "pending" | null

  // Set avatar initials from ACTIVE_USER
  const avatarEl = document.getElementById("avatarInitials");
  if (avatarEl && ACTIVE_USER?.displayName) {
    const parts = ACTIVE_USER.displayName.trim().split(/\s+/);
    const initials = parts.length >= 2
      ? parts[0][0] + parts[parts.length - 1][0]
      : (parts[0]?.[0] || "A");
    avatarEl.textContent = initials.toUpperCase();
  }

  // Populate sidebar avatar name and group detail
  const avatarDisplayNameEl = document.getElementById("avatarDisplayName");
  const avatarGroupNameEl = document.getElementById("avatarGroupName");
  if (avatarDisplayNameEl && ACTIVE_USER?.displayName) {
    avatarDisplayNameEl.textContent = ACTIVE_USER.displayName;
  }
  if (avatarGroupNameEl && ACTIVE_USER?.groupName) {
    avatarGroupNameEl.textContent = ACTIVE_USER.groupName;
  }

  function formatFileSize(size) {
    if (!size && size !== 0) return "";
    if (size < 1024) return `${size} B`;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  function inferMimeType(name) {
    const value = String(name || "").toLowerCase();
    if (value.endsWith(".pdf")) return "application/pdf";
    if (value.endsWith(".png")) return "image/png";
    if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
    if (value.endsWith(".webp")) return "image/webp";
    if (value.endsWith(".gif")) return "image/gif";
    return "";
  }

  function isImageType(type) { return Boolean(type && type.startsWith("image/")); }

  function truncateName(name) {
    if (!name || name.length <= 40) return name;
    return name.slice(0, 20) + "..." + name.slice(-15);
  }

  function formatDueDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  }

  // ── File viewer modal (kept for context pane attachment preview) ──

  function ensureFileViewerModal() {
    let modal = document.getElementById("studentFileViewer");
    if (modal) return modal;
    modal = document.createElement("div");
    modal.id = "studentFileViewer";
    modal.className = "taskModalOverlay";
    modal.innerHTML = `
      <div class="taskModalCard taskViewerCard">
        <div class="taskModalHeader">
          <h3 id="studentViewerTitle">Adjunto</h3>
          <button class="taskModalClose" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="taskViewerBody" id="studentViewerBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.classList.contains("taskModalClose")) {
        modal.classList.remove("open");
        const body = modal.querySelector("#studentViewerBody");
        if (body) body.innerHTML = "";
        if (activeViewerUrl) { URL.revokeObjectURL(activeViewerUrl); activeViewerUrl = ""; }
      }
    });
    return modal;
  }

  function openFileViewerWithUrl({ url, name, mime }) {
    if (!isImageType(mime || "")) { downloadFileFromUrl({ url, name }); return; }
    const modal = ensureFileViewerModal();
    const body = modal.querySelector("#studentViewerBody");
    const title = modal.querySelector("#studentViewerTitle");
    if (title) title.textContent = name || "Adjunto";
    if (body) body.innerHTML = `<img class="taskViewerImage" src="${url}" alt="Adjunto">`;
    modal.classList.add("open");
  }

  async function downloadFileFromUrl({ url, name }) {
    const res = await fetch(url);
    const blob = await res.blob();
    const localUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = localUrl; a.download = name || "adjunto";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(localUrl);
  }

  // ── Context pane population ──

  function slugifySubject(name) {
    const map = {
      "matemáticas": "subj-mat", "mates": "subj-mat",
      "lengua": "subj-len", "castellano": "subj-len",
      "historia": "subj-his",
      "inglés": "subj-ing", "ingles": "subj-ing",
      "biología": "subj-bio", "biologia": "subj-bio",
      "física": "subj-fis", "fisica": "subj-fis",
      "tecnología": "subj-tec", "tecnologia": "subj-tec",
    };
    return map[name.toLowerCase().trim()] || "subj-def";
  }

  function populateContextPane(task) {
    // Re-bind with task ID so the handler knows where to upload
    _bindCtxFilePickListener(task.id);

    const subjectTagEl = document.getElementById("ctxSubjectTag");
    const taskTitleEl  = document.getElementById("ctxTaskTitle");
    const taskDescEl   = document.getElementById("ctxTaskDesc");
    const attachEl     = document.getElementById("ctxAttachments");
    const uploadArea   = document.getElementById("ctxUploadArea");
    const filePreview  = document.getElementById("ctxFilePreview");
    const stepsEl      = document.getElementById("ctxSteps");

    if (subjectTagEl) {
      const label = task.subjectName || task.subject || "";
      if (label) {
        subjectTagEl.textContent = label;
        subjectTagEl.className = `ctx-subject-tag td-tag ${slugifySubject(label)}`;
        subjectTagEl.hidden = false;
      } else {
        subjectTagEl.hidden = true;
      }
    }

    if (taskTitleEl) taskTitleEl.textContent = task.title || "";

    if (taskDescEl) {
      taskDescEl.textContent = task.desc || "";
      taskDescEl.hidden = !task.desc;
    }

    // Upload area: secondary (small) when desc exists, prominent when no desc
    if (uploadArea) {
      uploadArea.classList.toggle("ctx-upload-secondary", Boolean(task.desc));
    }

    // Reset file preview and steps on task change; restore upload area
    if (filePreview) { filePreview.hidden = true; filePreview.innerHTML = ""; }
    if (uploadArea) uploadArea.style.display = "";
    if (stepsEl) stepsEl.hidden = true;

    // Clear previous task's context attachment, then try to restore from localStorage
    setCtxAttachment(null);
    _restoreCtxFile(task.id).catch(() => {});

    if (attachEl) {
      attachEl.innerHTML = "";
      const atts = task.attachments || [];
      atts.forEach((file) => {
        const inferred = inferMimeType(file.name);
        const type = file.type || inferred || "";
        const canOpen = isImageType(type);
        const item = document.createElement("div");
        item.className = "ctx-attach-item";
        item.innerHTML = `
          <span class="ctx-attach-name" title="${file.name}">${truncateName(file.name)}</span>
          <div class="ctx-attach-btns">
            ${canOpen ? `<button type="button" data-file-action="open" data-file-id="${file.id}">Abrir</button>` : ""}
            <button type="button" data-file-action="download" data-file-id="${file.id}">Descargar</button>
          </div>
        `;
        attachEl.appendChild(item);
      });

      attachEl.onclick = async (event) => {
        const btn = event.target.closest("button[data-file-action]");
        if (!btn) return;
        const id = btn.dataset.fileId;
        const action = btn.dataset.fileAction;
        const isDownload = action === "download";
        const originalText = btn.textContent;
        const restoreBtn = () => { btn.textContent = originalText; btn.disabled = false; };
        if (isDownload) { btn.disabled = true; btn.textContent = "Descargando…"; }
        try {
          const res = await apiFetch(`/api/v1/attachments/${id}/signed-url`);
          if (!res.ok) { if (isDownload) { btn.textContent = "Error"; setTimeout(restoreBtn, 2000); } return; }
          const body = await res.json().catch(() => ({}));
          const { url, mime, file_name } = body?.data || {};
          if (!url) { if (isDownload) { btn.textContent = "Error"; setTimeout(restoreBtn, 2000); } return; }
          if (action === "open" && isImageType(mime || "")) { openFileViewerWithUrl({ url, name: file_name, mime }); return; }
          await downloadFileFromUrl({ url, name: file_name });
          restoreBtn();
        } catch {
          if (isDownload) { btn.textContent = "Error"; setTimeout(restoreBtn, 2000); }
        }
      };
    }
  }

  // ── Card click → direct tutor ──

  function handleCardClick(taskId) {
    console.log("[agenda] card clicked", taskId);
    const task = teacherTasksById.get(taskId);
    if (!task) { console.warn("[agenda] task not found in map", taskId); return; }
    const mode = TYPE_TO_MODE[task.type];
    if (!mode) return;
    populateContextPane(task);
    if (typeof selectTask === "function") {
      selectTask(mode, { taskId: task.id, title: task.title });
    }
  }

  async function toggleTaskDone(taskId, btn) {
    const currentStatus = taskStatusMap.get(taskId);
    const newStatus = currentStatus === "done" ? "pending" : "done";
    const studentId = ACTIVE_USER?.userId;
    if (!studentId) return;

    // Optimistic update
    taskStatusMap.set(taskId, newStatus);
    const isDone = newStatus === "done";
    btn.textContent = isDone ? "✓" : "○";
    btn.classList.toggle("is-done", isDone);
    btn.setAttribute("aria-label", isDone ? "Marcar pendiente" : "Marcar hecho");
    const card = btn.closest("[data-card-task-id]");
    card?.classList.toggle("done", isDone);
    if (window._tdGroups) refreshColumnCounts(window._tdGroups);

    try {
      await apiFetch("/api/v1/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, student_id: studentId, student_status: newStatus }),
      });
    } catch {
      // Revert on error
      taskStatusMap.set(taskId, currentStatus);
      btn.textContent = currentStatus === "done" ? "✓" : "○";
      btn.classList.toggle("is-done", currentStatus === "done");
      card?.classList.toggle("done", currentStatus === "done");
      if (window._tdGroups) refreshColumnCounts(window._tdGroups);
    }
  }

  function initAgendaTaskHandlers() {
    const agenda = document.getElementById("agenda");
    if (!agenda) return;
    agenda.addEventListener("click", (event) => {
      const doneBtn = event.target.closest("[data-done-id]");
      if (doneBtn) {
        event.preventDefault();
        event.stopPropagation();
        toggleTaskDone(doneBtn.dataset.doneId, doneBtn);
        return;
      }
      const target = event.target.closest("[data-card-task-id]");
      if (!target) return;
      event.preventDefault();
      handleCardClick(target.dataset.cardTaskId);
    });
    agenda.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      const target = event.target.closest("[data-card-task-id]") || event.target.closest("[data-task-id]");
      if (!target) return;
      event.preventDefault();
      handleCardClick(target.dataset.cardTaskId || target.dataset.taskId);
    });
  }

  function renderCard(task, kind) {
    const li = document.createElement("li");
    const isDone = taskStatusMap.get(task.id) === "done";
    li.className = "td-card" + (kind === "atrasada" ? " urgent" : "") + (isDone ? " done" : "");
    li.dataset.cardTaskId = task.id;
    const due = task.dueDate
      ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      : null;
    const subjectLabel = task.subjectName || task.subject || "";
    const subjectSlug = subjectLabel ? slugifySubject(subjectLabel) : "";
    const clockIcon = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
    li.innerHTML = `
      <div class="td-card-tag-row">
        ${subjectLabel ? `<span class="td-tag ${subjectSlug}">${subjectLabel}</span>` : ""}
        ${kind === "atrasada" ? '<span class="td-badge-atrasada">Atrasada</span>' : ""}
        ${kind === "examen" ? '<span class="td-badge-tipo">Examen</span>' : ""}
        ${kind === "trabajo" ? '<span class="td-badge-tipo">Trabajo</span>' : ""}
        <button class="td-done-btn${isDone ? " is-done" : ""}" data-done-id="${task.id}" type="button" aria-label="${isDone ? "Marcar pendiente" : "Marcar hecho"}" title="${isDone ? "Marcar pendiente" : "Marcar hecho"}">
          ${isDone ? "✓" : "○"}
        </button>
      </div>
      <div class="td-card-title">
        <span class="agendaTaskLink" data-task-id="${task.id}" role="button" tabindex="0">${task.title}</span>
        ${task.attachments?.length ? `<span class="agendaAttachIndicator">📎 ${task.attachments.length}</span>` : ""}
      </div>
      <div class="td-card-foot">
        ${due ? `<span>${clockIcon} ${due}</span>` : "<span></span>"}
        ${task.estimatedMinutes ? `<span>${task.estimatedMinutes} min</span>` : ""}
      </div>
    `;
    return li;
  }

  function getOrCreateList(btn) {
    if (btn.tagName === "UL") return btn;
    let list = btn.querySelector("ul.items");
    if (!list) { list = document.createElement("ul"); list.className = "items"; btn.appendChild(list); }
    return list;
  }

  function renderLoadingState() {
    [btnDeberes, btnExamen, btnTrabajo, btnAtrasadas].forEach((btn) => {
      if (!btn) return;
      getOrCreateList(btn).innerHTML = '<li class="agendaLoading">Cargando…</li>';
    });
  }

  function countDone(taskList) {
    return taskList.filter((t) => taskStatusMap.get(t.id) === "done").length;
  }

  function refreshColumnCounts(groups) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("countAtrasadas",    `${countDone(groups.atrasadas)}/${groups.atrasadas.length}`);
    set("countDeberes",      `${countDone(groups.homework)}/${groups.homework.length}`);
    set("countExamenTrabajo",`${countDone([...groups.exam, ...groups.work])}/${groups.exam.length + groups.work.length}`);
  }

  function injectApiTasks(apiTasks) {
    const tasks = (Array.isArray(apiTasks) ? apiTasks : []).map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title || "",
      desc: t.desc || t.description || "",
      dueDate: t.due_date || "",
      subjectName: t.subject_name || t.subjectName || "",
      subject: t.subject || "",
      estimatedMinutes: t.estimated_minutes || t.estimatedMinutes || 0,
      myStatus: t.my_status || null,
      attachments: (t.attachments || []).map((a) => ({
        id: a.id, name: a.file_name || "", size: a.size || 0, type: a.mime || "",
      })),
    }));

    // Populate status map from API data
    taskStatusMap = new Map(tasks.map((t) => [t.id, t.myStatus]));

    teacherTasksById = new Map(tasks.map((t) => [t.id, t]));
    teacherTasksGroupName = "";
    setTasks(tasks);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups = { atrasadas: [], homework: [], exam: [], work: [] };

    for (const task of tasks) {
      if (task.dueDate) {
        const due = new Date(`${task.dueDate}T00:00:00`);
        due.setHours(0, 0, 0, 0);
        if (due < today) { groups.atrasadas.push(task); continue; }
      }
      const type = task.type === "exam" ? "exam" : task.type === "work" ? "work" : "homework";
      groups[type].push(task);
    }

    // Store groups for later counter refreshes
    window._tdGroups = groups;

    const columns = [
      { group: "atrasadas", btn: btnAtrasadas, kind: "atrasada" },
      { group: "homework",  btn: btnDeberes,   kind: "deberes" },
      { group: "exam",      btn: btnExamen,    kind: "examen" },
      { group: "work",      btn: btnTrabajo,   kind: "trabajo" },
    ];

    columns.forEach(({ group, btn, kind }) => {
      if (!btn) return;
      const list = getOrCreateList(btn);
      list.innerHTML = "";
      groups[group]
        .slice()
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
        .forEach((task) => list.appendChild(renderCard(task, kind)));
    });

    refreshColumnCounts(groups);

    const greeting = document.getElementById("studentGreeting");
    if (greeting) {
      const name = ACTIVE_USER?.displayName || "";
      const firstName = name.split(" ")[0];
      greeting.innerHTML = firstName ? `Bienvenido, <em>${firstName}</em>` : "Bienvenido";
    }

    const eyebrow = document.querySelector(".td-main-eyebrow");
    if (eyebrow) {
      const now = new Date();
      const day = now.toLocaleDateString("es-ES", { weekday: "long" });
      const d = now.getDate();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const y = String(now.getFullYear()).slice(-2);
      eyebrow.textContent = `${day.charAt(0).toUpperCase() + day.slice(1)} ${d}/${m}/${y}`;
    }
  }

  // Left-pane file input — re-bound on every populateContextPane call with the
  // current taskId so the handler can upload to the right task.
  let _ctxFilePickHandler = null;
  let _ctxUploadBtnWired  = false;

  function _bindCtxFilePickListener(taskId = null) {
    const ctxFilePick = document.getElementById("ctxFilePick");
    if (!ctxFilePick) return;

    // Wire the drop-area button once only
    if (!_ctxUploadBtnWired) {
      const btnCtxUpload = document.getElementById("btnCtxUpload");
      if (btnCtxUpload) {
        btnCtxUpload.addEventListener("click", () => ctxFilePick.click());
      }
      _ctxUploadBtnWired = true;
    }

    // Remove previous handler before re-adding to avoid duplicates
    if (_ctxFilePickHandler) {
      ctxFilePick.removeEventListener("change", _ctxFilePickHandler);
    }

    _ctxFilePickHandler = async () => {
      const files = ctxFilePick.files;
      const file = files?.[0];
      const previewEl  = document.getElementById("ctxFilePreview");
      const uploadArea = document.getElementById("ctxUploadArea");
      if (!previewEl) return;

      // No file — restore upload area
      if (!file) {
        previewEl.hidden = true;
        previewEl.innerHTML = "";
        if (uploadArea) uploadArea.style.display = "";
        return;
      }

      await _showCtxFilePreview(file, taskId);
    };

    ctxFilePick.addEventListener("change", _ctxFilePickHandler);

    // Reset value so selecting the same file again always fires 'change'
    try { ctxFilePick.value = ""; } catch {}
  }

  // Renders the context-pane preview for a given File. Called both on fresh upload and on restore.
  // skipUpload: true when the file is already stored in the backend (restore flow).
  async function _showCtxFilePreview(file, taskId, { skipUpload = false } = {}) {
    const previewEl  = document.getElementById("ctxFilePreview");
    const uploadArea = document.getElementById("ctxUploadArea");
    if (!previewEl) return;

    previewEl.innerHTML = "";
    previewEl.hidden = false;
    if (uploadArea) uploadArea.style.display = "none";

    const blobUrl = URL.createObjectURL(file);
    const wrap = document.createElement("div");
    wrap.className = "ctx-file-preview-wrap";

    const doClear = () => {
      previewEl.innerHTML = "";
      previewEl.hidden = true;
      if (uploadArea) uploadArea.style.display = "";
      const pick = document.getElementById("ctxFilePick");
      try { if (pick) pick.value = ""; } catch {}
      setCtxAttachment(null);
      if (taskId) { try { localStorage.removeItem(`ctxFile_${taskId}`); } catch {} }
    };

    const makeClearBtn = () => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctx-preview-clear";
      btn.setAttribute("aria-label", "Eliminar archivo adjunto");
      btn.textContent = "✕";
      btn.addEventListener("click", doClear);
      return btn;
    };

    if (file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.className = "ctx-file-img";
      img.alt = file.name;
      img.src = blobUrl;
      img.style.cursor = "pointer";
      img.title = "Abrir en nueva pestaña";
      img.addEventListener("click", () => window.open(blobUrl, "_blank"));
      wrap.appendChild(img);
      wrap.appendChild(makeClearBtn());
      previewEl.appendChild(wrap);
    } else if (file.type === "application/pdf") {
      const canvas = await _renderPdfThumb(file);
      if (canvas) {
        canvas.className = "ctx-pdf-thumb";
        canvas.title = "Abrir PDF en nueva pestaña";
        canvas.style.cursor = "pointer";
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
      _uploadCtxFile(file, taskId).catch((err) => {
        console.warn("[ctxFile] upload failed (preview shown locally):", err);
      });
    }
  }

  // Uploads a file to /api/v1/attachments, persists to localStorage and sets context attachment.
  async function _uploadCtxFile(file, taskId) {
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = () => reject(new Error("FileReader error"));
      r.readAsDataURL(file);
    });
    if (!dataUrl) throw new Error("empty dataUrl");

    const res = await apiFetch("/api/v1/attachments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task_id: taskId, file_name: file.name, mime: file.type || "application/octet-stream", data: dataUrl }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`upload failed: ${res.status} ${body?.error?.code || ""}`);
    }
    const body = await res.json().catch(() => ({}));
    const att = body?.data;
    if (!att?.id) throw new Error("no attachment id in response");

    const newEntry = { attachmentId: att.id, file_name: att.file_name || file.name, mime: att.mime || file.type };
    try {
      const raw = localStorage.getItem(`ctxFile_${taskId}`);
      const parsed = JSON.parse(raw || "null");
      const existing = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
      localStorage.setItem(`ctxFile_${taskId}`, JSON.stringify([newEntry, ...existing]));
    } catch {}

    setCtxAttachment({ id: att.id, mime: att.mime || file.type, file_name: att.file_name || file.name });
  }

  // Restores context files from localStorage. Most recent → main preview; rest → history pills.
  async function _restoreCtxFile(taskId) {
    const previewEl  = document.getElementById("ctxFilePreview");
    const uploadArea = document.getElementById("ctxUploadArea");

    // Handle both legacy single-object and current array format
    let entries = [];
    try {
      const raw = localStorage.getItem(`ctxFile_${taskId}`);
      const parsed = JSON.parse(raw || "null");
      entries = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    } catch {}
    if (entries.length === 0) return;

    const main = entries[0];
    if (!main?.attachmentId) return;

    // Fetch signed URL for the main (most recent) file
    let mainSignedUrl = null;
    try {
      const r = await apiFetch(`/api/v1/attachments/${main.attachmentId}/signed-url`);
      if (!r.ok) { try { localStorage.removeItem(`ctxFile_${taskId}`); } catch {} return; }
      const body = await r.json().catch(() => ({}));
      mainSignedUrl = body?.data?.url;
      // Always trust the server's file_name — fixes stale entries where file_name was stored as a URL
      if (body?.data?.file_name) main.file_name = body.data.file_name;
      if (!mainSignedUrl) { try { localStorage.removeItem(`ctxFile_${taskId}`); } catch {} return; }
    } catch { return; }

    if (!previewEl) return;

    // Download as blob → same render path as fresh upload
    let blob;
    try {
      const blobRes = await fetch(mainSignedUrl);
      if (!blobRes.ok) throw new Error(`fetch blob ${blobRes.status}`);
      blob = await blobRes.blob();
    } catch { return; }

    const mime = main.mime || inferMimeType(main.file_name) || "application/octet-stream";
    const file = new File([blob], main.file_name || "archivo", { type: mime });
    previewEl.innerHTML = "";
    await _showCtxFilePreview(file, taskId, { skipUpload: true });
    if (uploadArea) uploadArea.style.display = "none";
    setCtxAttachment({ id: main.attachmentId, mime: main.mime, file_name: main.file_name });

    // Render history pills for all previous entries
    for (let i = 1; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry?.attachmentId) continue;
      try {
        const r = await apiFetch(`/api/v1/attachments/${entry.attachmentId}/signed-url`);
        if (!r.ok) continue;
        const body = await r.json().catch(() => ({}));
        const url = body?.data?.url;
        if (body?.data?.file_name) entry.file_name = body.data.file_name;
        if (!url) continue;
        _appendHistoryPill(entry.file_name || "archivo", entry.mime || "", url, entry.attachmentId, taskId, previewEl);
      } catch {}
    }
  }

  // Try to bind immediately (element exists if HTML loaded before this script)
  _bindCtxFilePickListener();

  // Renders first PDF page and returns a ready <canvas> element, or null on failure.
  // Canvas is created and dimensioned BEFORE render — never added to DOM beforehand.
  async function _renderPdfThumb(file) {
    const pdfjs = window.pdfjsDistBuildPdf;
    if (!pdfjs?.getDocument) {
      console.warn("[ctxFilePick] pdfjsDistBuildPdf.getDocument no disponible");
      return null;
    }
    if (pdfjs.PDFJS) pdfjs.PDFJS.disableWorker = true;
    try {
      const ab = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(ab) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport(1);          // v1.x API: numeric scale
      const scale = 220 / viewport.width;
      const scaled = page.getViewport(scale);

      const canvas = document.createElement("canvas");
      canvas.width  = Math.floor(scaled.width);
      canvas.height = Math.floor(scaled.height);
      canvas.style.width        = "160px";
      canvas.style.height       = "auto";
      canvas.style.display      = "block";
      canvas.style.borderRadius = "8px";
      canvas.style.cursor       = "pointer";
      canvas.style.boxShadow    = "0 2px 8px rgba(0,0,0,0.3)";

      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: scaled }).promise;
      return canvas;
    } catch (e) {
      console.warn("[ctxFilePick] PDF thumb error:", e);
      return null;
    }
  }

  // History pill for previous uploads (index ≥ 1 in the ctxFile array). No blob needed.
  function _appendHistoryPill(fileName, mime, signedUrl, attachmentId, taskId, previewEl) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "overflow:visible;margin-top:4px;";

    const item = document.createElement("div");
    item.className = "ctx-attach-item";

    const badge = document.createElement("span");
    badge.style.cssText = "flex-shrink:0;font-family:var(--mono);font-size:10px;font-weight:700;border-radius:4px;padding:2px 5px;";
    if (mime === "application/pdf") {
      badge.textContent = "PDF";
      badge.style.cssText += "color:rgba(255,120,110,0.9);background:rgba(229,57,53,0.15);";
    } else if (mime.startsWith("image/")) {
      badge.textContent = "IMG";
      badge.style.cssText += "color:rgba(130,180,255,0.9);background:rgba(30,120,255,0.12);";
    } else {
      badge.textContent = "FILE";
      badge.style.cssText += "color:var(--ink-mute);background:var(--glass-soft);";
    }

    const nameEl = document.createElement("span");
    nameEl.className = "ctx-attach-name";
    nameEl.textContent = truncateName(fileName);
    nameEl.title = fileName;

    const btns = document.createElement("div");
    btns.className = "ctx-attach-btns";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Abrir";
    openBtn.addEventListener("click", () => window.open(signedUrl, "_blank"));

    const reloadBtn = document.createElement("button");
    reloadBtn.type = "button";
    reloadBtn.textContent = "Recargar";
    reloadBtn.addEventListener("click", () => {
      setCtxAttachment({ id: attachmentId, mime, file_name: fileName });
      _showToast("Archivo enviado al tutor");
    });

    btns.appendChild(openBtn);
    btns.appendChild(reloadBtn);
    item.appendChild(badge);
    item.appendChild(nameEl);
    item.appendChild(btns);
    wrap.appendChild(item);
    previewEl.appendChild(wrap);
  }

  // Fallback pill when no thumbnail can be rendered (PDF canvas fail or generic file type).
  // Shows MIME badge, truncated name, and three action buttons.
  function _showFallbackPill(fileName, mime, openUrl, taskId, wrap, doClear) {
    wrap.style.overflow = "visible"; // allow buttons to be visible (wrap has overflow:hidden for canvas clips)
    const item = document.createElement("div");
    item.className = "ctx-attach-item";

    const badge = document.createElement("span");
    badge.style.cssText = "flex-shrink:0;font-family:var(--mono);font-size:10px;font-weight:700;border-radius:4px;padding:2px 5px;";
    if (mime === "application/pdf") {
      badge.textContent = "PDF";
      badge.style.cssText += "color:rgba(255,120,110,0.9);background:rgba(229,57,53,0.15);";
    } else if (mime.startsWith("image/")) {
      badge.textContent = "IMG";
      badge.style.cssText += "color:rgba(130,180,255,0.9);background:rgba(30,120,255,0.12);";
    } else {
      badge.textContent = "FILE";
      badge.style.cssText += "color:var(--ink-mute);background:var(--glass-soft);";
    }

    const nameEl = document.createElement("span");
    nameEl.className = "ctx-attach-name";
    nameEl.textContent = truncateName(fileName);
    nameEl.title = fileName;

    const btns = document.createElement("div");
    btns.className = "ctx-attach-btns";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Abrir";
    openBtn.addEventListener("click", () => window.open(openUrl, "_blank"));

    const resendBtn = document.createElement("button");
    resendBtn.type = "button";
    resendBtn.textContent = "Recargar";
    resendBtn.addEventListener("click", () => {
      try {
        const raw = localStorage.getItem(`ctxFile_${taskId}`);
        const parsed = JSON.parse(raw || "null");
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        if (first?.attachmentId) {
          setCtxAttachment({ id: first.attachmentId, mime: first.mime, file_name: first.file_name });
        }
      } catch {}
      _showToast("Archivo enviado al tutor");
    });

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.textContent = "×";
    closeBtn.setAttribute("aria-label", "Eliminar archivo adjunto");
    closeBtn.addEventListener("click", doClear);

    btns.appendChild(openBtn);
    btns.appendChild(resendBtn);
    btns.appendChild(closeBtn);
    item.appendChild(badge);
    item.appendChild(nameEl);
    item.appendChild(btns);
    wrap.appendChild(item);
  }

  function _showToast(msg) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
      "background:var(--glass);border:1px solid var(--hairline);color:var(--ink-soft);" +
      "padding:8px 18px;border-radius:999px;font-family:var(--sans);font-size:13px;" +
      "z-index:9999;pointer-events:none;opacity:1;transition:opacity .3s;backdrop-filter:blur(8px);";
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => { try { document.body.removeChild(toast); } catch {} }, 350);
    }, 1800);
  }

  renderLoadingState();
  initAgendaTaskHandlers();
  return { injectApiTasks };
}
