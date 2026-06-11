// Mobile tutor panel controller (≤768px).
// Manages the redesigned header, step bar, teacher pin, step sheet,
// action (+) sheet, close sheet, camera input, and keyboard behaviour.

import { apiFetch } from "../../shared/js/auth.js";

// ── Utilities ────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isMobile() {
  return window.matchMedia("(max-width: 768px)").matches;
}

const TIPO_MAP = { homework: "Deberes", exam: "Examen", work: "Trabajo" };

function tipoLabel(type) {
  return TIPO_MAP[type] || "";
}

// ── Sheet open / close ───────────────────────────────────────────────

function openSheet(backdropEl, sheetEl) {
  if (!backdropEl || !sheetEl) return;
  backdropEl.classList.remove("v-hidden");
  sheetEl.classList.remove("v-hidden");
  requestAnimationFrame(() => sheetEl.classList.add("is-open"));
  document.body.style.overflow = "hidden";
}

function closeSheet(backdropEl, sheetEl) {
  if (!backdropEl || !sheetEl) return;
  sheetEl.classList.remove("is-open");
  const onEnd = () => {
    sheetEl.classList.add("v-hidden");
    backdropEl.classList.add("v-hidden");
    sheetEl.removeEventListener("transitionend", onEnd);
  };
  sheetEl.addEventListener("transitionend", onEnd);
  document.body.style.overflow = "";
}

// ── Step sheet list rendering ────────────────────────────────────────

function renderStepList(listEl, steps, currentStep) {
  if (!listEl) return;
  if (!steps?.length) {
    listEl.innerHTML = `<li class="mobile-step-item"><span class="mobile-step-icon">○</span>Sin pasos aún.</li>`;
    return;
  }
  listEl.innerHTML = steps.map((step, i) => {
    const done  = i < currentStep;
    const cur   = i === currentStep;
    const cls   = done ? "is-done" : cur ? "is-current" : "";
    const icon  = done ? "✓" : cur ? "→" : "○";
    const title = typeof step === "string" ? step : (step.title || step.text || `Paso ${i + 1}`);
    return `<li class="mobile-step-item ${cls}">
      <span class="mobile-step-icon">${escHtml(icon)}</span>
      <span>${escHtml(title)}</span>
    </li>`;
  }).join("");
}

// ── Step bar segment rendering ────────────────────────────────────────

function renderSegments(segsEl, total, current) {
  if (!segsEl || total < 1) return;
  segsEl.innerHTML = Array.from({ length: total }, (_, i) => {
    const cls = i < current ? "is-done" : i === current ? "is-now" : "";
    return `<span class="mth-seg ${cls}"></span>`;
  }).join("");
}

// Updates the step bar visibility and content.
// Passes all DOM elements as explicit parameters (no scope closure).
function updateStepBar(barEl, segsEl, labelEl, txtEl, steps, currentStep) {
  if (!barEl) return;
  if (!steps?.length) { barEl.hidden = true; return; }
  barEl.hidden = false;
  renderSegments(segsEl, steps.length, currentStep);
  if (labelEl) labelEl.textContent = `Paso ${currentStep + 1} de ${steps.length}`;
  if (txtEl) {
    const step = steps[currentStep];
    txtEl.textContent = typeof step === "string" ? step : (step?.title || step?.text || "");
  }
}

// ── Header / pin sync ────────────────────────────────────────────────

// Reads task from getTaskContext() and updates eyebrow, title, and teacher pin.
// Receives all DOM nodes as parameters.
function syncHeader(eyebrowEl, titleEl, pinEl, pinContentEl, getTaskContext) {
  const task = typeof getTaskContext === "function" ? getTaskContext() : null;
  if (eyebrowEl) {
    const parts = [];
    const subj = task?.subject || task?.subjectName || "";
    const tipo = tipoLabel(task?.type || "");
    if (subj) parts.push(subj.toUpperCase());
    if (tipo) parts.push(tipo.toUpperCase());
    eyebrowEl.textContent = parts.length ? parts.join(" · ") : "—";
  }
  if (titleEl) titleEl.textContent = task?.title || "—";
  const notes = task?.teacherNotes || "";
  if (pinEl)        pinEl.hidden = !notes;
  if (pinContentEl) pinContentEl.textContent = notes;
}

// ── Camera: forward to main attach flow ──────────────────────────────

function forwardCameraToFilePick(cameraPickEl) {
  const file = cameraPickEl?.files?.[0];
  if (!file) return;
  const mainPick = document.getElementById("filePick");
  if (!mainPick) return;
  try {
    const dt = new DataTransfer();
    dt.items.add(file);
    mainPick.files = dt.files;
    mainPick.dispatchEvent(new Event("change", { bubbles: true }));
  } catch {}
}

// ── Pane close row injector ───────────────────────────────────────────

