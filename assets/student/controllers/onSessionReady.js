export function createOnSessionReady({
  getActiveTaskContext, chatList, stepsPlaceholder,
  stepMapPanel, renderFromHistory, refreshTaskContext,
  getHistory, setHistory, add, showNotaRow,
}) {
  return (steps, cur, exerciseCtx, isRestore = false, backendMessages = []) => {
    const _onReadySubSteps = document.getElementById("ctxSubSteps");
    if (_onReadySubSteps) _onReadySubSteps.hidden = false;
    try { showNotaRow(); } catch {}

    const _injectTeacherPin = () => {
      try {
        const notes = getActiveTaskContext()?.teacherNotes || "";
        if (!notes) return;
        const existing = chatList.querySelector(".ttd-teacher-pin");
        if (existing) existing.remove();
        const pin    = document.createElement("div");
        pin.className = "ttd-teacher-pin";
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
    };

    if (!steps || steps.length === 0) {
      if (stepsPlaceholder) stepsPlaceholder.hidden = false;
      _injectTeacherPin();
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
      _injectTeacherPin();
      const taskId = getActiveTaskContext()?.id;
      if (taskId && typeof refreshTaskContext === "function") {
        refreshTaskContext(taskId);
      }
    } else {
      // Mensaje inicial solo en sesiones nuevas — no repetir si se restaura
      _injectTeacherPin();
      const exTitle = exerciseCtx?.title || "";
      const exIndex = exerciseCtx?.index ?? null;
      let greeting;
      if (exTitle) {
        greeting = exIndex
          ? `Vamos con el ejercicio ${exIndex}: ${exTitle}. ¿Por dónde quieres empezar?`
          : `Vamos con "${exTitle}". ¿Por dónde quieres empezar?`;
      } else {
        greeting = "Perfecto. ¿Por dónde quieres empezar?";
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
