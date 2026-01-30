import { putFile, getFile, deleteFile } from "../shared/js/filesStore.js";

const ACCESS_KEY = "ttd_teacherAccess";
const DATA_KEY = "ttd_teacherData";
const GROUP_KEY = "ttd_teacherGroup";
const THEME_KEY = "ttdTheme";

const STATUS_CONFIG = {
  needs_teacher: { label: "Necesita profesor", emoji: "🔴" },
  pending: { label: "Pendiente", emoji: "🟡" },
  submitted: { label: "Ok", emoji: "🟢" }
};

const TYPE_LABELS = {
  homework: "Deberes",
  exam: "Exámenes",
  work: "Trabajos"
};

const appRoot = document.getElementById("teacherApp");

let elements = {};

let state = {
  data: null,
  currentGroupId: null,
  range: "today",
  activeTicketId: null,
  activeTaskId: null
};

let pendingAttachments = [];

function getSystemTheme() {
  try {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "dark";
  }
}

function getSavedTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return (t === "dark" || t === "light") ? t : "";
  } catch {
    return "";
  }
}

function applyTheme(theme) {
  const t = (theme === "dark" || theme === "light") ? theme : (getSystemTheme() || "dark");
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(THEME_KEY, t); } catch {}
}

function updateThemeToggleLabel(btn) {
  if (!btn) return;
  const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
  btn.textContent = current === "dark" ? "Claro" : "Oscuro";
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatFileSize(size) {
  if (!size && size !== 0) return "";
  if (size < 1024) return `${size} B`;
  const kb = size / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function seedData() {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const later = addDays(today, 4);
  const week = addDays(today, 6);

  const groups = [
    { id: "g1", name: "1º ESO A" },
    { id: "g2", name: "1º ESO B" },
    { id: "g3", name: "2º ESO A" }
  ];

  const students = [
    { id: "s1", name: "Lucía Torres", groupId: "g1", status: "pending" },
    { id: "s2", name: "Marco Gil", groupId: "g1", status: "submitted" },
    { id: "s3", name: "Elena Ramos", groupId: "g2", status: "needs_teacher" },
    { id: "s4", name: "Hugo Pérez", groupId: "g2", status: "pending" },
    { id: "s5", name: "Noa Martín", groupId: "g3", status: "submitted" }
  ];

  const tasks = [
    {
      id: "t1",
      type: "homework",
      title: "Lectura capítulo 2",
      dueDate: formatDate(today),
      desc: "Apuntar dudas clave.",
      groupId: "g1",
      createdAt: Date.now()
    },
    {
      id: "t2",
      type: "exam",
      title: "Control rápido de verbos",
      dueDate: formatDate(tomorrow),
      desc: "15 minutos en clase.",
      groupId: "g2",
      createdAt: Date.now()
    },
    {
      id: "t3",
      type: "work",
      title: "Trabajo en parejas: ecosistemas",
      dueDate: formatDate(later),
      desc: "Entregar presentación.",
      groupId: "g3",
      createdAt: Date.now()
    },
    {
      id: "t4",
      type: "homework",
      title: "Ejercicios 12-18",
      dueDate: formatDate(week),
      desc: "Resolver en el cuaderno.",
      groupId: "g2",
      createdAt: Date.now()
    }
  ];

  const tickets = [
    {
      id: "k1",
      title: "No entiendo la ecuación 4",
      detail: "He intentado aislar x pero me pierdo en el paso 3.",
      studentId: "s3",
      groupId: "g2",
      status: "open",
      createdAt: formatDate(today)
    },
    {
      id: "k2",
      title: "Revisión de trabajo en parejas",
      detail: "¿Podemos mover la fecha de entrega?",
      studentId: "s1",
      groupId: "g1",
      status: "open",
      createdAt: formatDate(tomorrow)
    }
  ];

  return {
    groups,
    students,
    tasks,
    taskStatus: {},
    tickets
  };
}

function loadData() {
  const raw = localStorage.getItem(DATA_KEY);
  if (!raw) {
    const seeded = seedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const seeded = seedData();
    localStorage.setItem(DATA_KEY, JSON.stringify(seeded));
    return seeded;
  }
}

function saveData() {
  localStorage.setItem(DATA_KEY, JSON.stringify(state.data));
}

function setOverlay(overlay, open) {
  if (!overlay) return;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", open ? "false" : "true");
}

function hasAccess() {
  return localStorage.getItem(ACCESS_KEY) === "1";
}

function normalizeCode(value) {
  return value.trim().toLowerCase();
}

function getLoginTemplate() {
  return `
    <div class="loginView">
      <div class="loginCard">
        <span class="tag">Tutordigital</span>
        <h1>Zona docente</h1>
        <p>Introduce el código de acceso para continuar.</p>
        <div class="formField">
          <label for="accessCode">Código</label>
          <input id="accessCode" type="password" placeholder="lyceo" autocomplete="one-time-code">
        </div>
        <div class="modalActions">
          <button class="btn primary" id="accessBtn" type="button">Entrar</button>
        </div>
        <p class="hint">Código demo: <strong>lyceo</strong></p>
      </div>
    </div>
  `;
}

function getDashboardTemplate() {
  return `
    <main class="appShell" role="main">
      <header class="appHeader">
        <div class="brand">
          <span class="tag">Tutordigital</span>
          <div>
            <h1>Zona docente</h1>
            <p>Panel rápido de grupos, tareas y tickets.</p>
          </div>
        </div>
        <div class="headerActions">
          <label class="groupSelect">
            <span>Grupo</span>
            <select id="groupSelect" aria-label="Seleccionar grupo"></select>
          </label>
          <button class="headerAction" id="themeToggle" type="button" aria-label="Cambiar tema">
            Claro
          </button>
          <a class="headerAction" href="/index.html">Inicio</a>
          <button class="headerAction" id="logoutBtn" type="button">Cerrar sesión</button>
        </div>
      </header>

      <section class="appGrid">
        <section class="panel studentsPanel">
          <div class="panelHeader">
            <h2>Alumnos</h2>
            <button class="btn primary" id="addStudentBtn" type="button">+ Añadir alumno</button>
          </div>
          <ul class="studentList" id="studentList"></ul>
          <p class="emptyState" id="studentEmpty">No hay alumnos en este grupo.</p>
        </section>

        <section class="panel tasksPanel">
          <div class="panelHeader">
            <div>
              <h2>Agenda</h2>
              <span class="panelHint">Filtra por fecha</span>
            </div>
            <div class="taskActions">
              <div class="tabs" role="tablist" aria-label="Filtrar tareas">
                <button class="tabBtn is-active" data-range="today" type="button">Hoy</button>
                <button class="tabBtn" data-range="tomorrow" type="button">Mañana</button>
                <button class="tabBtn" data-range="week" type="button">7 días</button>
              </div>
              <button class="btn primary" id="addTaskBtn" type="button">+ Añadir</button>
            </div>
          </div>

          <div class="taskSections">
            <section class="taskSection">
              <h3>Deberes</h3>
              <div class="taskList" id="taskListHomework"></div>
              <p class="emptyState" id="emptyHomework">Sin deberes en este rango.</p>
            </section>
            <section class="taskSection">
              <h3>Exámenes</h3>
              <div class="taskList" id="taskListExam"></div>
              <p class="emptyState" id="emptyExam">Sin exámenes en este rango.</p>
            </section>
            <section class="taskSection">
              <h3>Trabajos</h3>
              <div class="taskList" id="taskListWork"></div>
              <p class="emptyState" id="emptyWork">Sin trabajos en este rango.</p>
            </section>
          </div>
        </section>

        <section class="panel ticketsPanel">
          <div class="panelHeader">
            <h2>Necesita profesor</h2>
            <span class="panelHint">Tickets abiertos</span>
          </div>
          <ul class="ticketList" id="ticketList"></ul>
          <p class="emptyState" id="ticketEmpty">No hay tickets abiertos.</p>
        </section>
      </section>
    </main>

    <div class="modalOverlay" id="studentModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2>Nuevo alumno</h2>
          <button class="iconBtn" data-close="studentModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="studentForm">
          <div class="formGrid">
            <div class="formField">
              <label for="studentName">Nombre</label>
              <input id="studentName" name="name" type="text" placeholder="Ej. Ana" required>
            </div>
            <div class="formField">
              <label for="studentSurname">Apellidos</label>
              <input id="studentSurname" name="surname" type="text" placeholder="Ej. López García" required>
            </div>
            <div class="formField">
              <label for="studentGroup">Grupo</label>
              <div class="groupFixed" id="studentGroupLabel" aria-live="polite"></div>
              <input id="studentGroup" name="groupId" type="hidden" required>
            </div>
          </div>
          <div class="modalActions">
            <button class="btn ghost" data-close="studentModal" type="button">Cancelar</button>
            <button class="btn primary" type="submit">Guardar alumno</button>
          </div>
        </form>
      </div>
    </div>

    <div class="modalOverlay" id="taskModal" aria-hidden="true">
      <div class="modalCard wide">
        <div class="modalHeader">
          <h2>Nueva tarea</h2>
          <button class="iconBtn" data-close="taskModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <form id="taskForm">
          <div class="formGrid">
            <div class="formField">
              <label for="taskType">Tipo</label>
              <select id="taskType" name="type" required>
                <option value="homework">Deberes</option>
                <option value="exam">Exámenes</option>
                <option value="work">Trabajos</option>
              </select>
            </div>
            <div class="formField">
              <label for="taskTitle">Título</label>
              <input id="taskTitle" name="title" type="text" placeholder="Ej. Lectura capítulo 3" required>
            </div>
            <div class="formField">
              <label for="taskDate">Fecha de entrega</label>
              <input id="taskDate" name="dueDate" type="date" required>
            </div>
            <div class="formField">
              <label for="taskGroup">Grupo</label>
              <div class="groupFixed" id="taskGroupLabel" aria-live="polite"></div>
              <input id="taskGroup" name="groupId" type="hidden" required>
            </div>
          </div>
        <div class="formField">
          <label for="taskDesc">Descripción (opcional)</label>
          <textarea id="taskDesc" name="desc" rows="3" placeholder="Notas para el grupo"></textarea>
        </div>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
            <button class="btn ghost" id="taskAddFileBtn" type="button">Añadir archivo</button>
          </div>
          <input id="taskFileInput" type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" hidden>
          <ul class="attachmentList" id="taskAttachmentList"></ul>
          <p class="hint" id="taskAttachmentEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskModal" type="button">Cancelar</button>
          <button class="btn primary" type="submit">Guardar tarea</button>
        </div>
      </form>
      </div>
    </div>

    <div class="modalOverlay" id="ticketModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2 id="ticketTitle">Ticket</h2>
          <button class="iconBtn" data-close="ticketModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="ticketDetail" id="ticketDetail"></div>
        <div class="modalActions">
          <button class="btn ghost" data-close="ticketModal" type="button">Cerrar</button>
          <button class="btn primary" id="ticketResolveBtn" type="button">Marcar resuelto</button>
        </div>
      </div>
    </div>

    <div class="modalOverlay" id="taskDetailModal" aria-hidden="true">
      <div class="modalCard">
        <div class="modalHeader">
          <h2 id="taskDetailTitle">Tarea</h2>
          <button class="iconBtn" data-close="taskDetailModal" type="button" aria-label="Cerrar">✕</button>
        </div>
        <div class="ticketDetail" id="taskDetailBody"></div>
        <div class="attachmentsBlock">
          <div class="attachmentsHeader">
            <div>Adjuntos</div>
          </div>
          <ul class="attachmentList" id="taskDetailAttachments"></ul>
          <p class="hint" id="taskDetailEmpty">Sin adjuntos.</p>
        </div>
        <div class="modalActions">
          <button class="btn ghost" data-close="taskDetailModal" type="button">Cerrar</button>
        </div>
      </div>
    </div>
  `;
}

function cacheDashboardElements() {
  elements = {
    groupSelect: document.getElementById("groupSelect"),
    taskGroupLabel: document.getElementById("taskGroupLabel"),
    themeToggle: document.getElementById("themeToggle"),
    studentList: document.getElementById("studentList"),
    studentEmpty: document.getElementById("studentEmpty"),
    addStudentBtn: document.getElementById("addStudentBtn"),
    studentModal: document.getElementById("studentModal"),
    studentForm: document.getElementById("studentForm"),
    studentName: document.getElementById("studentName"),
    studentSurname: document.getElementById("studentSurname"),
    studentGroup: document.getElementById("studentGroup"),
    studentGroupLabel: document.getElementById("studentGroupLabel"),
    ticketList: document.getElementById("ticketList"),
    ticketEmpty: document.getElementById("ticketEmpty"),
    tabs: document.querySelectorAll(".tabBtn"),
    addTaskBtn: document.getElementById("addTaskBtn"),
    tasksPanel: document.querySelector(".tasksPanel"),
    taskListHomework: document.getElementById("taskListHomework"),
    taskListExam: document.getElementById("taskListExam"),
    taskListWork: document.getElementById("taskListWork"),
    emptyHomework: document.getElementById("emptyHomework"),
    emptyExam: document.getElementById("emptyExam"),
    emptyWork: document.getElementById("emptyWork"),
    logoutBtn: document.getElementById("logoutBtn"),
    taskModal: document.getElementById("taskModal"),
    taskForm: document.getElementById("taskForm"),
    taskType: document.getElementById("taskType"),
    taskTitle: document.getElementById("taskTitle"),
    taskDate: document.getElementById("taskDate"),
    taskGroup: document.getElementById("taskGroup"),
    taskDesc: document.getElementById("taskDesc"),
    taskAddFileBtn: document.getElementById("taskAddFileBtn"),
    taskFileInput: document.getElementById("taskFileInput"),
    taskAttachmentList: document.getElementById("taskAttachmentList"),
    taskAttachmentEmpty: document.getElementById("taskAttachmentEmpty"),
    ticketModal: document.getElementById("ticketModal"),
    ticketTitle: document.getElementById("ticketTitle"),
    ticketDetail: document.getElementById("ticketDetail"),
    ticketResolveBtn: document.getElementById("ticketResolveBtn"),
    taskDetailModal: document.getElementById("taskDetailModal"),
    taskDetailTitle: document.getElementById("taskDetailTitle"),
    taskDetailBody: document.getElementById("taskDetailBody"),
    taskDetailAttachments: document.getElementById("taskDetailAttachments"),
    taskDetailEmpty: document.getElementById("taskDetailEmpty")
  };
}

function cacheLoginElements() {
  elements = {
    accessCode: document.getElementById("accessCode"),
    accessBtn: document.getElementById("accessBtn")
  };
}

function getCurrentGroup() {
  return state.data.groups.find(group => group.id === state.currentGroupId) || state.data.groups[0];
}

function renderGroups() {
  if (!elements.groupSelect || !elements.taskGroup) return;

  elements.groupSelect.innerHTML = "";

  state.data.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    elements.groupSelect.appendChild(option.cloneNode(true));
  });

  elements.groupSelect.value = state.currentGroupId;
  elements.taskGroup.value = state.currentGroupId;
  if (elements.studentGroup) {
    elements.studentGroup.value = state.currentGroupId;
  }

  if (elements.taskGroupLabel) {
    const group = getCurrentGroup();
    elements.taskGroupLabel.textContent = group ? group.name : "Grupo";
  }

  if (elements.studentGroupLabel) {
    const group = getCurrentGroup();
    elements.studentGroupLabel.textContent = group ? group.name : "Grupo";
  }
}

