import { saveTeacherSession } from "./state.js";
import { setOverlay } from "./dom.js";
import { setRange, openTaskDetailModal, closeTaskDetailModal, handleTaskDelete, handleTaskSubmit } from "./tasks.js";
import { closeTicketModal, openTicketModal, resolveTicket } from "./tickets.js";
import { openNotebookDetail, closeNotebookDetail, openGradesModal, closeGradesModal, setStudentTaskStatus, termKeyFromMonthKey, renderGradeList, renderNotebook } from "./notebook.js";
import { formatDate } from "./utils.js";
import { resetPendingAttachments, renderPendingAttachments, handleAttachmentInput, handleAttachmentRemove, handleAttachmentAction } from "./attachments.js";
import { getTenantSlug } from "../../shared/js/auth.js";
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

export function bindDashboardEvents(ctx) {
  ctx.elements.groupSelect?.addEventListener("change", event => {
    const groupId = event.target.value;
    ctx.state.currentGroupId = groupId;
    const tenant = getTenantSlug() || "";
    if (tenant && groupId) {
      setActiveGroupId(tenant, groupId);
      ctx.setActiveGroup?.(groupId);
    }
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

  ctx.elements.tabs.forEach(tab => {
    tab.addEventListener("click", () => setRange(ctx, tab.dataset.range));
  });

  ctx.elements.addTaskBtn?.addEventListener("click", () => openTaskModal(ctx));
  ctx.elements.taskForm?.addEventListener("submit", event => handleTaskSubmit(ctx, event));
  ctx.elements.taskDate?.addEventListener("change", () => ctx.elements.taskDate.blur());
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
    ctx.state.notebookWeekOffset = 0;
    if (ctx.elements.notebookMonthWrap) ctx.elements.notebookMonthWrap.style.display = ctx.state.notebookMode === "month" ? "flex" : "none";
    if (ctx.elements.notebookTermWrap) ctx.elements.notebookTermWrap.style.display = ctx.state.notebookMode === "term" ? "flex" : "none";
    if (ctx.elements.notebookWeekNav) ctx.elements.notebookWeekNav.style.display = ctx.state.notebookMode === "week" ? "flex" : "none";
    ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookWeekPrev?.addEventListener("click", () => {
    ctx.state.notebookWeekOffset = (ctx.state.notebookWeekOffset || 0) - 1;
    renderNotebook(ctx);
    ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookWeekNext?.addEventListener("click", () => {
    ctx.state.notebookWeekOffset = (ctx.state.notebookWeekOffset || 0) + 1;
    renderNotebook(ctx);
    ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookMonth?.addEventListener("change", event => {
    ctx.state.notebookMonth = event.target.value;
    ctx.state.notebookTerm = termKeyFromMonthKey(ctx.state.notebookMonth);
    ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookTerm?.addEventListener("change", event => {
    ctx.state.notebookTerm = event.target.value;
    ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookGrid?.addEventListener("click", event => {
    const badge = event.target.closest(".nb-ticket-badge[data-ticket-id]");
    if (badge) { openTicketModal(ctx, badge.dataset.ticketId); return; }
    const dot = event.target.closest(".nbDot--clickable");
    if (dot) {
      if (dot.dataset.ticketId) { openTicketModal(ctx, dot.dataset.ticketId); return; }
      if (dot.dataset.studentId) { openNotebookDetail(ctx, dot.dataset.studentId); return; }
    }
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
    ctx.refreshNotebookForActiveGroup?.();
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

  document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.close;
      if (target === "taskModal") closeTaskModal(ctx);
      if (target === "ticketModal") closeTicketModal(ctx);
      if (target === "taskDetailModal") closeTaskDetailModal(ctx);
      if (target === "notebookDetailModal") closeNotebookDetail(ctx);
      if (target === "gradesModal") closeGradesModal(ctx);
    });
  });

  ctx.elements.taskModal?.addEventListener("click", event => {
    if (event.target === ctx.elements.taskModal) closeTaskModal(ctx);
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

  ctx.elements.ticketResolveBtn?.addEventListener("click", () => {
    if (!ctx.state.activeTicketId) return;
    resolveTicket(ctx, ctx.state.activeTicketId);
    closeTicketModal(ctx);
  });
}

export function bindLoginEvents(ctx) {
  return;
}
