import { getStudentOrderKey, saveTeacherSession } from "./state.js";
import { getSystemTheme, applyTheme, updateThemeToggleLabel } from "./theme.js";
import { setOverlay, getCurrentGroup } from "./dom.js";
import { renderStudents, handleStudentStatusChange, handleStudentSubmit } from "./students.js";
import { setRange, openTaskDetailModal, closeTaskDetailModal, handleTaskDelete, handleTaskSubmit } from "./tasks.js";
import { handleTicketActions, closeTicketModal, resolveTicket } from "./tickets.js";
import { renderNotebook, openNotebookDetail, closeNotebookDetail, openGradesModal, closeGradesModal, setStudentTaskStatus, termKeyFromMonthKey, renderGradeList } from "./notebook.js";
import { formatDate } from "./utils.js";
import { resetPendingAttachments, renderPendingAttachments, handleAttachmentInput, handleAttachmentRemove, handleAttachmentAction } from "./attachments.js";
import { apiFetch, clearSession, getTenantSlug } from "../../shared/js/auth.js";
import { setActiveGroupId } from "../../shared/js/groupState.js";

export function openTaskModal(ctx) {
  ctx.elements.taskForm.reset();
  resetPendingAttachments();
  renderPendingAttachments(ctx);
  ctx.elements.taskGroup.value = ctx.state.currentGroupId;
  setOverlay(ctx.elements.taskModal, true);
}

export function closeTaskModal(ctx) {
  setOverlay(ctx.elements.taskModal, false);
}

export function openStudentModal(ctx) {
  ctx.elements.studentForm.reset();
  const tenant = getTenantSlug() || "";
  const activeGroupId = tenant ? localStorage.getItem(`ttd_activeGroupId_${tenant}`) : "";
  if (ctx.elements.studentGroup) {
    ctx.elements.studentGroup.value = activeGroupId || "";
    ctx.elements.studentGroup.disabled = true;
  }
  if (ctx.elements.studentGroupLabel) {
    const group = ctx.state.data?.groups?.find(g => g.id === activeGroupId) || getCurrentGroup(ctx.state);
    ctx.elements.studentGroupLabel.textContent = group ? group.name : "Selecciona un grupo";
  }
  const submitBtn = ctx.elements.studentForm?.querySelector("button[type=\"submit\"]");
  if (submitBtn) submitBtn.disabled = !activeGroupId;
  setOverlay(ctx.elements.studentModal, true);
}

export function closeStudentModal(ctx) {
  setOverlay(ctx.elements.studentModal, false);
}

function buildGradeOptions(level) {
  if (level === "primaria") {
    return [
      { value: "1", label: "1º Primaria" },
      { value: "2", label: "2º Primaria" },
      { value: "3", label: "3º Primaria" },
      { value: "4", label: "4º Primaria" },
      { value: "5", label: "5º Primaria" },
      { value: "6", label: "6º Primaria" }
    ];
  }
  if (level === "bachiller") {
    return [
      { value: "1", label: "1º Bachiller" },
      { value: "2", label: "2º Bachiller" }
    ];
  }
  return [
    { value: "1", label: "1º ESO" },
    { value: "2", label: "2º ESO" },
    { value: "3", label: "3º ESO" },
    { value: "4", label: "4º ESO" }
  ];
}

function renderGroupGradeOptions(ctx) {
  if (!ctx.elements.groupGrade || !ctx.elements.groupLevel) return;
  const level = ctx.elements.groupLevel.value || "eso";
  const options = buildGradeOptions(level);
  ctx.elements.groupGrade.innerHTML = "";
  options.forEach(opt => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    ctx.elements.groupGrade.appendChild(option);
  });
}

export function openGroupModal(ctx) {
  if (!ctx.elements.groupForm) return;
  ctx.elements.groupForm.reset();
  renderGroupGradeOptions(ctx);
  if (ctx.elements.groupCreateError) ctx.elements.groupCreateError.textContent = "";
  setOverlay(ctx.elements.groupModal, true);
}

export function closeGroupModal(ctx) {
  setOverlay(ctx.elements.groupModal, false);
}