function renderStudents() {
  const groupId = state.currentGroupId;
  const students = state.data.students.filter(student => student.groupId === groupId);

  elements.studentList.innerHTML = "";

  students.forEach(student => {
    const status = STATUS_CONFIG[student.status] || STATUS_CONFIG.pending;
    const item = document.createElement("li");
    item.className = "studentItem";
    item.innerHTML = `
      <div class="studentInfo">
        <span class="statusDot">${status.emoji}</span>
        <div>
          <div class="studentName">${student.name}</div>
          <div class="studentMeta">${status.label}</div>
        </div>
      </div>
      <select class="statusSelect" data-student-id="${student.id}">
        <option value="pending">Pendiente</option>
        <option value="submitted">Ok</option>
        <option value="needs_teacher">Necesita profesor</option>
      </select>
    `;

    const select = item.querySelector("select");
    select.value = student.status;
    elements.studentList.appendChild(item);
  });

  elements.studentEmpty.style.display = students.length ? "none" : "block";
}

function filterTasks() {
  const groupId = state.currentGroupId;
  const today = new Date();
  const start = parseDate(formatDate(today));
  let end = start;

  if (state.range === "tomorrow") {
    start.setDate(start.getDate() + 1);
    end = new Date(start);
  } else if (state.range === "week") {
    end = addDays(start, 6);
  }

  return state.data.tasks.filter(task => {
    if (task.groupId !== groupId) return false;
    const due = parseDate(task.dueDate);
    return due >= start && due <= end;
  });
}

