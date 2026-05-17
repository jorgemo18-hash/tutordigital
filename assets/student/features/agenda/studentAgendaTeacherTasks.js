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

  function ensureStudentTaskModal() {
    let modal = document.getElementById("studentTaskModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "studentTaskModal";
    modal.className = "taskModalOverlay";
    modal.innerHTML = `
      <div class="taskModalCard">
        <div class="taskModalHeader">
          <h3 id="studentTaskTitle">Tarea</h3>
          <button class="taskModalClose" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="taskModalBody" id="studentTaskBody"></div>
        <div class="taskModalAttachments">
          <div class="taskModalLabel">Adjuntos</div>
          <ul class="taskModalList" id="studentTaskAttachments"></ul>
          <p class="taskModalEmpty" id="studentTaskEmpty">Sin adjuntos.</p>
        </div>
        <div class="taskModalFooter" id="studentTaskFooter"></div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener("click", (event) => {
      if (event.target === modal || event.target.classList.contains("taskModalClose")) {
        modal.classList.remove("open");
      }
    });

    modal.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-file-action]");
      if (!button) return;
      const id = button.dataset.fileId;
      const action = button.dataset.fileAction;
      const isDownload = action === "download";
      const originalText = button.textContent;
      const restoreBtn = () => { button.textContent = originalText; button.disabled = false; };
      if (isDownload) { button.disabled = true; button.textContent = "Descargando…"; }
      try {
        const res = await apiFetch(`/api/v1/attachments/${id}/signed-url`);
        if (!res.ok) { if (isDownload) { button.textContent = "Error"; setTimeout(restoreBtn, 2000); } return; }
        const body = await res.json().catch(() => ({}));
        const { url, mime, file_name } = body?.data || {};
        if (!url) { if (isDownload) { button.textContent = "Error"; setTimeout(restoreBtn, 2000); } return; }
        if (action === "open" && isImageType(mime || "")) { openFileViewerWithUrl({ url, name: file_name, mime }); return; }
        await downloadFileFromUrl({ url, name: file_name });
        restoreBtn();
      } catch {
        if (isDownload) { button.textContent = "Error"; setTimeout(restoreBtn, 2000); }
      }
    });

    return modal;
  }

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

  function openStudentTaskModal(task, groupName) {
    const modal = ensureStudentTaskModal();
    const title = modal.querySelector("#studentTaskTitle");
    const body = modal.querySelector("#studentTaskBody");
    const list = modal.querySelector("#studentTaskAttachments");
    const empty = modal.querySelector("#studentTaskEmpty");

    title.textContent = task.title;
    body.innerHTML = `
      <div><strong>Tipo:</strong> ${TASK_TYPE_LABELS[task.type] || "Tarea"}</div>
      <div><strong>Grupo:</strong> ${groupName || "-"}</div>
      <div><strong>Entrega:</strong> ${task.dueDate}</div>
      ${task.desc ? `<div><strong>Descripción:</strong></div><div>${task.desc}</div>` : ""}
    `;
    list.innerHTML = "";
    const attachments = task.attachments || [];
    attachments.forEach((file) => {
      const inferred = inferMimeType(file.name);
      const type = file.type || inferred || "";
      const canOpen = isImageType(type);
      const li = document.createElement("li");
      li.className = "taskModalItem";
      li.innerHTML = `
        <div class="taskModalInfo">
          <div class="taskModalName" title="${file.name}">${truncateName(file.name)}</div>
          <div class="taskModalMeta">${formatFileSize(file.size)}</div>
        </div>
        <div class="taskModalActions">
          ${canOpen ? `<button type="button" data-file-action="open" data-file-id="${file.id}">Abrir</button>` : ""}
          <button type="button" data-file-action="download" data-file-id="${file.id}">Descargar</button>
        </div>
      `;
      list.appendChild(li);
    });
    empty.style.display = attachments.length ? "none" : "block";

    const footer = modal.querySelector("#studentTaskFooter");
    if (footer) {
      footer.innerHTML = "";
      const mode = TYPE_TO_MODE[task.type];
      if (typeof selectTask === "function" && mode) {
        const tutorBtn = document.createElement("button");
        tutorBtn.type = "button";
        tutorBtn.className = "taskModalTutorBtn";
        tutorBtn.textContent = "Trabajar con el tutor";
        tutorBtn.addEventListener("click", () => {
          modal.classList.remove("open");
          selectTask(mode, { taskId: task.id, title: task.title });
        });
        footer.appendChild(tutorBtn);
      }
    }
    modal.classList.add("open");
  }

  function openTeacherTaskFromAgenda(taskId) {
    const task = teacherTasksById.get(taskId);
    if (!task) return;
    openStudentTaskModal(task, teacherTasksGroupName);
  }

  function initAgendaTaskHandlers() {
    const agenda = document.getElementById("agenda");
    if (!agenda) return;
    agenda.addEventListener("click", (event) => {
      const target = event.target.closest("[data-task-id]");
      if (!target) return;
      event.preventDefault();
      openTeacherTaskFromAgenda(target.dataset.taskId);
    });
    agenda.addEventListener("keydown", (event) => {
      const target = event.target.closest("[data-task-id]");
      if (!target) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openTeacherTaskFromAgenda(target.dataset.taskId);
      }
    });
  }

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

  function renderCard(task, kind) {
    const li = document.createElement("li");
    li.className = "td-card" + (kind === "atrasada" ? " urgent" : "");
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
      attachments: (t.attachments || []).map((a) => ({
        id: a.id, name: a.file_name || "", size: a.size || 0, type: a.mime || "",
      })),
    }));

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

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("countAtrasadas", groups.atrasadas.length);
    set("countDeberes", groups.homework.length);
    set("countExamenTrabajo", groups.exam.length + groups.work.length);
    set("miniCountAtrasadas", groups.atrasadas.length);
    set("miniCountSemana", groups.homework.length);
    set("miniCountExamenes", groups.exam.length + groups.work.length);

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

  renderLoadingState();
  initAgendaTaskHandlers();
  return { injectApiTasks };
}
