// Mobile tutor panel controller.
// Manages the info bar (file chip, step indicator), the step bottom sheet,
// and the action (+) sheet. Only meaningful at ≤768px.

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

// ── Step icons matching stepMap.js convention ────────────────────────
function stepIcon(step, index, currentStep) {
  if (index < currentStep) return "✓";
  if (index === currentStep) return "→";
  return "○";
}

// ── File chip / upload button rendering ─────────────────────────────

function buildFileChip(container, name, onTap) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mobile-file-chip";
  btn.title = name;
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
    <span class="mobile-file-name">${escHtml(name)}</span>`;
  btn.addEventListener("click", onTap);
  container.innerHTML = "";
  container.appendChild(btn);
}

function buildUploadBtn(container, onTap) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "mobile-upload-btn";
  btn.textContent = "Subir enunciado";
  btn.addEventListener("click", onTap);
  container.innerHTML = "";
  container.appendChild(btn);
}

function syncFileChip(fileContainer) {
  if (!isMobile()) return;

  // Check if there's already a file in the desktop preview
  const desktopPreview = document.getElementById("ctxFilePreview");
  const desktopFiles   = document.getElementById("ctxTeacherFiles");

  const fileName = desktopPreview?.dataset.fileName || desktopFiles?.querySelector("[data-filename]")?.dataset.filename;

  if (fileName) {
    buildFileChip(fileContainer, fileName, () => {
      document.getElementById("ctxFilePreview")?.querySelector("a, button")?.click();
    });
  } else {
    buildUploadBtn(fileContainer, () => {
      document.getElementById("uploadEnunciado")?.click();
    });
  }
}

// ── Step sheet rendering ─────────────────────────────────────────────

function renderStepSheet(listEl, steps, currentStep) {
  if (!listEl) return;
  if (!steps?.length) {
    listEl.innerHTML = `<li class="mobile-step-item"><span class="mobile-step-icon">○</span>Sin pasos aún.</li>`;
    return;
  }
  listEl.innerHTML = steps.map((step, i) => {
    const done = i < currentStep;
    const cur  = i === currentStep;
    const cls  = done ? "is-done" : cur ? "is-current" : "";
    const icon = stepIcon(step, i, currentStep);
    const title = typeof step === "string" ? step : (step.title || step.text || `Paso ${i + 1}`);
    return `<li class="mobile-step-item ${cls}">
      <span class="mobile-step-icon">${escHtml(icon)}</span>
      <span>${escHtml(title)}</span>
    </li>`;
  }).join("");
}

function stepSummaryText(steps, currentStep) {
  if (!steps?.length) return "Cargando pasos…";
  const total = steps.length;
  const step  = steps[currentStep];
  const title = typeof step === "string" ? step : (step?.title || step?.text || `Paso ${currentStep + 1}`);
  return `Paso ${currentStep + 1} de ${total} · ${title}`;
}

// ── Sheet open / close helpers ───────────────────────────────────────

function openSheet(backdropId, sheetId) {
  const backdrop = document.getElementById(backdropId);
  const sheet    = document.getElementById(sheetId);
  if (!backdrop || !sheet) return;
  backdrop.classList.remove("v-hidden");
  sheet.classList.remove("v-hidden");
  // Trigger animation on next frame
  requestAnimationFrame(() => sheet.classList.add("is-open"));
  document.body.style.overflow = "hidden";
}

function closeSheet(backdropId, sheetId) {
  const backdrop = document.getElementById(backdropId);
  const sheet    = document.getElementById(sheetId);
  if (!backdrop || !sheet) return;
  sheet.classList.remove("is-open");
  const onEnd = () => {
    sheet.classList.add("v-hidden");
    backdrop.classList.add("v-hidden");
    sheet.removeEventListener("transitionend", onEnd);
  };
  sheet.addEventListener("transitionend", onEnd);
  document.body.style.overflow = "";
}

// ── Public API ───────────────────────────────────────────────────────

export function initMobileTutor({ onShowHistorial } = {}) {
  const infoBar       = document.getElementById("mobileTutorInfo");
  const fileContainer = document.getElementById("mobileTutorFile");
  const stepBtn       = document.getElementById("mobileTutorStep");
  const stepText      = document.getElementById("mobileTutorStepText");
  const stepList      = document.getElementById("mobileStepList");

  // Persistent step state
  let _steps = [];
  let _currentStep = 0;

  // ── Step sheet ───────────────────────────────────────────────────

  stepBtn?.addEventListener("click", () => {
    renderStepSheet(stepList, _steps, _currentStep);
    openSheet("mobileStepBackdrop", "mobileStepSheet");
  });

  document.getElementById("mobileStepClose")?.addEventListener("click", () =>
    closeSheet("mobileStepBackdrop", "mobileStepSheet"));

  document.getElementById("mobileStepBackdrop")?.addEventListener("click", () =>
    closeSheet("mobileStepBackdrop", "mobileStepSheet"));

  // ── Action sheet (+) ─────────────────────────────────────────────

  document.getElementById("mobileAttachBtn")?.addEventListener("click", () =>
    openSheet("mobileActionBackdrop", "mobileActionSheet"));

  document.getElementById("mobileActionBackdrop")?.addEventListener("click", () =>
    closeSheet("mobileActionBackdrop", "mobileActionSheet"));

  document.getElementById("mobileActionFile")?.addEventListener("click", () => {
    closeSheet("mobileActionBackdrop", "mobileActionSheet");
    document.getElementById("clip")?.click();
  });

  document.getElementById("mobileActionCalc")?.addEventListener("click", () => {
    closeSheet("mobileActionBackdrop", "mobileActionSheet");
    document.getElementById("btnCtxCalc")?.click();
  });

  document.getElementById("mobileActionBoard")?.addEventListener("click", () => {
    closeSheet("mobileActionBackdrop", "mobileActionSheet");
    document.getElementById("btnCtxPizarra")?.click();
  });

  // Close calc/board panes: tap outside or swipe — add a Cerrar button at top of each pane
  _addCalcCloseRow();
  _addBoardCloseRow();

  // ── File chip: observe teacher files and preview ─────────────────

  const desktopFiles   = document.getElementById("ctxTeacherFiles");
  const desktopPreview = document.getElementById("ctxFilePreview");

  if (desktopFiles) {
    const obs = new MutationObserver(() => syncFileChip(fileContainer));
    obs.observe(desktopFiles, { childList: true, subtree: true, characterData: true });
  }
  if (desktopPreview) {
    const obs2 = new MutationObserver(() => syncFileChip(fileContainer));
    obs2.observe(desktopPreview, { childList: true, subtree: true, attributes: true });
  }

  // ── Keyboard: scroll chat to bottom when keyboard appears ────────

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (!isMobile()) return;
      const msgs = document.getElementById("chatMessages");
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    });
  }

  // ── Returned API ─────────────────────────────────────────────────

  function onStepUpdate(steps = [], currentStep = 0) {
    _steps = steps;
    _currentStep = currentStep;
    if (stepText) stepText.textContent = stepSummaryText(steps, currentStep);
    // If sheet is already open, re-render it
    const sheet = document.getElementById("mobileStepSheet");
    if (sheet && !sheet.classList.contains("v-hidden")) {
      renderStepSheet(stepList, steps, currentStep);
    }
  }

  function onTaskSelected() {
    if (stepText) stepText.textContent = "Cargando pasos…";
    _steps = [];
    _currentStep = 0;
    syncFileChip(fileContainer);
    if (infoBar) infoBar.hidden = false;
  }

  return { onStepUpdate, onTaskSelected };
}

// ── Inject a close row at the top of calc and board panes ───────────
// These panes are already in the DOM; we only add the row once.

function _addCalcCloseRow() {
  const pane = document.getElementById("ctxCalcPane");
  if (!pane || pane.querySelector(".calc-close-row")) return;
  const row = document.createElement("button");
  row.type = "button";
  row.className = "calc-close-row";
  row.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Cerrar calculadora`;
  row.addEventListener("click", () => {
    document.getElementById("btnCtxCalc")?.click();
  });
  pane.prepend(row);
}

function _addBoardCloseRow() {
  const pane = document.getElementById("ctxBoardPane");
  if (!pane || pane.querySelector(".board-close-row")) return;
  const row = document.createElement("button");
  row.type = "button";
  row.className = "calc-close-row board-close-row";
  row.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> Cerrar pizarra`;
  row.addEventListener("click", () => {
    document.getElementById("btnCtxPizarra")?.click();
  });
  pane.prepend(row);
}