function taskMeta(task) {
  const group = state.data.groups.find(g => g.id === task.groupId);
  const due = parseDate(task.dueDate);
  const label = due.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  return `${label} · ${group ? group.name : "Grupo"}`;
}

function renderPlanner() {
  const tasks = filterTasks();
  const sections = {
    homework: [],
    exam: [],
    work: []
  };

  tasks.forEach(task => {
    if (sections[task.type]) sections[task.type].push(task);
  });

  Object.keys(sections).forEach(type => {
    sections[type].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  });

  renderTaskList(elements.taskListHomework, sections.homework);
  renderTaskList(elements.taskListExam, sections.exam);
  renderTaskList(elements.taskListWork, sections.work);

  elements.emptyHomework.style.display = sections.homework.length ? "none" : "block";
  elements.emptyExam.style.display = sections.exam.length ? "none" : "block";
  elements.emptyWork.style.display = sections.work.length ? "none" : "block";
}

function renderTaskList(container, tasks) {
  container.innerHTML = "";
  tasks.forEach(task => {
    const attachmentCount = (task.attachments || []).length;
    const item = document.createElement("div");
    item.className = "taskItem";
    item.dataset.taskId = task.id;
    item.innerHTML = `
      <button class="taskDeleteBtn" data-task-id="${task.id}" type="button" aria-label="Eliminar tarea">✕</button>
      <div class="taskTitle">${task.title}</div>
      <div class="taskMeta">${taskMeta(task)}</div>
      ${attachmentCount ? `<span class="taskChip">📎 ${attachmentCount} adjunto${attachmentCount === 1 ? "" : "s"}</span>` : ""}
      ${task.desc ? `<div class="taskMeta">${task.desc}</div>` : ""}
    `;
    container.appendChild(item);
  });
}

