import { getTaskGroups, refreshTaskList } from "../features/agenda/agendaTaskGroups.js";

export function createOnFinished({
  getActiveTaskContext, getActiveSessionId, ACTIVE_USER, metaMode,
  clearActiveSession, clearSessionCache,
  stepMapPanel, exercisePicker, stepsPlaceholder,
  setCtxAttachment, add, apiFetch, showNotaRow,
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

    // SE OFRECE LA NOTA, NO SE ESCONDE. Aquí había un hideNotaRow(): al
    // pulsar "He terminado" o "No he podido" desaparecía el botón de escribir
    // al profesor, justo en el momento en que el alumno sabe qué contar. Por
    // eso la tabla student_notes llevaba meses vacía.
    //
    // Se ofrece en los DOS casos y siempre opcional (Jorge, 09/09/2026); lo
    // único que cambia es la pregunta, porque no se cuenta lo mismo cuando
    // has podido que cuando te has atascado. El sessionId va fijado a mano
    // porque clearActiveSession() —la línea de abajo— lo borra antes de que
    // al alumno le dé tiempo a escribir.
    try {
      showNotaRow({
        sessionId,
        etiqueta: "📝 Nota al profesor",
        pista: kind === "resolved"
          ? "¿Quieres contarle algo a tu profesor? (opcional)"
          : "¿Qué es lo que no te ha salido? (opcional)",
        abierto: Boolean(sessionId),
      });
    } catch {}
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
      // AQUÍ SE CREABA UN TICKET, y se ha quitado (09/09/2026). Era un
      // segundo canal para lo mismo: el PATCH de arriba ya deja la sesión con
      // needs_help, y el profesor la ve en el contador del Cuaderno con la
      // conversación entera y su mapa de pasos. El ticket guardaba los ocho
      // últimos mensajes COPIADOS en un campo de texto, sin enlace a la
      // sesión y —comprobado en producción— sin student_id: 32 tickets, los
      // 32 sin alumno. Una bandeja peor, y dos bandejas garantizan que una se
      // quede sin mirar. Lo que el alumno quiera añadir va ahora en la nota,
      // que sí va atada a la sesión.
      try { add("assistant", "He avisado a tu profesor para que pueda ayudarte con esto."); } catch {}
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
        const groups = getTaskGroups();
        const _isWorkTask = (groups?.work      || []).some((t) => t.id === taskId)
                         || (groups?.atrasadas || []).some((t) => t.id === taskId && t.type === "work");
        if (card && isDone && _isWorkTask) {
          card.remove();
          if (groups) {
            groups.work      = (groups.work      || []).filter((t) => t.id !== taskId);
            groups.atrasadas = (groups.atrasadas || []).filter((t) => t.id !== taskId);
          }
        }
        if (_isWorkTask) try { refreshTaskList(); } catch {}
      } catch {}
    }
  };
}
