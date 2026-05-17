import { apiFetch } from "../../../shared/js/auth.js";
import { setTasks } from "./taskContext.js";

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

    // Reset file preview and steps on task change
    if (filePreview) { filePreview.hidden = true; filePreview.innerHTML = ""; }
    if (stepsEl) stepsEl.hidden = true;

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

  // Left-pane upload button uses ctxFilePick (independent from right-column #filePick)
  const ctxFilePick = document.getElementById("ctxFilePick");
  const btnCtxUpload = document.getElementById("btnCtxUpload");
  if (btnCtxUpload && ctxFilePick) {
    btnCtxUpload.addEventListener("click", () => ctxFilePick.click());
  }

  // When a file is chosen via ctxFilePick, show preview only in the left pane.
  // PDFs show a pill (no external URL, no rendering attempt).
  if (ctxFilePick) {
    ctxFilePick.addEventListener("change", () => {
      const file = ctxFilePick.files?.[0];
      const previewEl = document.getElementById("ctxFilePreview");
      if (!previewEl) return;
      if (!file) { previewEl.hidden = true; previewEl.innerHTML = ""; return; }
      previewEl.innerHTML = "";
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        const img = document.createElement("img");
        img.className = "ctx-file-img";
        img.alt = file.name;
        img.src = url;
        img.onload = () => URL.revokeObjectURL(url);
        previewEl.appendChild(img);
      } else {
        const isPdf = file.type === "application/pdf";
        const pill = document.createElement("div");
        pill.className = "ctx-file-pill" + (isPdf ? " ctx-file-pdf" : "");
        pill.textContent = (isPdf ? "PDF" : "ARCHIVO") + " · " + file.name;
        previewEl.appendChild(pill);
      }
      previewEl.hidden = false;
    });
  }

  renderLoadingState();
  initAgendaTaskHandlers();
  return { injectApiTasks };
}