function renderPendingAttachments() {
  if (!elements.taskAttachmentList) return;
  elements.taskAttachmentList.innerHTML = "";
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
    elements.taskAttachmentList.appendChild(li);
  });
  elements.taskAttachmentEmpty.style.display = pendingAttachments.length ? "none" : "block";
}

function renderTickets() {
  const groupId = state.currentGroupId;
  const openTickets = state.data.tickets.filter(ticket => ticket.status === "open" && ticket.groupId === groupId);

  elements.ticketList.innerHTML = "";

  openTickets.forEach(ticket => {
    const student = state.data.students.find(item => item.id === ticket.studentId);
    const item = document.createElement("li");
    item.className = "ticketItem";
    item.innerHTML = `
      <div class="ticketInfo">
        <div class="ticketTitle">${ticket.title}</div>
        <div class="ticketMeta">${student ? student.name : "Alumno"} · ${ticket.createdAt}</div>
      </div>
      <div class="ticketActions">
        <button class="btn ghost" data-action="open" data-ticket-id="${ticket.id}">Abrir</button>
        <button class="btn primary" data-action="resolve" data-ticket-id="${ticket.id}">Marcar resuelto</button>
      </div>
    `;
    elements.ticketList.appendChild(item);
  });

  elements.ticketEmpty.style.display = openTickets.length ? "none" : "block";
}

