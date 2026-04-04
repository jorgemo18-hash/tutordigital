import { apiFetch } from "../../../shared/js/auth.js";
import { setTasks } from "./taskContext.js";

export function initStudentAgendaTeacherTasks({ getTenant, ACTIVE_USER, btnDeberes, btnExamen, btnTrabajo, selectTask }) {
  const TASK_TYPE_LABELS = {
    homework: "Deberes",
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

  function isImageType(type) {
    return Boolean(type && type.startsWith("image/"));
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

      try {
        const res = await apiFetch(`/api/v1/attachments/${id}/signed-url`);
        if (!res.ok) {
          console.warn("No se pudo obtener el adjunto:", res.status);
          return;
        }
        const body = await res.json().catch(() => ({}));
        const { url, mime, file_name } = body?.data || {};
        if (!url) return;

        if (action === "open" && isImageType(mime || "")) {
          openFileViewerWithUrl({ url, name: file_name, mime });
          return;
        }
        downloadFileFromUrl({ url, name: file_name });
      } catch (error) {
        console.warn("No se pudo abrir el adjunto:", error);
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
        if (activeViewerUrl) {
          URL.revokeObjectURL(activeViewerUrl);
          activeViewerUrl = "";
        }
      }
    });

    return modal;
  }

  function openFileViewerWithUrl({ url, name, mime }) {
    if (!isImageType(mime || "")) {
      downloadFileFromUrl({ url, name });
      return;
    }

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
    a.href = localUrl;
    a.download = name || "adjunto";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
    modal.classList.add("open");
  }

  function openTeacherTaskFromAgenda(taskId) {
    const task = teacherTasksById.get(taskId);
    if (!task) return;
    const mode = TYPE_TO_MODE[task.type];
    if (typeof selectTask === "function" && mode) {
      selectTask(mode, { taskId: task.id, title: task.title });
      return;
    }
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

  function renderLoadingState() {
    [btnDeberes, btnExamen, btnTrabajo].forEach((btn) => {
      if (!btn) return;
      let list = btn.querySelector("ul.items");
      if (!list) {
        list = document.createElement("ul");
        list.className = "items";
        btn.appendChild(list);
      }
      list.innerHTML = '<li class="agendaLoading">Cargando…</li>';
    });
  }

  function injectApiTasks(apiTasks) {
    const tasksInput = Array.isArray(apiTasks) ? apiTasks : [];

    const tasks = tasksInput.map((t) => ({
      id: t.id,
      type: t.type,
      title: t.title || "",
      desc: t.desc || t.description || "",
      dueDate: t.due_date || "",
      attachments: (t.attachments || []).map((a) => ({
        id: a.id,
        name: a.file_name || "",
        size: a.size || 0,
        type: a.mime || "",
      })),
    }));

    teacherTasksById = new Map(tasks.map((t) => [t.id, t]));
    teacherTasksGroupName = "";
    setTasks(tasks);

    const byType = { homework: [], exam: [], work: [] };
    tasks.forEach((task) => { if (byType[task.type]) byType[task.type].push(task); });

    const targets = [
      { type: "homework", btn: btnDeberes },
      { type: "exam", btn: btnExamen },
      { type: "work", btn: btnTrabajo },
    ];

    targets.forEach(({ type, btn }) => {
      if (!btn) return;
      let list = btn.querySelector("ul.items");
      if (!list) {
        list = document.createElement("ul");
        list.className = "items";
        btn.appendChild(list);
      }
      list.innerHTML = "";
      if (!byType[type].length) return;
      byType[type]
        .slice()
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
        .forEach((task) => {
          const li = document.createElement("li");
          const due = task.dueDate ? ` · ${formatDueDate(task.dueDate)}` : "";
          const link = document.createElement("span");
          link.className = "agendaTaskLink";
          link.dataset.taskId = task.id;
          link.setAttribute("role", "button");
          link.tabIndex = 0;
          link.textContent = `${task.title}${due}`;
          li.appendChild(link);
          list.appendChild(li);
        });
    });
  }

  // Init
  renderLoadingState();
  initAgendaTaskHandlers();
  return { injectApiTasks };
}
