// Renders the teacher pin card at the top of the chat.
// Exported so callers (e.g. selectTaskRef) can inject it immediately on task
// selection without waiting for the session API response.
// chatList: #messages DOM node; getActiveTaskContext: () => task with teacherNotes.
export function injectTeacherPin(chatList, getActiveTaskContext) {
  try {
    const notes = getActiveTaskContext()?.teacherNotes || "";
    if (!notes) return;
    const existing = chatList?.querySelector(".ttd-teacher-pin");
    if (existing) existing.remove();
    const pin = document.createElement("div");
    pin.className = "ttd-teacher-pin";
    pin.dataset.pinned = "1"; // survives renderFromHistory clears
    const iconEl = document.createElement("span");
    iconEl.className = "ttd-teacher-pin-icon";
    iconEl.textContent = "📌";
    const textEl = document.createElement("p");
    textEl.className = "ttd-teacher-pin-text";
    const b = document.createElement("strong");
    b.textContent = "Tu profesor/a dice:";
    textEl.appendChild(b);
    textEl.appendChild(document.createTextNode(" " + notes));
    pin.appendChild(iconEl);
    pin.appendChild(textEl);
    chatList.prepend(pin);
  } catch {}
}

export function createOnSessionReady({
  getActiveTaskContext, chatList, stepsPlaceholder,
  stepMapPanel, renderFromHistory, refreshTaskContext,
  getHistory, setHistory, add, showNotaRow,
  onNoSteps, getStudentName,
}) {
  return (steps, cur, exerciseCtx, isRestore = false, backendMessages = []) => {
    const _onReadySubSteps = document.getElementById("ctxSubSteps");
    if (_onReadySubSteps) _onReadySubSteps.hidden = false;
    try { showNotaRow(); } catch {}

    if (!steps || steps.length === 0) {
      if (stepsPlaceholder) stepsPlaceholder.hidden = false;
      if (isRestore) {
        if (backendMessages.length > 0) {
          try { setHistory(backendMessages); } catch {}
        }
        try { renderFromHistory(); } catch {}
      }
      injectTeacherPin(chatList, getActiveTaskContext);
      try { onNoSteps?.(); } catch {}
      return;
    }
    if (stepsPlaceholder) stepsPlaceholder.hidden = true;
    stepMapPanel.render(steps, cur);
    stepMapPanel.show();
    if (isRestore) {
      // Si el backend envió mensajes (sesión cross-device), seed del historial local
      if (backendMessages.length > 0) {
        try { setHistory(backendMessages); } catch {}
      }
      try { renderFromHistory(); } catch {}
      injectTeacherPin(chatList, getActiveTaskContext);
      const taskId = getActiveTaskContext()?.id;
      if (taskId && typeof refreshTaskContext === "function") {
        refreshTaskContext(taskId);
      }
    } else {
      // Mensaje inicial solo en sesiones nuevas — no repetir si se restaura
      injectTeacherPin(chatList, getActiveTaskContext);
      const exTitle    = exerciseCtx?.title || "";
      const exIndex    = exerciseCtx?.index ?? null;
      const totalCount = exerciseCtx?.totalCount ?? null;
      const taskCtx    = getActiveTaskContext?.();
      const topic      = taskCtx?.subject || taskCtx?.title || "la tarea";
      const nombre     = (getStudentName?.() || "").trim().split(/\s+/)[0] || "";

      let greeting;
      if (!exTitle) {
        greeting = nombre ? `Hola, ${nombre}. ¿Por dónde quieres empezar?` : "Perfecto. ¿Por dónde quieres empezar?";
      } else if (totalCount != null) {
        const hi    = nombre ? `Hola, ${nombre}. ` : "";
        const cnt   = totalCount === 1 ? "hay 1 ejercicio" : `son ${totalCount} ejercicios`;
        const start = exIndex != null ? `Vamos con el ejercicio ${exIndex}.` : "Vamos a empezar con el primero.";
        greeting = `${hi}He leído la hoja de ${topic}: ${cnt}. ${start}`;
      } else {
        greeting = exIndex
          ? `Vamos con el ejercicio ${exIndex}: ${exTitle}. ¿Por dónde quieres empezar?`
          : `Vamos con "${exTitle}". ¿Por dónde quieres empezar?`;
      }
      try { add("assistant", greeting); } catch {}
      try {
        const hist = getHistory();
        hist.push({ role: "assistant", content: greeting });
        setHistory(hist);
      } catch {}
    }
  };
}
