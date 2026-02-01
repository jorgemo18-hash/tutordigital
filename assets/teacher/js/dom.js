export function cacheDashboardElements() {
  return {
    groupSelect: document.getElementById("groupSelect"),
    addGroupBtn: document.getElementById("addGroupBtn"),
    taskGroupLabel: document.getElementById("taskGroupLabel"),
    themeToggle: document.getElementById("themeToggle"),
    studentList: document.getElementById("studentList"),
    studentEmpty: document.getElementById("studentEmpty"),
    addStudentBtn: document.getElementById("addStudentBtn"),
    studentOrder: document.getElementById("studentOrder"),
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
    taskDetailEmpty: document.getElementById("taskDetailEmpty"),
    notebookMode: document.getElementById("notebookMode"),
    notebookMonthWrap: document.getElementById("notebookMonthWrap"),
    notebookMonth: document.getElementById("notebookMonth"),
    notebookTermWrap: document.getElementById("notebookTermWrap"),
    notebookTerm: document.getElementById("notebookTerm"),
    notebookGrid: document.getElementById("notebookGrid"),
    notebookEmpty: document.getElementById("notebookEmpty"),
    notebookDetailModal: document.getElementById("notebookDetailModal"),
    notebookDetailTitle: document.getElementById("notebookDetailTitle"),
    notebookDetailBody: document.getElementById("notebookDetailBody"),
    gradesModal: document.getElementById("gradesModal"),
    gradesTitle: document.getElementById("gradesTitle"),
    gradeForm: document.getElementById("gradeForm"),
    gradeTitle: document.getElementById("gradeTitle"),
    gradeDate: document.getElementById("gradeDate"),
    gradeScore: document.getElementById("gradeScore"),
    gradeList: document.getElementById("gradeList"),
    gradeEmpty: document.getElementById("gradeEmpty")
  };
}

export function cacheLoginElements() {
  return {
    accessCode: document.getElementById("accessCode"),
    accessBtn: document.getElementById("accessBtn")
  };
}

export function setOverlay(overlay, open) {
  if (!overlay) return;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", open ? "false" : "true");
}

export function getCurrentGroup(state) {
  return state.data.groups.find(group => group.id === state.currentGroupId) || state.data.groups[0];
}

export function renderGroups(ctx) {
  const { elements, state } = ctx;
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
    const group = getCurrentGroup(state);
    elements.taskGroupLabel.textContent = group ? group.name : "Grupo";
  }

  if (elements.studentGroupLabel) {
    const group = getCurrentGroup(state);
    elements.studentGroupLabel.textContent = group ? group.name : "Grupo";
  }
}
