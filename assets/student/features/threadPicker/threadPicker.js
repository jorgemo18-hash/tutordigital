import { setActiveTaskId } from "../agenda/taskContext.js";

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
  const typePickerButtons = new Map();

  function getHistory() {
    return activeThreadId ? getThreadHistory(activeThreadId) : [];
  }

  function setHistory(arr) {
    if (!activeThreadId) return;
    setThreadHistory(activeThreadId, arr);
  }

  function archivePickerRow(row) {
    if (!row) return;
    try { row.dataset.pinned = "0"; } catch {}
    try { row.classList.add("pickerArchived"); } catch {}
    try {
      row.querySelectorAll("button").forEach((b) => {
        b.disabled = true;
        b.setAttribute("aria-disabled", "true");
        b.style.pointerEvents = "none";
      });
    } catch {}
  }

  function clearTypePicker() {
    if (!typePickerRow) return;
    archivePickerRow(typePickerRow);
    typePickerRow = null;
    typePickerButtons.clear();
  }

  function clearItemPicker() {
    if (!itemPickerRow) return;
    archivePickerRow(itemPickerRow);
    itemPickerRow = null;
  }

  function showTypePicker() {
    if (!chatList) return;
    setWaitingForMode(true);
    clearItemPicker();
    if (typePickerRow) {
      try { scrollEl.scrollTop = scrollEl.scrollHeight; } catch {}
      return;
    }

    const row = document.createElement("div");
    row.className = "row a";
    row.dataset.pinned = "1";
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
      typePickerButtons.set(mode, btn);
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
    clearItemPicker();
    setWaitingForMode(false);
    const selectedBtn = typePickerButtons.get(mode);
    if (selectedBtn) {
      selectedBtn.classList.add("is-selected");
      selectedBtn.setAttribute("aria-pressed", "true");
    }

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

    try {
      const subjects = items
        .map((it) => String(it?.title || "").split("·")[0].trim())
        .filter(Boolean);
      const unique = Array.from(new Set(subjects));
      const list = unique.join(" / ");
      const msg = list ? `Vale. Elige: ${list}.` : "Vale. Elige una materia para continuar.";
      add?.("assistant", msg);
      const hist = getHistory();
      hist.push({ role: "assistant", content: msg });
      setHistory(hist);
    } catch {}

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
    setActiveTaskId(item?.taskId || null);

    const title = String(item?.title || MODE_LABEL[mode] || mode || "").trim();
    const subject = title.split("·")[0].trim();
    const modeLabel = MODE_LABEL[mode] || mode || "";
    const itemKey = item?.itemKey || normalizeItem(title) || "default";

    if (title) {
      try { setSelectedTopic(title); } catch {}
    }

    activeThreadId = ensureThread(mode, itemKey, title);
    if (activeThreadId) {
      setActiveThreadForMode(mode, activeThreadId);
    }

    const pending = getPendingFirstQuestion();
    if (pending) {
      clearPendingFirstQuestion();

      const prompt =
        `Topic: ${modeLabel || mode}. ` +
        `Subtopic: ${subject || title}. ` +
        `Mensaje del alumno: "${pending}". ` +
        `Responde empezando con: "Perfecto, vamos con ${subject || title}." ` +
        `Si falta contexto, pide enunciado/página/ejercicio concreto.`;

      try { await sendText(prompt, { silentUser: true }); } catch {}
      return;
    }

    const msg =
      subject
        ? `Perfecto. ¿Qué parte de ${subject} necesitas trabajar?`
        : "Perfecto. Si ya has adjuntado un archivo, dime el número de ejercicio y el apartado (por ejemplo: \"Ejercicio 2, b\"). Si no hay adjunto, pega aquí el enunciado.";
    try { add?.("assistant", msg); } catch {}
    try {
      const hist = getHistory();
      hist.push({ role: "assistant", content: msg });
      setHistory(hist);
    } catch {}
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