function addPaneCloseRow(paneId, markerClass, label, closeBtnId) {
  const pane = document.getElementById(paneId);
  if (!pane || pane.querySelector("." + markerClass)) return;
  const row = document.createElement("button");
  row.type = "button";
  row.className = `calc-close-row ${markerClass}`;
  row.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> ${label}`;
  row.addEventListener("click", () => document.getElementById(closeBtnId)?.click());
  pane.prepend(row);
}

// ── Public API ───────────────────────────────────────────────────────

export function initMobileTutor({ onShowHistorial, getTaskContext } = {}) {

  // ── Header elements ──
  const eyebrowEl    = document.getElementById("mthEyebrow");
  const titleEl      = document.getElementById("mthTaskTitle");
  const pinEl        = document.getElementById("mthPin");
  const pinContentEl = document.getElementById("mthPinContent");

  // ── Step bar elements ──
  const stepBarEl  = document.getElementById("mthStepBar");
  const segsEl     = document.getElementById("mthSegs");
  const stepLabelEl= document.getElementById("mthStepK");
  const stepTxtEl  = document.getElementById("mthStepTxt");

  // ── Step sheet ──
  const stepBackdrop = document.getElementById("mobileStepBackdrop");
  const stepSheet    = document.getElementById("mobileStepSheet");
  const stepListEl   = document.getElementById("mobileStepList");

  // ── Action sheet ──
  const actionBackdrop = document.getElementById("mobileActionBackdrop");
  const actionSheet    = document.getElementById("mobileActionSheet");

  // ── Close sheet ──
  const closeBackdrop = document.getElementById("mthCloseBackdrop");
  const closeSheetEl  = document.getElementById("mthCloseSheet");

  let _steps = [];
  let _currentStep = 0;

  // ── Back button: delegates to existing #btnBackToAgenda ──────────
  document.getElementById("mthBackBtn")?.addEventListener("click", () =>
    document.getElementById("btnBackToAgenda")?.click());

  // ── Step bar → step sheet ────────────────────────────────────────
  stepBarEl?.addEventListener("click", () => {
    renderStepList(stepListEl, _steps, _currentStep);
    openSheet(stepBackdrop, stepSheet);
  });

  document.getElementById("mobileStepClose")?.addEventListener("click", () =>
    closeSheet(stepBackdrop, stepSheet));
  stepBackdrop?.addEventListener("click", () =>
    closeSheet(stepBackdrop, stepSheet));

  // ── Done button → close sheet ────────────────────────────────────
  document.getElementById("mthDoneBtn")?.addEventListener("click", () =>
    openSheet(closeBackdrop, closeSheetEl));

  closeBackdrop?.addEventListener("click", () =>
    closeSheet(closeBackdrop, closeSheetEl));
  document.getElementById("mthCloseSheetClose")?.addEventListener("click", () =>
    closeSheet(closeBackdrop, closeSheetEl));
  document.getElementById("mthCloseSheetContinue")?.addEventListener("click", () =>
    closeSheet(closeBackdrop, closeSheetEl));

  // Close sheet options: delegate to existing hidden buttons
  document.getElementById("mthCloseOptDone")?.addEventListener("click", () => {
    closeSheet(closeBackdrop, closeSheetEl);
    document.getElementById("btnTerminado")?.click();
  });

  document.getElementById("mthCloseOptNota")?.addEventListener("click", () => {
    closeSheet(closeBackdrop, closeSheetEl);
    document.getElementById("btnNotaProfesor")?.click();
  });

  // ── Action sheet (+) ─────────────────────────────────────────────
  document.getElementById("mobileAttachBtn")?.addEventListener("click", () =>
    openSheet(actionBackdrop, actionSheet));
  actionBackdrop?.addEventListener("click", () =>
    closeSheet(actionBackdrop, actionSheet));

  document.getElementById("mobileActionFile")?.addEventListener("click", () => {
    closeSheet(actionBackdrop, actionSheet);
    document.getElementById("clip")?.click();
  });

  document.getElementById("mobileActionCamera")?.addEventListener("click", () => {
    closeSheet(actionBackdrop, actionSheet);
    document.getElementById("cameraPick")?.click();
  });

  document.getElementById("mobileActionCalc")?.addEventListener("click", () => {
    closeSheet(actionBackdrop, actionSheet);
    document.getElementById("btnCtxCalc")?.click();
  });

  document.getElementById("mobileActionBoard")?.addEventListener("click", () => {
    closeSheet(actionBackdrop, actionSheet);
    document.getElementById("btnCtxPizarra")?.click();
  });

  // ── Camera pick → main file attach flow ──────────────────────────
  const cameraPickEl = document.getElementById("cameraPick");
  cameraPickEl?.addEventListener("change", () => forwardCameraToFilePick(cameraPickEl));

  // ── Keyboard: keep chat scrolled to bottom ───────────────────────
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      if (!isMobile()) return;
      const msgs = document.getElementById("messages");
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    });
  }

  // ── Calc / board inline panes: inject close row ──────────────────
  addPaneCloseRow("ctxCalcPane",  "calc-close-row",  "Cerrar calculadora", "btnCtxCalc");
  addPaneCloseRow("ctxBoardPane", "board-close-row", "Cerrar pizarra",     "btnCtxPizarra");

  // ── Public API ───────────────────────────────────────────────────

  function onStepUpdate(steps = [], currentStep = 0) {
    _steps = steps;
    _currentStep = currentStep;
    updateStepBar(stepBarEl, segsEl, stepLabelEl, stepTxtEl, steps, currentStep);
    if (stepSheet && !stepSheet.classList.contains("v-hidden")) {
      renderStepList(stepListEl, steps, currentStep);
    }
  }

  function onTaskSelected() {
    _steps = [];
    _currentStep = 0;
    updateStepBar(stepBarEl, segsEl, stepLabelEl, stepTxtEl, [], 0);
    syncHeader(eyebrowEl, titleEl, pinEl, pinContentEl, getTaskContext);
  }

  return { onStepUpdate, onTaskSelected };
}
