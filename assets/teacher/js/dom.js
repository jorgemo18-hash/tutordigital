export function cacheDashboardElements() {
  return {
    groupSelect: document.getElementById("groupSelect"),
    addGroupBtn: document.getElementById("addGroupBtn"),
    teacherSelect: document.getElementById("teacherSelect"),
    homeLink: document.getElementById("homeLink"),
    tenantName: document.getElementById("tenantName"),
    tenantPill: document.getElementById("tenantPill"),
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
    gradeEmpty: document.getElementById("gradeEmpty"),
    groupModal: document.getElementById("groupModal"),
    groupForm: document.getElementById("groupForm"),
    groupLevel: document.getElementById("groupLevel"),
    groupGrade: document.getElementById("groupGrade"),
    groupLetter: document.getElementById("groupLetter")
  };
}

export function cacheLoginElements() {
  return {
    accessCode: document.getElementById("accessCode"),
    accessBtn: document.getElementById("accessBtn"),
    tenantLoginName: document.getElementById("tenantLoginName")
  };
}

export function setOverlay(overlay, open) {
  if (!overlay) return;
  overlay.classList.toggle("open", open);
  overlay.setAttribute("aria-hidden", open ? "false" : "true");
}

export function getCurrentGroup(state) {
  const groups = state.data.groups.filter(group => group.tenantId === state.tenantId);
  return groups.find(group => group.id === state.currentGroupId) || groups[0];
}

export function renderGroups(ctx) {
  const { elements, state } = ctx;
  if (!elements.groupSelect || !elements.taskGroup) return;

  elements.groupSelect.innerHTML = "";
  elements.taskGroup.innerHTML = "";
  if (elements.studentGroup) elements.studentGroup.innerHTML = "";

  const groups = state.data.groups.filter(group => group.tenantId === state.tenantId);
  groups.forEach(group => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.name;
    elements.groupSelect.appendChild(option.cloneNode(true));
    elements.taskGroup.appendChild(option.cloneNode(true));
    if (elements.studentGroup) {
      elements.studentGroup.appendChild(option.cloneNode(true));
    }
  });

  const activeId = groups.some(group => group.id === state.currentGroupId)
    ? state.currentGroupId
    : (groups[0]?.id || "");

  elements.groupSelect.value = activeId;
  elements.taskGroup.value = activeId;
  if (elements.studentGroup) elements.studentGroup.value = activeId;

  if (elements.taskGroupLabel) {
    const group = getCurrentGroup(state);
    elements.taskGroupLabel.textContent = group ? group.name : "Grupo";
  }

  if (elements.studentGroupLabel) {
    const group = getCurrentGroup(state);
    elements.studentGroupLabel.textContent = group ? group.name : "Grupo";
  }
}
