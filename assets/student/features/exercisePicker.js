// exercisePicker.js — chips de selección de ejercicio antes de iniciar sesión.
// show(exercises) recibe [{index, title}] del Agente Guía (no un regex).
// Devuelve Promise<{index, title}|null> — null si el alumno cambió de tarea.

const CSS = `
.ex-picker-row {
  padding: 12px 16px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid rgba(242,237,229,0.07);
}
.ex-picker-label {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  color: rgba(242,237,229,0.70);
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
  font-weight: 500;
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid rgba(242,237,229,0.22);
  background: transparent;
  color: rgba(242,237,229,0.80);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
  text-align: left;
}
.ex-picker-chip:hover {
  background: rgba(242,237,229,0.08);
  border-color: rgba(242,237,229,0.40);
  color: rgba(242,237,229,1);
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

export function createExercisePicker(chatList) {
  injectCSS();
  let _row     = null;
  let _resolve = null;

  // exercises: [{index: number, title: string}]
  // Returns Promise<{index, title}|null>
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

      for (const ex of exercises) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ex-picker-chip";
        btn.textContent = ex.title || `Ejercicio ${ex.index}`;
        btn.title = ex.title || "";
        btn.addEventListener("click", () => {
          const chosen = { index: ex.index, title: ex.title };
          _cleanup();
          resolve(chosen);
        });
        chips.appendChild(btn);
      }

      _row.appendChild(chips);
      try { chatList.appendChild(_row); } catch {}
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
