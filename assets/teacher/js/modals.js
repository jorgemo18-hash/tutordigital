import { saveTeacherSession } from "./state.js";
import { setOverlay } from "./dom.js";
import { setRange, openTaskDetailModal, closeTaskDetailModal, handleTaskDelete, handleTaskSubmit, renderPlanner, clearTaskFormErrors } from "./tasks.js";
import { closeTicketModal, openTicketModal, openSessionModal, resolveTicket } from "./tickets.js";
import { openNotebookDetail, closeNotebookDetail, openGradesModal, closeGradesModal, setStudentTaskStatus, termKeyFromMonthKey, renderGradeList, renderNotebook } from "./notebook.js";
import { openGradeDrawer } from "./features/grade-drawer.js";
import { apiFetch, getTenantSlug } from "../../shared/js/auth.js";
import { getNotebookRangeParams } from "./api/teacherApiHelpers.js";
import { formatDate, escapeHtml } from "./utils.js";
import { resetPendingAttachments, renderPendingAttachments, handleAttachmentInput, handleAttachmentRemove, handleAttachmentAction } from "./attachments.js";
import { setActiveGroupId } from "../../shared/js/groupState.js";
import { loadSubjectsForGroup } from "./features/subjects.js";

export function openTaskModal(ctx) {
  ctx.elements.taskForm.reset();
  clearTaskFormErrors();
  resetPendingAttachments();
  renderPendingAttachments(ctx);
  ctx.elements.taskGroup.value = ctx.state.currentGroupId;
  if (ctx.elements.taskSubject && ctx.state.currentSubjectFilter) {
    ctx.elements.taskSubject.value = ctx.state.currentSubjectFilter;
  }
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
    loadSubjectsForGroup(ctx, groupId).catch(() => {});
  });

  ctx.elements.subjectSelect?.addEventListener("change", event => {
    ctx.state.currentSubjectFilter = event.target.value;
    renderPlanner(ctx);
    renderNotebook(ctx);
  });

  // Initial subject load for current group
  if (ctx.state.currentGroupId) {
    loadSubjectsForGroup(ctx, ctx.state.currentGroupId).catch(() => {});
  }

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
    const gradeBtn = event.target.closest(".taskGradeBtn");
    if (gradeBtn) { openGradeDrawer(ctx, gradeBtn.dataset.taskId, null, null).catch(console.error); return; }
    if (handleTaskDelete(ctx, event)) return;
    const item = event.target.closest(".taskItem");
    if (!item || !item.dataset.taskId) return;
    openTaskDetailModal(ctx, item.dataset.taskId);
  });

  ctx.elements.taskDetailAttachments?.addEventListener("click", event => handleAttachmentAction(ctx, event));

  ctx.elements.notebookMode?.addEventListener("change", event => {
    let mode = event.target.value;
    if (mode === "month") { mode = "week"; event.target.value = "week"; }
    ctx.state.notebookMode = mode;
    ctx.state.notebookWeekOffset = 0;
    renderNotebook(ctx);
    if (ctx.state.notebookMode !== "custom") ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookViewMode?.addEventListener("change", event => {
    ctx.state.notebookViewMode = event.target.value;
    renderNotebook(ctx);
  });

  ctx.elements.notebookFromDate?.addEventListener("change", event => {
    ctx.state.notebookCustomFrom = event.target.value;
    if (ctx.state.notebookCustomFrom && ctx.state.notebookCustomTo) ctx.refreshNotebookForActiveGroup?.();
  });

  ctx.elements.notebookToDate?.addEventListener("change", event => {
    ctx.state.notebookCustomTo = event.target.value;
    if (ctx.state.notebookCustomFrom && ctx.state.notebookCustomTo) ctx.refreshNotebookForActiveGroup?.();
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
    const examCell = event.target.closest("[data-nb-action='open-task-grade']");
    if (examCell) {
      const taskIds = examCell.dataset.taskIds ? examCell.dataset.taskIds.split(",") : null;
      const skipTaskCards = examCell.dataset.skipTaskCards === "true";
      openGradeDrawer(ctx, examCell.dataset.taskId, examCell.dataset.studentId || null, taskIds, { skipTaskCards }).catch(console.error);
      return;
    }
    const gradeAvg = event.target.closest("[data-nb-action='view-period-grades']");
    if (gradeAvg) { openPeriodGradesView(ctx, gradeAvg.dataset.studentId, gradeAvg.dataset.taskType); return; }
    const dot = event.target.closest(".nbDot--clickable");
    if (dot) {
      const readonly = dot.dataset.mode === "readonly";
      // Todos los dots del cuaderno van al drawer — nunca al modal antiguo de tickets.
      if (dot.dataset.dayKey !== undefined) {
        const dotColor = dot.classList.contains("nbDot--done") ? "done"
                       : dot.classList.contains("nbDot--needs") ? "needs"
                       : "pending";
        const isAlreadyReviewed = dot.classList.contains("nbDot--reviewed");
        openSessionModal(ctx, {
          studentId: dot.dataset.studentId,
          dayKey:    dot.dataset.dayKey,
          taskTitle: dot.dataset.taskTitle || "",
          sessionId: dot.dataset.sessionId || null,
          readonly,
          dotColor,
          isAlreadyReviewed,
        });
        return;
      }
      if (dot.dataset.studentId) { openNotebookDetail(ctx, dot.dataset.studentId); return; }
    }
    const row = event.target.closest("[data-nb-action='toggle-progress']");
    if (row) {
      const sid = row.dataset.studentId;
      const panel = document.getElementById(`nbProgress_${sid}`);
      if (panel) {
        const open = panel.style.display === "none";
        panel.style.display = open ? "block" : "none";
        const chevron = row.querySelector(".nbNeedsHelpChevron");
        if (chevron) chevron.style.transform = open ? "rotate(90deg)" : "";
      }
      return;
    }
    const btn = event.target.closest("button[data-nb-action]");
    if (!btn) return;
    const studentId = btn.dataset.studentId;
    if (btn.dataset.nbAction === "view-conversation") {
      openSessionModal(ctx, { studentId, dayKey: btn.dataset.dayKey, taskTitle: btn.dataset.taskTitle || "", sessionId: btn.dataset.sessionId || null, readonly: true });
      return;
    }
    if (btn.dataset.nbAction === "detail") openNotebookDetail(ctx, studentId);
    if (btn.dataset.nbAction === "grades") openGradesModal(ctx, studentId);
    if (btn.dataset.nbAction === "generate-report") {
      const groupId = btn.dataset.groupId || ctx.state.currentGroupId;
      const range = getNotebookRangeParams(ctx.state);
      const area = document.getElementById(`nbReport_${studentId}`);
      if (!area) return;
      area.style.display = "block";
      area.innerHTML = `<p class="hint" style="margin:8px 0">Generando informe…</p>`;
      btn.disabled = true;
      apiFetch("/api/v1/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, group_id: groupId, from: range.from, to: range.to }),
      }).then(res => res.json().catch(() => ({}))).then(body => {
        const text = body?.data?.narrative || "";
        if (!text) { area.innerHTML = `<p class="hint" style="margin:8px 0;color:#ffb4a4">No se pudo generar el informe.</p>`; return; }
        area.innerHTML = `
          <div class="nbReportText">${escapeHtml(text)}</div>
          <div class="nbReportActions">
            <button class="btn ghost nbBtn" data-nb-action="copy-report" data-student-id="${studentId}" type="button">Copiar</button>
          </div>`;
      }).catch(() => {
        area.innerHTML = `<p class="hint" style="margin:8px 0;color:#ffb4a4">Error de conexión.</p>`;
      }).finally(() => { btn.disabled = false; });
    }
    if (btn.dataset.nbAction === "copy-report") {
      const area = document.getElementById(`nbReport_${studentId}`);
      const text = area?.querySelector(".nbReportText")?.textContent || "";
      if (text) navigator.clipboard.writeText(text).catch(() => {});
    }
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
    const score = ctx.elements.gradeScore.value.trim().replace(",", ".");
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

function openPeriodGradesView(ctx, studentId, taskType) {
  const label = taskType === "exam" ? "Exámenes" : "Trabajos";
  const periodGrades = Array.isArray(ctx.state.data.periodGrades) ? ctx.state.data.periodGrades : [];
  const tasksRaw = Array.isArray(ctx.state.data.tasks) ? ctx.state.data.tasks : [];
  const taskTypeMap = new Map(tasksRaw.map(t => [t.id, t.type]));
  const taskTitleMap = new Map(tasksRaw.map(t => [t.id, t.title]));

  const grades = periodGrades
    .filter(g => g.student_id === studentId && (taskTypeMap.get(g.task_id) || "") === taskType)
    .map(g => ({ ...g, _taskTitle: taskTitleMap.get(g.task_id) || g.title || "—" }));

  ctx.elements.notebookDetailTitle.textContent = label;
  if (!grades.length) {
    ctx.elements.notebookDetailBody.innerHTML = `<div class="hint">Sin notas en el periodo.</div>`;
  } else {
    ctx.elements.notebookDetailBody.innerHTML = grades.map(g => `
      <div class="nbGradeRow">
        <div class="nbGradeLabel">${escapeHtml(g._taskTitle)}<span class="nbGradeSub">${escapeHtml(g.date || g.due_date || "")}</span></div>
        <div class="nbGradeScore">${escapeHtml(g.score)}</div>
      </div>
    `).join("");
  }
  setOverlay(ctx.elements.notebookDetailModal, true);
}

export function bindLoginEvents() {
  return;
}
