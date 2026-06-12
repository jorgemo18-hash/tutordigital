export function createOnFinished({
  getActiveTaskContext, getActiveSessionId, ACTIVE_USER, metaMode,
  clearActiveSession, clearSessionCache,
  stepMapPanel, exercisePicker, stepsPlaceholder,
  setCtxAttachment, getHistory, add, apiFetch, hideNotaRow,
}) {
  return async (kind) => {
    const activeCtx = getActiveTaskContext();
    const studentId = ACTIVE_USER?.userId;
    const taskId    = activeCtx?.id;
    const duration  = metaMode.getSessionSeconds?.() || 0;
    const newStatus = kind === "resolved" ? "done" : "needs_teacher";

    // Capture sessionId before clearing (used for PATCH below)
    const sessionId = getActiveSessionId();

    if (taskId && studentId) {
      try {
        await apiFetch("/api/v1/tasks", {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ id: taskId, student_id: studentId, student_status: newStatus }),
        });
      } catch {}
    }

    try { hideNotaRow(); } catch {}
    clearActiveSession();
    clearSessionCache(taskId);
    stepMapPanel?.hide();
    exercisePicker?.hide();
    {
      const _finHasTeacherAtts = (activeCtx?.attachments || []).length > 0;
      const _finSubSteps = document.getElementById("ctxSubSteps");
      if (_finSubSteps) {
        _finSubSteps.hidden = !_finHasTeacherAtts;
        if (_finHasTeacherAtts && stepsPlaceholder) stepsPlaceholder.hidden = false;
      }
    }

    // PATCH the AI session row with outcome + duration (instead of creating a new row)
    if (taskId && sessionId) {
      try {
        const _d = new Date();
        const sessionDate = `${_d.getFullYear()}-${String(_d.getMonth() + 1).padStart(2, "0")}-${String(_d.getDate()).padStart(2, "0")}`;
        await apiFetch(`/api/v1/tutor-sessions/${encodeURIComponent(sessionId)}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            outcome:          kind === "resolved" ? "completed" : "abandoned",
            duration_seconds: Math.max(1, duration),
            needs_help:       newStatus === "needs_teacher",
            session_date:     sessionDate,
          }),
        });
      } catch {}
    }

    if (kind === "stuck") {
      try {
        const hist = getHistory();
        const lastMessages = Array.isArray(hist)
          ? hist.slice(-8).map((m) => `${m.role === "assistant" ? "Tutor" : "Alumno"}: ${m.content}`).join("\n")
          : "";
        await apiFetch("/api/v1/tickets", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            title:  "Alumno necesita ayuda del profesor",
            detail: [
              activeCtx?.title   ? `Tarea: ${activeCtx.title}`           : "",
              activeCtx?.subject ? `Asignatura: ${activeCtx.subject}`    : "",
              lastMessages       ? `Conversación:\n${lastMessages}`      : "",
            ].filter(Boolean).join("\n\n"),
          }),
        });
      } catch {}
      try { add("assistant", "He avisado a tu profesor. Puedes seguir intentándolo aquí o volver a la agenda."); } catch {}
      setTimeout(() => { try { metaMode.showAgenda(); } catch (err) { console.error("[onFinished] showAgenda error:", err); } }, 2500);
    }

    if (kind === "resolved") {
      setCtxAttachment(null);
      if (taskId) { try { localStorage.removeItem(`ctxFiles_${taskId}`); localStorage.removeItem(`ctxFile_${taskId}`); } catch {} }
      try {
        const ctxPreview    = document.getElementById("ctxFilePreview");
        const ctxUploadArea = document.getElementById("ctxUploadArea");
        if (ctxPreview)    { ctxPreview.innerHTML = ""; ctxPreview.hidden = true; }
        if (ctxUploadArea) ctxUploadArea.hidden = false;
      } catch {}
    }

    if (taskId) {
      try {
        const card = document.querySelector(`[data-card-task-id="${taskId}"]`);
        const isDone = newStatus === "done";
        const _isWorkTask = (window._tdGroups?.work      || []).some((t) => t.id === taskId)
                         || (window._tdGroups?.atrasadas || []).some((t) => t.id === taskId && t.type === "work");
        if (card && isDone && _isWorkTask) {
          card.remove();
          if (window._tdGroups) {
            window._tdGroups.work      = (window._tdGroups.work      || []).filter((t) => t.id !== taskId);
            window._tdGroups.atrasadas = (window._tdGroups.atrasadas || []).filter((t) => t.id !== taskId);
          }
        }
        if (_isWorkTask) try { window._tdRefreshTasks?.(); } catch {}
      } catch {}
    }
  };
}