function renderAll() {
  renderGroups();
  renderStudents();
  renderPlanner();
  renderTickets();
}

function setRange(range) {
  state.range = range;
  elements.tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.range === range);
  });
  renderPlanner();
}

function openTaskModal() {
  elements.taskForm.reset();
  pendingAttachments = [];
  renderPendingAttachments();
  elements.taskGroup.value = state.currentGroupId;
  setOverlay(elements.taskModal, true);
}

function closeTaskModal() {
  setOverlay(elements.taskModal, false);
}

function openStudentModal() {
  elements.studentForm.reset();
  elements.studentGroup.value = state.currentGroupId;
  if (elements.studentGroupLabel) {
    const group = getCurrentGroup();
    elements.studentGroupLabel.textContent = group ? group.name : "Grupo";
  }
  setOverlay(elements.studentModal, true);
}

function closeStudentModal() {
  setOverlay(elements.studentModal, false);
}

function openTicketModal(ticketId) {
  const ticket = state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;

  const student = state.data.students.find(item => item.id === ticket.studentId);
  const group = state.data.groups.find(item => item.id === ticket.groupId);
  elements.ticketTitle.textContent = ticket.title;
  elements.ticketDetail.innerHTML = `
    <div><strong>Alumno:</strong> ${student ? student.name : "-"}</div>
    <div><strong>Grupo:</strong> ${group ? group.name : "-"}</div>
    <div><strong>Fecha:</strong> ${ticket.createdAt}</div>
    <div><strong>Detalle:</strong></div>
    <div>${ticket.detail}</div>
  `;
  state.activeTicketId = ticketId;
  setOverlay(elements.ticketModal, true);
}

