// stepMap.js — panel lateral de progreso de pasos del tutor IA.
// Desktop: panel fijo lateral (añadido al contenedor raíz del chat).
// Móvil:   barra superior colapsable.
// El avance de pasos lo detecta automáticamente el Socrático (no es manual).
import { escHtml } from "../../shared/js/escHtml.js";

export function createStepMapPanel(container) {
  if (!container) return { render() {}, update() {}, show() {}, hide() {}, destroy() {}, setOnChangeExercise() {} };

  let panel              = null;
  let toggleBtn          = null;
  let listEl             = null;
  let collapsed          = false;
  let initialized        = false;
  let _onChangeExercise  = null;

  function build() {
    panel = document.createElement("div");
    panel.className = "step-map-panel";
    panel.setAttribute("aria-label", "Progreso del ejercicio");

    panel.innerHTML = `
      <div class="step-map-header">
        <span class="step-map-title">Progreso</span>
        <span class="step-map-count" id="smCount">0/0</span>
        <button class="step-map-change" type="button" title="Elegir otro ejercicio">Cambiar</button>
        <button class="step-map-toggle" aria-label="Mostrar/ocultar pasos" type="button">▾</button>
      </div>
      <ul class="step-map-list" role="list"></ul>`;

    toggleBtn = panel.querySelector(".step-map-toggle");
    listEl    = panel.querySelector(".step-map-list");

    toggleBtn?.addEventListener("click", () => {
      collapsed = !collapsed;
      panel.classList.toggle("is-collapsed", collapsed);
      if (toggleBtn) toggleBtn.textContent = collapsed ? "▸" : "▾";
    });

    panel.querySelector(".step-map-change")?.addEventListener("click", () => {
      try { _onChangeExercise?.(); } catch {}
    });

    container.appendChild(panel);
    initialized = true;
  }

  function render(steps = [], currentStep = 0) {
    if (!initialized) build();

    const done  = steps.filter(s => s.completed).length;
    const total = steps.length;

    const countEl = panel.querySelector("#smCount");
    if (countEl) countEl.textContent = `${done}/${total}`;

    if (!listEl) return;
    listEl.innerHTML = steps.map(s => {
      let cls = "step-map-item";
      let icon = "○";
      if (s.completed)            { cls += " is-done";    icon = "✓"; }
      else if (s.index === currentStep) { cls += " is-current"; icon = "→"; }

      return `<li class="${cls}" role="listitem">
        <span class="step-map-icon" aria-hidden="true">${icon}</span>
        <span class="step-map-text">${escHtml(s.title)}</span>
      </li>`;
    }).join("");

    // Hacer scroll al paso actual si está fuera de vista
    requestAnimationFrame(() => {
      try {
        const currentEl = listEl.querySelector(".is-current");
        currentEl?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } catch {}
    });
  }

  function update(stepMap) {
    if (!stepMap) return;
    const steps       = Array.isArray(stepMap.steps) ? stepMap.steps : [];
    const currentStep = typeof stepMap.currentStep === "number" ? stepMap.currentStep : 0;
    render(steps, currentStep);
  }

  function show() {
    if (!initialized) build();
    panel.style.display = "";
  }

  function hide() {
    if (panel) panel.style.display = "none";
  }

  function destroy() {
    try { panel?.remove(); } catch {}
    panel = null; listEl = null; toggleBtn = null; initialized = false;
  }

  function setOnChangeExercise(fn) { _onChangeExercise = fn; }

  return { render, update, show, hide, destroy, setOnChangeExercise };
}

// ── CSS inyectado ──────────────────────────────────────────────────────────
// Se inyecta una vez en el <head> para no requerir un archivo CSS extra.

const STEP_MAP_CSS = `
.step-map-panel {
  width: 100%;
  background: var(--panel-bg);
  border-bottom: 1px solid var(--hairline);
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
}
.step-map-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--hairline);
  flex-shrink: 0;
}
.step-map-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-mute);
  flex: 1;
}
.step-map-count {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  color: var(--ink-mute);
}
.step-map-toggle {
  background: none;
  border: none;
  color: var(--ink-mute);
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
  line-height: 1;
  display: none;
}
.step-map-change {
  background: none;
  border: none;
  color: var(--ink-faint);
  cursor: pointer;
  font-size: 9px;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0 4px;
  line-height: 1;
  transition: color .12s;
}
.step-map-change:hover { color: var(--ink-soft); }
.step-map-list {
  list-style: none;
  margin: 0;
  padding: 8px 0 12px;
  overflow-y: auto;
  flex: 1;
}
.step-map-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--ink-faint);
  line-height: 1.35;
  transition: color .12s;
}
.step-map-item.is-done {
  color: var(--state-done);
}
.step-map-item.is-current {
  color: var(--ink);
  font-weight: 500;
}
.step-map-icon {
  font-size: 11px;
  flex-shrink: 0;
  margin-top: 1px;
  font-family: 'IBM Plex Mono', monospace;
}
.step-map-text {
  flex: 1;
}

/* Móvil: barra horizontal colapsable */
@media (max-width: 768px) {
  .step-map-panel {
    width: 100%;
    border-left: none;
    border-bottom: 1px solid var(--hairline);
  }
  .step-map-toggle {
    display: block;
  }
  .step-map-panel.is-collapsed .step-map-list {
    display: none;
  }
}
`;

let _cssInjected = false;
export function injectStepMapCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  try {
    const style = document.createElement("style");
    style.textContent = STEP_MAP_CSS;
    document.head.appendChild(style);
  } catch {}
}
