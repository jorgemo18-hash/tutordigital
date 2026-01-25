function createThreadPicker({
  chatList,
  scrollEl,
  MODE_KEYS,
  MODE_LABEL,
  computeItemsForMode,
  normalizeItem,
  getThreadHistory,
  setThreadHistory,
  ensureThread,
  setActiveThreadForMode,
  setSelectedTopic,
  getPendingFirstQuestion,
  clearPendingFirstQuestion,
  pushUser,
  chooseMode,
  setWaitingForMode,
  setPendingFirstQuestion,
  addTopicChips,
  renderFromHistory,
  sendText,
  inp,
  add,
} = {}) {
  let activeThreadId = "";
  let typePickerRow = null;
  let itemPickerRow = null;

  function getHistory() {
    return activeThreadId ? getThreadHistory(activeThreadId) : [];
  }

  function setHistory(arr) {
    if (!activeThreadId) return;
    setThreadHistory(activeThreadId, arr);
  }

  function clearTypePicker() {
    if (!typePickerRow) return;
    try { typePickerRow.remove(); } catch {}
    typePickerRow = null;
  }

  function clearItemPicker() {
    if (!itemPickerRow) return;
    try { itemPickerRow.remove(); } catch {}
    itemPickerRow = null;
  }

  function showTypePicker() {
    if (!chatList) return;
    setWaitingForMode(true);
    clearTypePicker();
    clearItemPicker();

    const row = document.createElement("div");
    row.className = "row a";
    const bubble = document.createElement("div");
    bubble.className = "bubble threadChooser";

    const title = document.createElement("div");
    title.className = "threadChooserTitle";
    title.textContent = "Elige qué toca hoy:";

    const list = document.createElement("div");
    list.className = "threadChooserList";

    const modes = [MODE_KEYS.DEBERES, MODE_KEYS.EXAMEN, MODE_KEYS.TRABAJO];
    modes.forEach((mode) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "threadChip";
      btn.textContent = MODE_LABEL[mode] || String(mode || "");
      btn.addEventListener("click", () => {
        startTypeSelection(mode);
      });
      list.appendChild(btn);
    });

    bubble.appendChild(title);
    bubble.appendChild(list);
    row.appendChild(bubble);
    typePickerRow = row;
    chatList.appendChild(row);

    try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
  }

  async function startTypeSelection(mode) {
    clearTypePicker();
    clearItemPicker();
    setWaitingForMode(false);

    try {
      await chooseMode(mode, {
        inp,
        add,
        getHistory,
        setHistory,
        sendText,
        skipAnnounce: true,
      });
    } catch {}

    const items = computeItemsForMode(mode);
    if (items.length <= 1) {
      await selectItem(mode, items[0] || null);
      return;
    }

    if (typeof addTopicChips === "function") {
      const labels = items.map((item) => String(item?.title || "").trim()).filter(Boolean);
      const row = addTopicChips(labels, {
        onSelect: ({ full, row: chipRow }) => {
          const item = items.find((it) => String(it?.title || "").trim() === full) || null;
          selectItem(mode, item);
          if (chipRow && chipRow.remove) {
            try { chipRow.remove(); } catch {}
          }
        },
      });
      itemPickerRow = row;
    }
  }

  async function selectItem(mode, item) {
    clearItemPicker();

    const title = String(item?.title || MODE_LABEL[mode] || mode || "").trim();
    const itemKey = item?.itemKey || normalizeItem(title) || "default";

    if (title) {
      try { setSelectedTopic(title); } catch {}
    }

    activeThreadId = ensureThread(mode, itemKey, title);
    if (activeThreadId) {
      setActiveThreadForMode(mode, activeThreadId);
      renderFromHistory();
    }

    const pending = getPendingFirstQuestion();
    if (pending) {
      pushUser({ add, getHistory, setHistory }, pending);
      clearPendingFirstQuestion();
    }

    const prompt = pending
      ? (
          `El alumno ha seleccionado ${title}. ` +
          `Mensaje del alumno: "${pending}". ` +
          `Responde empezando con: "Perfecto, vamos con ${title}." ` +
          `Si faltan detalles, pregunta por el enunciado/página/ejercicio concreto.`
        )
      : (
          `El alumno ha seleccionado ${title}. ` +
          `Responde empezando con: "Perfecto, vamos con ${title}." ` +
          `Pregunta por el enunciado/página/ejercicio concreto para continuar.`
        );

    if (prompt) {
      try { await sendText(prompt, { silentUser: true }); } catch {}
    }
  }

  function getActiveThreadId() {
    return activeThreadId;
  }

  return {
    showTypePicker,
    startTypeSelection,
    getHistory,
    setHistory,
    getActiveThreadId,
  };
}

export { createThreadPicker };