export function bindDashboardEvents(ctx) {
  if (ctx.elements.themeToggle) {
    updateThemeToggleLabel(ctx.elements.themeToggle);
    ctx.elements.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme || getSystemTheme() || "dark";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next, ctx.state.tenantId);
    updateThemeToggleLabel(ctx.elements.themeToggle);
  });
  }

  ctx.elements.groupSelect?.addEventListener("change", event => {
    const groupId = event.target.value;
    ctx.state.currentGroupId = groupId;
    const tenant = getTenantSlug() || "";
    if (tenant && groupId) {
      setActiveGroupId(tenant, groupId);
      ctx.setActiveGroup?.(groupId);
    }
  });

  ctx.elements.studentOrder?.addEventListener("change", event => {
    ctx.state.studentOrder = event.target.value;
    localStorage.setItem(getStudentOrderKey(ctx.state.tenantId), ctx.state.studentOrder);
    renderStudents(ctx);
  });

  ctx.elements.teacherSelect?.addEventListener("change", event => {
    const teacherId = event.target.value;
    const teacher = ctx.state.data.teachers?.find(item => item.id === teacherId);
    ctx.state.currentTeacherId = teacherId;
    ctx.state.currentTeacherName = teacher ? teacher.name : teacherId;
    saveTeacherSession(ctx.state.tenantId, {
      teacherId: ctx.state.currentTeacherId,
      teacherName: ctx.state.currentTeacherName
    });
    ctx.refreshData();
    ctx.renderAll();
    ctx.updateTenantUI();
  });

  ctx.elements.studentList?.addEventListener("change", event => handleStudentStatusChange(ctx, event));
  ctx.elements.studentList?.addEventListener("click", event => {
    const button = event.target.closest(".studentGroupToggle");
    if (!button) return;
    const group = button.dataset.group;
    if (!group) return;
    ctx.state.studentGroupOpen[group] = !ctx.state.studentGroupOpen[group];
    renderStudents(ctx);
  });
  ctx.elements.ticketList?.addEventListener("click", event => handleTicketActions(ctx, event));

  ctx.elements.tabs.forEach(tab => {
    tab.addEventListener("click", () => setRange(ctx, tab.dataset.range));
  });

  ctx.elements.addTaskBtn?.addEventListener("click", () => openTaskModal(ctx));
  ctx.elements.addStudentBtn?.addEventListener("click", () => openStudentModal(ctx));
  ctx.elements.addGroupBtn?.addEventListener("click", () => openGroupModal(ctx));
  ctx.elements.taskForm?.addEventListener("submit", event => handleTaskSubmit(ctx, event));
  ctx.elements.studentForm?.addEventListener("submit", event => handleStudentSubmit(ctx, event));
  ctx.elements.taskAddFileBtn?.addEventListener("click", () => ctx.elements.taskFileInput?.click());
  ctx.elements.taskFileInput?.addEventListener("change", event => handleAttachmentInput(ctx, event));
  ctx.elements.taskAttachmentList?.addEventListener("click", event => handleAttachmentRemove(ctx, event));
  ctx.elements.tasksPanel?.addEventListener("click", event => {
    if (handleTaskDelete(ctx, event)) return;
    const item = event.target.closest(".taskItem");
    if (!item || !item.dataset.taskId) return;
    openTaskDetailModal(ctx, item.dataset.taskId);
  });
  ctx.elements.taskDetailAttachments?.addEventListener("click", event => handleAttachmentAction(ctx, event));
  ctx.elements.notebookMode?.addEventListener("change", event => {
    ctx.state.notebookMode = event.target.value;
    if (ctx.elements.notebookMonthWrap && ctx.elements.notebookTermWrap) {
      ctx.elements.notebookMonthWrap.style.display = (ctx.state.notebookMode === "month") ? "flex" : "none";
      ctx.elements.notebookTermWrap.style.display = (ctx.state.notebookMode === "term") ? "flex" : "none";
    }
    renderNotebook(ctx);
  });

  ctx.elements.notebookMonth?.addEventListener("change", event => {
    ctx.state.notebookMonth = event.target.value;
    ctx.state.notebookTerm = termKeyFromMonthKey(ctx.state.notebookMonth);
    renderNotebook(ctx);
  });

  ctx.elements.notebookTerm?.addEventListener("change", event => {
    ctx.state.notebookTerm = event.target.value;
    renderNotebook(ctx);
  });

  ctx.elements.groupLevel?.addEventListener("change", () => {
    renderGroupGradeOptions(ctx);
  });

  ctx.elements.groupForm?.addEventListener("submit", async event => {
    event.preventDefault();
    if (!ctx.elements.groupLevel || !ctx.elements.groupGrade || !ctx.elements.groupLetter) return;
    const level = ctx.elements.groupLevel.value;
    const grade = ctx.elements.groupGrade.value;
    const letter = ctx.elements.groupLetter.value;
    if (!level || !grade || !letter) return;

    let groupName = "";
    if (level === "primaria") {
      groupName = `${grade}º Primaria ${letter}`;
    } else if (level === "bachiller") {
      groupName = `${grade}º Bachiller ${letter}`;
    } else {
      groupName = `${grade}º ESO ${letter}`;
    }

    const res = await apiFetch("/api/v1/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groupName, level }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 || body?.error?.code === "unauthorized") {
        clearSession();
        window.location.href = "/index.html";
        return;
      }
      const rid = body?.requestId || body?.request_id || "";
      if (ctx.elements.groupCreateError) {
        ctx.elements.groupCreateError.textContent = `Error creando grupo${rid ? ` (ref: ${rid})` : ""}`;
      }
      return;
    }
    if (ctx.elements.groupCreateError) ctx.elements.groupCreateError.textContent = "";
    closeGroupModal(ctx);
    await ctx.loadGroups?.();
    const newId = body?.data?.id;
    const tenant = getTenantSlug() || "";
    if (tenant && newId) {
      setActiveGroupId(tenant, newId);
      ctx.setActiveGroup?.(newId);
    }
  });

  ctx.elements.notebookGrid?.addEventListener("click", event => {
    const btn = event.target.closest("button[data-nb-action]");
    if (!btn) return;
    const studentId = btn.dataset.studentId;
    if (btn.dataset.nbAction === "detail") openNotebookDetail(ctx, studentId);
    if (btn.dataset.nbAction === "grades") openGradesModal(ctx, studentId);
  });

  ctx.elements.notebookDetailBody?.addEventListener("change", event => {
    const sel = event.target.closest("select.nbTaskSelect");
    if (!sel) return;
    const taskId = sel.dataset.taskId;
    const studentId = ctx.state.activeNotebookStudentId;
    if (!taskId || !studentId) return;
    setStudentTaskStatus(ctx, taskId, studentId, sel.value);
    ctx.saveData();
    renderNotebook(ctx);
  });

  ctx.elements.gradeForm?.addEventListener("submit", event => {
    event.preventDefault();
    const studentId = ctx.state.activeNotebookStudentId;
    if (!studentId) return;
    const title = ctx.elements.gradeTitle.value.trim();
    const date = ctx.elements.gradeDate.value;
    const score = ctx.elements.gradeScore.value.trim();
    if (!title || !date || !score) return;

    ctx.state.data.grades = ctx.state.data.grades || {};
    ctx.state.data.grades[ctx.state.currentTeacherId] = ctx.state.data.grades[ctx.state.currentTeacherId] || {};
    ctx.state.data.grades[ctx.state.currentTeacherId][studentId] = ctx.state.data.grades[ctx.state.currentTeacherId][studentId] || [];
    ctx.state.data.grades[ctx.state.currentTeacherId][studentId].push({
      id: `gr_${Date.now()}`,
      title,
      date,
      score
    });
    ctx.saveData();
    ctx.elements.gradeForm.reset();
    ctx.elements.gradeDate.value = formatDate(new Date());
    renderGradeList(ctx, studentId);
  });

  ctx.elements.gradeList?.addEventListener("click", event => {
    const btn = event.target.closest("button[data-grade-id]");
    if (!btn) return;
    const studentId = ctx.state.activeNotebookStudentId;
    if (!studentId) return;
    const id = btn.dataset.gradeId;
    const list = ctx.state.data.grades?.[ctx.state.currentTeacherId]?.[studentId] || [];
    ctx.state.data.grades[ctx.state.currentTeacherId][studentId] = list.filter(g => g.id !== id);
    ctx.saveData();
    renderGradeList(ctx, studentId);
  });

  if (ctx.elements.homeLink) {
    ctx.elements.homeLink.href = `/index.html`;
  }


  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.close;
      if (target === "taskModal") closeTaskModal(ctx);
      if (target === "studentModal") closeStudentModal(ctx);
      if (target === "ticketModal") closeTicketModal(ctx);
      if (target === "taskDetailModal") closeTaskDetailModal(ctx);
      if (target === "notebookDetailModal") closeNotebookDetail(ctx);
      if (target === "gradesModal") closeGradesModal(ctx);
      if (target === "groupModal") closeGroupModal(ctx);
    });
  });

  ctx.elements.taskModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.taskModal) closeTaskModal(ctx);
  });

  ctx.elements.studentModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.studentModal) closeStudentModal(ctx);
  });

  ctx.elements.ticketModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.ticketModal) closeTicketModal(ctx);
  });

  ctx.elements.taskDetailModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.taskDetailModal) closeTaskDetailModal(ctx);
  });

  ctx.elements.notebookDetailModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.notebookDetailModal) closeNotebookDetail(ctx);
  });

  ctx.elements.gradesModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.gradesModal) closeGradesModal(ctx);
  });

  ctx.elements.groupModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.groupModal) closeGroupModal(ctx);
  });


  ctx.elements.logoutBtn?.addEventListener("click", async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {}
    clearSession();
    window.location.href = `/index.html`;
  });

  ctx.elements.ticketResolveBtn?.addEventListener("click", () => {
    if (!ctx.state.activeTicketId) return;
    resolveTicket(ctx, ctx.state.activeTicketId);
    closeTicketModal(ctx);
  });
}

export function bindLoginEvents(ctx) {
  return;
}