function closeTicketModal() {
  setOverlay(elements.ticketModal, false);
  state.activeTicketId = null;
}

function openTaskDetailModal(taskId) {
  const task = state.data.tasks.find(item => item.id === taskId);
  if (!task) return;
  const group = state.data.groups.find(item => item.id === task.groupId);
  elements.taskDetailTitle.textContent = task.title;
  elements.taskDetailBody.innerHTML = `
    <div><strong>Tipo:</strong> ${TYPE_LABELS[task.type] || "Tarea"}</div>
    <div><strong>Grupo:</strong> ${group ? group.name : "-"}</div>
    <div><strong>Entrega:</strong> ${task.dueDate}</div>
    ${task.desc ? `<div><strong>Descripción:</strong></div><div>${task.desc}</div>` : ""}
  `;
  renderTaskDetailAttachments(task.attachments || []);
  state.activeTaskId = taskId;
  setOverlay(elements.taskDetailModal, true);
}

function closeTaskDetailModal() {
  setOverlay(elements.taskDetailModal, false);
  state.activeTaskId = null;
}

function renderTaskDetailAttachments(attachments) {
  elements.taskDetailAttachments.innerHTML = "";
  attachments.forEach(file => {
    const li = document.createElement("li");
    li.className = "attachmentItem";
    li.innerHTML = `
      <div class="attachmentInfo">
        <div class="attachmentName">${file.name}</div>
        <div class="attachmentMeta">${formatFileSize(file.size)}</div>
      </div>
      <div class="attachmentActions">
        <button class="btn ghost" data-file-action="open" data-file-id="${file.id}" type="button">Abrir</button>
        <button class="btn primary" data-file-action="download" data-file-id="${file.id}" type="button">Descargar</button>
      </div>
    `;
    elements.taskDetailAttachments.appendChild(li);
  });
  elements.taskDetailEmpty.style.display = attachments.length ? "none" : "block";
}

