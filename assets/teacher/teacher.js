const ACCESS_KEY = "ttd_teacherAccess";
const DATA_KEY = "ttd_teacherData";
const GROUP_KEY = "ttd_teacherGroup";

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

const elements = {
  groupSelect: document.getElementById("groupSelect"),
  studentList: document.getElementById("studentList"),
  studentEmpty: document.getElementById("studentEmpty"),
  ticketList: document.getElementById("ticketList"),
  ticketEmpty: document.getElementById("ticketEmpty"),
  tabs: document.querySelectorAll(".tabBtn"),
  addTaskBtn: document.getElementById("addTaskBtn"),
  taskListHomework: document.getElementById("taskListHomework"),
  taskListExam: document.getElementById("taskListExam"),
  taskListWork: document.getElementById("taskListWork"),
  emptyHomework: document.getElementById("emptyHomework"),
  emptyExam: document.getElementById("emptyExam"),
  emptyWork: document.getElementById("emptyWork"),
  logoutBtn: document.getElementById("logoutBtn"),
  loginOverlay: document.getElementById("loginOverlay"),
  accessCode: document.getElementById("accessCode"),
  accessBtn: document.getElementById("accessBtn"),
  taskModal: document.getElementById("taskModal"),
  taskForm: document.getElementById("taskForm"),
  taskType: document.getElementById("taskType"),
  taskTitle: document.getElementById("taskTitle"),
  taskDate: document.getElementById("taskDate"),
  taskGroup: document.getElementById("taskGroup"),
  taskDesc: document.getElementById("taskDesc"),
  ticketModal: document.getElementById("ticketModal"),
  ticketTitle: document.getElementById("ticketTitle"),
  ticketDetail: document.getElementById("ticketDetail"),
  ticketResolveBtn: document.getElementById("ticketResolveBtn")
};

let state = {
  data: null,
  currentGroupId: null,
  range: "today",
  activeTicketId: null
};

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

function diffInDays(dateA, dateB) {
  const ms = parseDate(formatDate(dateA)).getTime() - parseDate(formatDate(dateB)).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
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

function ensureAccess() {
  const hasAccess = localStorage.getItem(ACCESS_KEY) === "1";
  setOverlay(elements.loginOverlay, !hasAccess);
  if (!hasAccess) {
    elements.accessCode?.focus();
  }
}

function getCurrentGroup() {
  return state.data.groups.find(group => group.id === state.currentGroupId) || state.data.groups[0];
}

function renderGroups() {
  if (!elements.groupSelect || !elements.taskGroup) return;

  elements.groupSelect.innerHTML = "";
  elements.taskGroup.innerHTML = "";

  state.data.groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    elements.groupSelect.appendChild(option.cloneNode(true));
    elements.taskGroup.appendChild(option);
  });

  elements.groupSelect.value = state.currentGroupId;
  elements.taskGroup.value = state.currentGroupId;
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

function renderTasks() {
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
    const item = document.createElement("div");
    item.className = "taskItem";
    item.innerHTML = `
      <div class="taskTitle">${task.title}</div>
      <div class="taskMeta">${taskMeta(task)}</div>
      ${task.desc ? `<div class="taskMeta">${task.desc}</div>` : ""}
    `;
    container.appendChild(item);
  });
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
  renderTasks();
  renderTickets();
}

function setRange(range) {
  state.range = range;
  elements.tabs.forEach(tab => {
    tab.classList.toggle("is-active", tab.dataset.range === range);
  });
  renderTasks();
}

function openTaskModal() {
  elements.taskForm.reset();
  elements.taskGroup.value = state.currentGroupId;
  setOverlay(elements.taskModal, true);
}

function closeTaskModal() {
  setOverlay(elements.taskModal, false);
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

function handleTaskSubmit(event) {
  event.preventDefault();
  const type = elements.taskType.value;
  const title = elements.taskTitle.value.trim();
  const dueDate = elements.taskDate.value;
  const desc = elements.taskDesc.value.trim();
  const groupId = elements.taskGroup.value;

  if (!title || !dueDate || !groupId) return;

  state.data.tasks.push({
    id: `t${Date.now()}`,
    type,
    title,
    dueDate,
    desc,
    groupId,
    createdAt: Date.now()
  });

  saveData();
  closeTaskModal();
  renderTasks();
}

function initEvents() {
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
  elements.taskForm?.addEventListener("submit", handleTaskSubmit);

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.close;
      if (target === "taskModal") closeTaskModal();
      if (target === "ticketModal") closeTicketModal();
    });
  });

  elements.taskModal?.addEventListener("click", event => {
    if (event.target === elements.taskModal) closeTaskModal();
  });

  elements.ticketModal?.addEventListener("click", event => {
    if (event.target === elements.ticketModal) closeTicketModal();
  });

  elements.accessBtn?.addEventListener("click", () => {
    const code = elements.accessCode.value.trim().toUpperCase();
    if (code === "LYCEO") {
      localStorage.setItem(ACCESS_KEY, "1");
      elements.accessCode.value = "";
      ensureAccess();
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

  elements.logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem(ACCESS_KEY);
    ensureAccess();
  });

  elements.ticketResolveBtn?.addEventListener("click", () => {
    if (!state.activeTicketId) return;
    resolveTicket(state.activeTicketId);
    closeTicketModal();
  });
}

function init() {
  state.data = loadData();
  state.currentGroupId = localStorage.getItem(GROUP_KEY) || state.data.groups[0]?.id;
  renderAll();
  initEvents();
  ensureAccess();
}

init();
