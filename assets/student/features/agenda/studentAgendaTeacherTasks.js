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
  let taskStatusMap = new Map(); // taskId → "done" | "pending" | "needs_teacher" | null
  let _teacherRenderGen = 0; // increments on each populateContextPane call; cancels stale renders

  // ── localStorage para persistir estados entre sesiones ──────────────────────
  // Fallback cuando el servidor no incluye my_status en la respuesta.
  const _lsKey = `ttd_ts_${ACTIVE_USER?.userId || "anon"}`;
  function _lsLoad() {
    try { return JSON.parse(localStorage.getItem(_lsKey) || "{}"); } catch { return {}; }
  }
  function _lsSave(taskId, status) {
    try {
      const m = _lsLoad();
      if (!status || status === "pending") { delete m[taskId]; } else { m[taskId] = status; }
      localStorage.setItem(_lsKey, JSON.stringify(m));
    } catch {}
  }

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

  function truncateName(name) {
    if (!name || name.length <= 40) return name;
    return name.slice(0, 20) + "..." + name.slice(-15);
  }

  function formatDueDate(value) {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
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

    const subjectTagEl    = document.getElementById("ctxSubjectTag");
    const subjectSepEl    = document.querySelector(".tutor-breadcrumb-sep--subject");
    const taskTitleEl     = document.getElementById("ctxTaskTitle");
    const taskDescEl      = document.getElementById("ctxTaskDesc");
    const attachEl        = document.getElementById("ctxAttachments");
    const uploadArea      = document.getElementById("ctxUploadArea");
    const filePreview     = document.getElementById("ctxFilePreview");
    const stepsEl         = document.getElementById("ctxSteps");
    const teacherFilesEl  = document.getElementById("ctxTeacherFiles");

    const label = task.subjectName || task.subject || "";
    const subjectClass = `ctx-subject-tag td-tag ${slugifySubject(label)}`;
    // Breadcrumb tag: ← Agenda · [TAG] · [título]
    if (subjectTagEl) {
      if (label) { subjectTagEl.textContent = label; subjectTagEl.className = subjectClass; subjectTagEl.hidden = false; }
      else { subjectTagEl.hidden = true; }
    }
    if (subjectSepEl) subjectSepEl.hidden = !label;

    if (taskTitleEl) taskTitleEl.textContent = task.title || "";

    if (taskDescEl) {
      const notes = task.teacher_notes || "";
      if (notes) {
        taskDescEl.textContent = `Tu tarea: ${notes}`;
        taskDescEl.hidden = false;
      } else {
        taskDescEl.textContent = "";
        taskDescEl.hidden = true;
      }
    }

    // Reset file preview and steps on task change; restore upload area
    if (filePreview) { filePreview.hidden = true; filePreview.innerHTML = ""; }
    if (stepsEl) stepsEl.hidden = true;

    // Clear previous task's context attachment, then try to restore from localStorage
    setCtxAttachment(null);
    _restoreCtxFile(task.id).catch(() => {});

    if (attachEl) attachEl.innerHTML = "";

    const teacherAttachments = Array.isArray(task.attachments) ? task.attachments : [];

    if (teacherFilesEl) {
      teacherFilesEl.innerHTML = "";
      if (teacherAttachments.length > 0) {
        // Hide main upload area; teacher files section takes priority
        if (uploadArea) uploadArea.style.display = "none";
        teacherFilesEl.hidden = false;

        const loadingEl = document.createElement("p");
        loadingEl.className = "ctx-teacher-files-loading";
        loadingEl.textContent = "Cargando...";
        teacherFilesEl.appendChild(loadingEl);

        // Fetch signed URLs and render centered previews (fire-and-forget).
        // Increment gen BEFORE calling so any in-flight render from a prior call aborts.
        const _myGen = ++_teacherRenderGen;
        _renderTeacherAttachments(teacherAttachments, teacherFilesEl, loadingEl, task.id, _myGen);
      } else {
        // No teacher attachments — normal student upload area
        teacherFilesEl.hidden = true;
        if (uploadArea) {
          uploadArea.style.display = "";
          uploadArea.classList.toggle("ctx-upload-secondary", Boolean(task.desc));
        }
      }
    } else {
      // Fallback if element doesn't exist
      if (uploadArea) {
        uploadArea.style.display = "";
        uploadArea.classList.toggle("ctx-upload-secondary", Boolean(task.desc));
      }
    }

    // Columna de pasos: solo visible cuando hay adjunto del profesor (el Guía lo procesa
    // automáticamente). Sin adjunto, aparece en onSessionReady tras procesar un doc real.
    const ctxSubStepsEl = document.getElementById("ctxSubSteps");
    if (ctxSubStepsEl) {
      ctxSubStepsEl.hidden = teacherAttachments.length === 0;
      const ph = ctxSubStepsEl.querySelector(".ctx-sub-steps-placeholder");
      if (ph) ph.hidden = false;
    }
  }

  async function _renderTeacherAttachments(attachments, containerEl, loadingEl, taskId, gen) {
    for (const att of attachments) {
      if (_teacherRenderGen !== gen) { try { loadingEl.remove(); } catch {} return; }
      if (!att?.id) continue;
      try {
        const r = await apiFetch(`/api/v1/attachments/${att.id}/signed-url`);
        if (_teacherRenderGen !== gen) { try { loadingEl.remove(); } catch {} return; }
        if (!r.ok) continue;
        const body = await r.json().catch(() => ({}));
        const url = body?.data?.url;
        if (!url) continue;
        const fileName = body?.data?.file_name || att.file_name || "archivo";
        const mime = body?.data?.mime || att.mime || "";
        await _appendTeacherPreview(fileName, mime, url, att.id, containerEl, loadingEl);
      } catch {}
    }
    if (_teacherRenderGen === gen) try { loadingEl.remove(); } catch {}
  }

  async function _appendTeacherPreview(fileName, mime, signedUrl, attachmentId, containerEl, loadingEl) {
    const wrap = document.createElement("div");
    wrap.className = "ctx-teacher-preview";
    wrap.dataset.teacherAttachmentId = attachmentId;

    // Thumbnail
    const thumbWrap = document.createElement("div");
    thumbWrap.className = "ctx-teacher-preview-thumb";

    let thumbEl = null;
    if (mime === "application/pdf") {
      try {
        const blobRes = await fetch(signedUrl);
        if (blobRes.ok) {
          const blob = await blobRes.blob();
          const file = new File([blob], fileName, { type: mime });
          const canvas = await _renderPdfThumb(file);
          if (canvas) {
            canvas.className = "ctx-pdf-thumb";
            canvas.style.width = "360px";
            canvas.style.height = "auto";
            canvas.style.cursor = "pointer";
            canvas.addEventListener("click", () => window.open(signedUrl, "_blank"));
            thumbEl = canvas;
          }
        }
      } catch {}
    } else if (mime.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = signedUrl;
      img.alt = fileName;
      img.className = "ctx-file-img";
      img.style.width = "360px";
      img.style.cursor = "pointer";
      img.addEventListener("click", () => window.open(signedUrl, "_blank"));
      thumbEl = img;
    }

    if (thumbEl) {
      thumbWrap.appendChild(thumbEl);
    } else {
      const pill = document.createElement("div");
      pill.className = "ctx-file-pill";
      pill.textContent = truncateName(fileName);
      thumbWrap.appendChild(pill);
    }

    // Action buttons
    const btns = document.createElement("div");
    btns.className = "ctx-teacher-preview-btns";

    // Auto-enviar al tutor al renderizar (no esperar a que el alumno lo pulse)
    setCtxAttachment({ id: attachmentId, mime, file_name: fileName });

    // "Abrir" — también activado al pulsar la miniatura
    if (thumbEl) {
      thumbEl.addEventListener("click", () => window.open(signedUrl, "_blank"));
    }

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.textContent = "Abrir";
    openBtn.addEventListener("click", () => window.open(signedUrl, "_blank"));

    btns.appendChild(openBtn);

    // Caption
    const caption = document.createElement("p");
    caption.className = "ctx-teacher-preview-label";
    caption.textContent = "Archivo de tu profesor/a";

    wrap.appendChild(thumbWrap);
    wrap.appendChild(btns);
    wrap.appendChild(caption);

    if (loadingEl.parentNode === containerEl) {
      containerEl.insertBefore(wrap, loadingEl);
    } else {
      containerEl.appendChild(wrap);
    }
  }

  // ── Card click → direct tutor ──

  function handleCardClick(taskId) {
    const task = teacherTasksById.get(taskId);
    if (!task) return;
    const mode = TYPE_TO_MODE[task.type];
    if (!mode) return;
    populateContextPane(task);
    if (typeof selectTask === "function") {
      selectTask(mode, { taskId: task.id, title: task.title, tipo: task.type });
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
      _lsSave(taskId, newStatus);
      // Deber marcado como hecho en atrasadas → sacarlo de la columna inmediatamente
      if (isDone && card) {
        const task = teacherTasksById.get(String(taskId));
        if (task && task.type === "homework" && task.dueDate) {
          const today = new Date(); today.setHours(0, 0, 0, 0);
          const due = new Date(`${task.dueDate}T00:00:00`); due.setHours(0, 0, 0, 0);
          if (due < today) {
            card.remove();
            if (window._tdGroups) {
              window._tdGroups.atrasadas = window._tdGroups.atrasadas.filter(t => t.id !== taskId);
              refreshColumnCounts(window._tdGroups);
            }
          }
        }
      }
    } catch {
      // Revert on error
      taskStatusMap.set(taskId, currentStatus);
      _lsSave(taskId, currentStatus ?? null);
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
    const status = taskStatusMap.get(task.id);
    const isDone = status === "done";
    const isNeedsHelp = status === "needs_teacher";
    li.className = "td-card" + (kind === "atrasada" ? " urgent" : "") + (isDone ? " done" : "") + (isNeedsHelp ? " needs-help" : "");
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
        <button class="td-done-btn${isDone ? " is-done" : ""}${isNeedsHelp ? " is-needs-help" : ""}" data-done-id="${task.id}" type="button" aria-label="${isDone ? "Marcar pendiente" : "Marcar hecho"}" title="${isDone ? "Marcar pendiente" : "Marcar hecho"}">
          ${isDone ? "✓" : isNeedsHelp ? "✗" : "○"}
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

  function renderAtrasadas(container, tasks) {
    container.querySelectorAll(".atrasadas-section").forEach((el) => el.remove());
    const origList = container.querySelector("ul.items");
    if (origList) origList.innerHTML = "";

    const sorted = tasks.slice().sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
    const deberes = sorted.filter((t) => t.type === "homework");
    const trabajos = sorted.filter((t) => t.type === "work");
    const hint = container.querySelector(".td-col-hint");

    function insertSection(label, items) {
      const lbl = document.createElement("p");
      lbl.className = "td-col-subsection-label atrasadas-section";
      lbl.textContent = label;
      container.insertBefore(lbl, hint || null);
      const ul = document.createElement("ul");
      ul.className = "items atrasadas-section";
      items.forEach((t) => ul.appendChild(renderCard(t, "atrasada")));
      container.insertBefore(ul, hint || null);
    }

    if (deberes.length) insertSection("DEBERES", deberes);

    if (deberes.length && trabajos.length) {
      const sep = document.createElement("div");
      sep.className = "td-col-separator atrasadas-section";
      container.insertBefore(sep, hint || null);
    }

    if (trabajos.length) insertSection("TRABAJOS", trabajos);
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
      teacher_notes: t.teacher_notes || "",
      dueDate: t.due_date || "",
      subjectName: t.subject_name || t.subjectName || "",
      subject: t.subject || "",
      estimatedMinutes: t.estimated_minutes || t.estimatedMinutes || 0,
      myStatus: t.my_status || null,
      attachments: (t.attachments || []).map((a) => ({
        id: a.id, file_name: a.file_name || "", size: a.size || 0, mime: a.mime || "",
      })),
    }));

    // Populate status map from API data
    taskStatusMap = new Map(tasks.map((t) => [t.id, t.myStatus]));

    teacherTasksById = new Map(tasks.map((t) => [t.id, t]));
    setTasks(tasks);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fallback: si el servidor no devolvió my_status (código antiguo en Render o
    // fallo silencioso en la query), usar el estado guardado en localStorage.
    const _lsStatuses = _lsLoad();
    if (Object.keys(_lsStatuses).length) {
      let augmented = false;
      for (const task of tasks) {
        if (!task.myStatus && _lsStatuses[task.id]) {
          task.myStatus = _lsStatuses[task.id];
          augmented = true;
        }
      }
      if (augmented) taskStatusMap = new Map(tasks.map((t) => [t.id, t.myStatus]));
    }

    const groups = { atrasadas: [], homework: [], exam: [], work: [] };

    for (const task of tasks) {
      if (task.dueDate) {
        const due = new Date(`${task.dueDate}T00:00:00`);
        due.setHours(0, 0, 0, 0);
        if (due < today) {
          // Deberes completados no van a atrasadas (el servidor ya los filtra;
          // este check es el fallback para la sesión actual)
          if (task.type === "homework" && (task.myStatus === "done" || task.myStatus === "needs_teacher")) continue;
          groups.atrasadas.push(task);
          continue;
        }
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
      if (group === "atrasadas") {
        renderAtrasadas(btn, groups.atrasadas);
        return;
      }
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

      // No file — restore upload area only if teacher files section is not active
      if (!file) {
        previewEl.hidden = true;
        previewEl.innerHTML = "";
        const teacherFilesEl = document.getElementById("ctxTeacherFiles");
        if (uploadArea && (!teacherFilesEl || teacherFilesEl.hidden)) uploadArea.style.display = "";
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
      // Only restore the main upload area if the teacher files section is not active
      const teacherFilesEl = document.getElementById("ctxTeacherFiles");
      if (uploadArea && (!teacherFilesEl || teacherFilesEl.hidden)) uploadArea.style.display = "";
      const pick = document.getElementById("ctxFilePick");
      try { if (pick) pick.value = ""; } catch {}
      setCtxAttachment(null);
      if (taskId) { try { localStorage.removeItem(`ctxFiles_${taskId}`); localStorage.removeItem(`ctxFile_${taskId}`); } catch {} }
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
      img.style.width        = "100%";
      img.style.height       = "auto";
      img.style.display      = "block";
      img.style.borderRadius = "8px";
      img.style.cursor       = "pointer";
      img.style.boxShadow    = "0 2px 8px rgba(0,0,0,0.3)";
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
      const prevEntries = _readCtxFiles(taskId);
      if (prevEntries.length > 0) {
        _fetchAndAppendHistoryPills(prevEntries, taskId, previewEl); // fire-and-forget
      }
      _uploadCtxFile(file, taskId).catch((err) => {
        console.error("[ctxFile] upload failed — file NOT saved to localStorage:", err?.message || err);
      });
    }
  }

  // ── localStorage helpers ────────────────────────────────────────────────────
  function _readCtxFiles(taskId) {
    try {
      const newRaw = localStorage.getItem(`ctxFiles_${taskId}`);
      if (newRaw) {
        const parsed = JSON.parse(newRaw);
        if (Array.isArray(parsed)) return parsed;
      }
      // Backward compat: read old ctxFile_ key (single object or array)
      const oldRaw = localStorage.getItem(`ctxFile_${taskId}`);
      if (oldRaw) {
        const parsed = JSON.parse(oldRaw);
        if (Array.isArray(parsed)) return parsed;
        if (parsed?.attachmentId) return [parsed];
      }
      return [];
    } catch { return []; }
  }
  function _saveCtxFiles(taskId, entries) {
    const seen = new Set();
    const deduped = entries.filter(e => {
      if (!e?.attachmentId || seen.has(e.attachmentId)) return false;
      seen.add(e.attachmentId);
      return true;
    });
    try {
      localStorage.setItem(`ctxFiles_${taskId}`, JSON.stringify(deduped));
      localStorage.removeItem(`ctxFile_${taskId}`); // clean up old key on write
    } catch {}
  }

  // Uploads a file to /api/v1/attachments, unshifts to ctxFiles array, renders history pills.
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
      body: JSON.stringify({ task_id: taskId, file_name: file.name, mime: file.type || "application/octet-stream", data: dataUrl, role: "statement" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`upload failed: ${res.status} ${body?.error?.code || ""}`);
    }
    const body = await res.json().catch(() => ({}));
    const att = body?.data;
    if (!att?.id) throw new Error("no attachment id in response");

    const newEntry = { attachmentId: att.id, file_name: att.file_name || file.name, mime: att.mime || file.type };
    const prevEntries = _readCtxFiles(taskId);
    _saveCtxFiles(taskId, [newEntry, ...prevEntries]);
    setCtxAttachment({ id: att.id, mime: att.mime || file.type, file_name: att.file_name || file.name });
  }

  // Fetches signed URLs for a list of entries and appends history pills.
  async function _fetchAndAppendHistoryPills(entries, taskId, previewEl) {
    const loadingEl = document.createElement("p");
    loadingEl.textContent = "Cargando archivos anteriores...";
    loadingEl.style.cssText = "font-family:var(--mono);font-size:11px;color:var(--ink-faint);margin:6px 0 2px;";
    previewEl.appendChild(loadingEl);

    for (const entry of entries) {
      if (!entry?.attachmentId) continue;
      // DOM dedup — skip if a pill for this attachment is already rendered
      if (previewEl.querySelector(`[data-attachment-id="${entry.attachmentId}"]`)) continue;
      try {
        const r = await apiFetch(`/api/v1/attachments/${entry.attachmentId}/signed-url`);
        if (!r.ok) continue; // silently skip expired/deleted
        const body = await r.json().catch(() => ({}));
        const url = body?.data?.url;
        if (!url) continue;
        if (body?.data?.file_name) entry.file_name = body.data.file_name;
        _appendHistoryPill(entry.file_name || "archivo", entry.mime || "", url, entry.attachmentId, taskId, previewEl);
      } catch {}
    }

    loadingEl.remove();
  }

  // Restores context files from localStorage (source of truth).
  // Supabase is only used to get signed URLs; 4xx entries are silently removed from the array.
  async function _restoreCtxFile(taskId) {
    const previewEl  = document.getElementById("ctxFilePreview");
    const uploadArea = document.getElementById("ctxUploadArea");

    const entries = _readCtxFiles(taskId);
    if (entries.length === 0) return;

    // Resolve signed URLs for all entries; collect valid ones
    const resolved = []; // [{ entry, signedUrl }]
    const keep = [];     // entries to keep in localStorage (valid + network-error)
    for (const entry of entries) {
      if (!entry?.attachmentId) continue;
      try {
        const r = await apiFetch(`/api/v1/attachments/${entry.attachmentId}/signed-url`);
        if (!r.ok) continue; // 4xx — drop silently from array
        const body = await r.json().catch(() => ({}));
        const url = body?.data?.url;
        if (!url) continue;
        if (body?.data?.file_name) entry.file_name = body.data.file_name; // fix stale names
        keep.push(entry);
        resolved.push({ entry, signedUrl: url });
      } catch {
        keep.push(entry); // network error — keep for next restore attempt, no pill
      }
    }

    if (keep.length !== entries.length) _saveCtxFiles(taskId, keep);
    if (resolved.length === 0) return;
    if (!previewEl) return;

    // Main entry (index 0): download as blob → show as preview
    const { entry: main, signedUrl: mainUrl } = resolved[0];
    let blob;
    try {
      const blobRes = await fetch(mainUrl);
      if (!blobRes.ok) throw new Error(`blob ${blobRes.status}`);
      blob = await blobRes.blob();
    } catch { return; }

    const mime = main.mime || inferMimeType(main.file_name) || "application/octet-stream";
    const file = new File([blob], main.file_name || "archivo", { type: mime });
    previewEl.innerHTML = "";
    await _showCtxFilePreview(file, taskId, { skipUpload: true });
    if (uploadArea) uploadArea.style.display = "none";
    setCtxAttachment({ id: main.attachmentId, mime: main.mime, file_name: main.file_name });

    // Previous entries (index 1..): render as history pills
    for (const { entry, signedUrl } of resolved.slice(1)) {
      _appendHistoryPill(entry.file_name || "archivo", entry.mime || "", signedUrl, entry.attachmentId, taskId, previewEl);
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
      const scale = 440 / viewport.width;
      const scaled = page.getViewport(scale);

      const canvas = document.createElement("canvas");
      canvas.width  = Math.floor(scaled.width);
      canvas.height = Math.floor(scaled.height);
      canvas.style.width        = "100%";
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
    if (attachmentId) wrap.dataset.attachmentId = attachmentId;

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

    const sendBtn = document.createElement("button");
    sendBtn.type = "button";
    sendBtn.textContent = "Enviar al tutor";
    sendBtn.addEventListener("click", () => {
      setCtxAttachment({ id: attachmentId, mime, file_name: fileName });
      _showToast("Archivo enviado al tutor");
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", () => {
      _saveCtxFiles(taskId, _readCtxFiles(taskId).filter(e => e.attachmentId !== attachmentId));
      wrap.remove();
    });

    btns.appendChild(openBtn);
    btns.appendChild(sendBtn);
    btns.appendChild(deleteBtn);
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
    resendBtn.textContent = "Enviar al tutor";
    resendBtn.addEventListener("click", () => {
      const first = _readCtxFiles(taskId)[0];
      if (first?.attachmentId) {
        setCtxAttachment({ id: first.attachmentId, mime: first.mime, file_name: first.file_name });
      }
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

  function refreshTaskContext(taskId) {
    const task = teacherTasksById.get(String(taskId || ""));
    if (task) populateContextPane(task);
  }

  async function refreshTaskList() {
    try {
      const res = await apiFetch("/api/v1/tasks");
      const body = await res.json().catch(() => ({}));
      injectApiTasks(res.ok ? (body?.data?.items || []) : []);
    } catch {
      // silently ignore — agenda stays as-is
    }
  }
  window._tdRefreshTasks = refreshTaskList;

  return { injectApiTasks, refreshTaskContext };
}