function resolveTicket(ticketId) {
  const ticket = state.data.tickets.find(item => item.id === ticketId);
  if (!ticket) return;
  ticket.status = "resolved";
  saveData();
  renderTickets();
}

function handleStudentStatusChange(event) {
  const select = event.target.closest(".statusSelect");
  if (!select) return;
  const student = state.data.students.find(item => item.id === select.dataset.studentId);
  if (!student) return;
  student.status = select.value;
  saveData();
  renderStudents();
  renderTickets();
}

function handleTicketActions(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const ticketId = button.dataset.ticketId;
  if (button.dataset.action === "open") {
    openTicketModal(ticketId);
  }
  if (button.dataset.action === "resolve") {
    resolveTicket(ticketId);
  }
}

async function deleteTaskById(taskId) {
  const taskIndex = state.data.tasks.findIndex(task => task.id === taskId);
  if (taskIndex === -1) return;

  const task = state.data.tasks[taskIndex];
  const attachments = task.attachments || [];
  for (const attachment of attachments) {
    try {
      await deleteFile(attachment.id);
    } catch (error) {
      console.warn("No se pudo borrar adjunto:", error);
    }
  }

  state.data.tasks.splice(taskIndex, 1);
  if (state.data.taskStatus && typeof state.data.taskStatus === "object") {
    delete state.data.taskStatus[taskId];
  }

  saveData();
  renderPlanner();
}

function handleTaskDelete(event) {
  const button = event.target.closest(".taskDeleteBtn");
  if (!button) return false;
  const taskId = button.dataset.taskId;
  if (!taskId) return true;
  const ok = confirm("¿Eliminar esta tarea?");
  if (!ok) return true;
  deleteTaskById(taskId);
  return true;
}

