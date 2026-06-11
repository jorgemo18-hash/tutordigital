// exercisePicker.js — chips de selección de ejercicio antes de iniciar sesión.
// show(exercises) recibe [{index, title}] del Agente Guía.
// Devuelve Promise<{index, title}|null> — null si el alumno cambió de tarea.

const CSS = `
.ex-picker-row {
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--hairline);
}
.ex-picker-label {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  color: var(--ink-soft);
  margin: 0;
}
.ex-picker-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ex-picker-chip {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--copper-soft);
  background: var(--copper-glow);
  color: var(--ink);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}
.ex-picker-chip:hover {
  background: rgba(196,131,74,0.22);
  border-color: var(--copper);
  color: var(--ink);
}
.ex-picker-chip-label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
}
.ex-picker-chip-sub {
  font-size: 10px;
  font-weight: 400;
  color: var(--ink-mute);
  line-height: 1.2;
  max-width: 140px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;

let _cssInjected = false;
function injectCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Genera una etiqueta corta usando el índice posicional (1-based) del chip en la lista.
// "Ejercicio 25 — Calcula..." en posición 0 → "Ej 1"
// "Problema X"               en posición 2 → "Prob 3"
function shortLabel(ex, index) {
  const raw = String(ex.title || "").trim().toLowerCase();
  const num = index + 1;
  if (/^problema/.test(raw))                      return `Prob ${num}`;
  if (/^apartado/.test(raw))                      return `Apart. ${num}`;
  if (/^actividad/.test(raw))                     return `Act. ${num}`;
  if (/^cuesti[oó]n/.test(raw) || /^pregunta/.test(raw)) return `Preg. ${num}`;
  return `Ej ${num}`;
}

// Subtítulo: título completo pero sin el prefijo numérico redundante
function subTitle(ex) {
  const t = String(ex.title || "").trim();
  // Quitar "Ejercicio N — " o "Ejercicio N: " del inicio
  return t.replace(/^(ejercicio|problema|actividad|apartado|cuestión|pregunta)\s*\d*\s*[—:\-]?\s*/i, "").trim();
}

export function createExercisePicker(container) {
  injectCSS();
  let _row     = null;
  let _resolve = null;

  function show(exercises = []) {
    hide();
    return new Promise((resolve) => {
      _resolve = resolve;

      _row = document.createElement("div");
      _row.className = "ex-picker-row";

      const label = document.createElement("p");
      label.className = "ex-picker-label";
      label.textContent = "¿Por qué ejercicio quieres empezar?";
      _row.appendChild(label);

      const chips = document.createElement("div");
      chips.className = "ex-picker-chips";

      exercises.forEach((ex, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ex-picker-chip";
        btn.title = ex.title || "";

        const labelEl = document.createElement("span");
        labelEl.className = "ex-picker-chip-label";
        labelEl.textContent = shortLabel(ex, i);
        btn.appendChild(labelEl);

        const sub = subTitle(ex);
        if (sub) {
          const subEl = document.createElement("span");
          subEl.className = "ex-picker-chip-sub";
          subEl.textContent = sub;
          btn.appendChild(subEl);
        }

        btn.addEventListener("click", () => {
          _cleanup();
          resolve({ index: ex.index, title: ex.title });
        });
        chips.appendChild(btn);
      });

      _row.appendChild(chips);
      try { container.appendChild(_row); } catch {}
      try { _row.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch {}
    });
  }

  function _cleanup() {
    if (_row) { try { _row.remove(); } catch {} _row = null; }
    _resolve = null;
  }

  function hide() {
    if (_resolve) { _resolve(null); }
    _cleanup();
  }

  return { show, hide };
}