function generateId() {
  if (crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `f_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function handleAttachmentInput(event) {
  const files = Array.from(event.target.files || []);
  files.forEach(file => {
    pendingAttachments.push({ id: generateId(), file });
  });
  event.target.value = "";
  renderPendingAttachments();
}

function handleAttachmentRemove(event) {
  const button = event.target.closest("button[data-attachment-id]");
  if (!button) return;
  const id = button.dataset.attachmentId;
  pendingAttachments = pendingAttachments.filter(item => item.id !== id);
  renderPendingAttachments();
}

async function handleAttachmentAction(event) {
  const button = event.target.closest("button[data-file-action]");
  if (!button) return;
  const id = button.dataset.fileId;
  const action = button.dataset.fileAction;
  try {
    const record = await getFile(id);
    if (!record || !record.blob) return;
    const url = URL.createObjectURL(record.blob);
    const link = document.createElement("a");
    link.href = url;
    if (action === "open") {
      link.target = "_blank";
      link.rel = "noopener";
    } else {
      link.download = record.name || "adjunto";
    }
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    console.warn("No se pudo abrir el adjunto:", error);
  }
}

function refreshData() {
  state.data = loadData();
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const type = elements.taskType.value;
  const title = elements.taskTitle.value.trim();
  const dueDate = elements.taskDate.value;
  const desc = elements.taskDesc.value.trim();
  const groupId = elements.taskGroup.value;

  if (!title || !dueDate || !groupId) return;

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

  state.data.tasks.push({
    id: `t${Date.now()}`,
    type,
    title,
    dueDate,
    desc,
    groupId,
    attachments,
    createdAt: Date.now()
  });

  saveData();
  closeTaskModal();
  refreshData();
  renderPlanner();
  renderTickets();
  renderStudents();
}

function handleStudentSubmit(event) {
  event.preventDefault();
  const name = elements.studentName.value.trim();
  const surname = elements.studentSurname.value.trim();
  const groupId = elements.studentGroup.value;
  if (!name || !surname || !groupId) return;

  state.data.students.push({
    id: `s${Date.now()}`,
    name: `${name} ${surname}`.trim(),
    groupId,
    status: "pending"
  });

  saveData();
  closeStudentModal();
  refreshData();
  renderStudents();
  renderTickets();
}

function initDashboardEvents() {
  if (elements.themeToggle) {
    updateThemeToggleLabel(elements.themeToggle);
    elements.themeToggle.addEventListener("click", () => {
      const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
      const next = current === "dark" ? "light" : "dark";
      applyTheme(next);
      updateThemeToggleLabel(elements.themeToggle);
    });
  }

  elements.groupSelect?.addEventListener("change", event => {
    state.currentGroupId = event.target.value;
    localStorage.setItem(GROUP_KEY, state.currentGroupId);
    renderAll();
  });

  elements.studentList?.addEventListener("change", handleStudentStatusChange);
  elements.ticketList?.addEventListener("click", handleTicketActions);

  elements.tabs.forEach(tab => {
    tab.addEventListener("click", () => setRange(tab.dataset.range));
  });

  elements.addTaskBtn?.addEventListener("click", openTaskModal);
  elements.addStudentBtn?.addEventListener("click", openStudentModal);
  elements.taskForm?.addEventListener("submit", handleTaskSubmit);
  elements.studentForm?.addEventListener("submit", handleStudentSubmit);
  elements.taskAddFileBtn?.addEventListener("click", () => elements.taskFileInput?.click());
  elements.taskFileInput?.addEventListener("change", handleAttachmentInput);
  elements.taskAttachmentList?.addEventListener("click", handleAttachmentRemove);
  elements.tasksPanel?.addEventListener("click", event => {
    if (handleTaskDelete(event)) return;
    const item = event.target.closest(".taskItem");
    if (!item || !item.dataset.taskId) return;
    openTaskDetailModal(item.dataset.taskId);
  });
  elements.taskDetailAttachments?.addEventListener("click", handleAttachmentAction);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.close;
      if (target === "taskModal") closeTaskModal();
      if (target === "studentModal") closeStudentModal();
      if (target === "ticketModal") closeTicketModal();
      if (target === "taskDetailModal") closeTaskDetailModal();
    });
  });

  elements.taskModal?.addEventListener("click", event => {
    if (event.target === elements.taskModal) closeTaskModal();
  });

  elements.studentModal?.addEventListener("click", event => {
    if (event.target === elements.studentModal) closeStudentModal();
  });

  elements.ticketModal?.addEventListener("click", event => {
    if (event.target === elements.ticketModal) closeTicketModal();
  });

  elements.taskDetailModal?.addEventListener("click", event => {
    if (event.target === elements.taskDetailModal) closeTaskDetailModal();
  });

  elements.logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(ACCESS_KEY);
    renderLoginView();
  });

  elements.ticketResolveBtn?.addEventListener("click", () => {
    if (!state.activeTicketId) return;
    resolveTicket(state.activeTicketId);
    closeTicketModal();
  });
}

function initLoginEvents() {
  elements.accessBtn?.addEventListener("click", () => {
    const code = normalizeCode(elements.accessCode.value);
    if (code === "lyceo" || code === "liceo") {
      localStorage.setItem(ACCESS_KEY, "1");
      elements.accessCode.value = "";
      renderDashboard();
    } else {
      elements.accessCode.focus();
    }
  });

  elements.accessCode?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      elements.accessBtn.click();
    }
  });
}

function renderLoginView() {
  appRoot.innerHTML = getLoginTemplate();
  cacheLoginElements();
  initLoginEvents();
  elements.accessCode?.focus();
}

function renderDashboard() {
  appRoot.innerHTML = getDashboardTemplate();
  cacheDashboardElements();
  renderAll();
  initDashboardEvents();
}

function init() {
  const savedTheme = getSavedTheme();
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    applyTheme(getSystemTheme() || "dark");
  }

  state.data = loadData();
  state.currentGroupId = localStorage.getItem(GROUP_KEY) || state.data.groups[0]?.id;
  if (hasAccess()) {
    renderDashboard();
  } else {
    renderLoginView();
  }
}

init();
