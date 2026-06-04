// seguimosPanel.js — overlay "¿Seguimos?" sobre la columna de chat tras "He terminado".
// showSeguimosPanel(chatPaneEl, pendingExercises) → Promise<{type:'exercise',exercise}|{type:'back'}>

const CSS = `
.tutor-chat-pane { position: relative; }
.sq-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: rgba(10, 8, 6, 0.96);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 24px;
  gap: 18px;
  text-align: center;
}
.sq-title {
  font-family: 'Instrument Serif', Georgia, serif;
  font-size: 26px;
  font-weight: 400;
  color: rgba(242, 237, 229, 1);
  margin: 0;
  letter-spacing: -0.01em;
}
.sq-sub {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  color: rgba(242, 237, 229, 0.60);
  margin: -4px 0 0;
  max-width: 30ch;
  line-height: 1.5;
}
.sq-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  max-width: 380px;
}
.sq-chip {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid rgba(242, 237, 229, 0.22);
  background: transparent;
  color: rgba(242, 237, 229, 0.85);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}
.sq-chip:hover {
  background: rgba(242, 237, 229, 0.10);
  border-color: rgba(242, 237, 229, 0.44);
  color: rgba(242, 237, 229, 1);
}
.sq-chip-label { font-size: 12px; font-weight: 600; line-height: 1.2; }
.sq-chip-sub {
  font-size: 10px; font-weight: 400;
  color: rgba(242, 237, 229, 0.50);
  line-height: 1.2;
  max-width: 140px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sq-back-btn {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: rgba(242, 237, 229, 0.75);
  background: transparent;
  border: 1px solid rgba(242, 237, 229, 0.25);
  cursor: pointer;
  padding: 9px 22px;
  border-radius: 8px;
  margin-top: 6px;
  transition: color .15s, background .15s, border-color .15s;
}
.sq-back-btn:hover {
  color: rgba(242, 237, 229, 1);
  background: rgba(242, 237, 229, 0.08);
  border-color: rgba(242, 237, 229, 0.45);
}

html[data-theme="light"] .sq-overlay {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
html[data-theme="light"] .sq-title      { color: var(--ink); }
html[data-theme="light"] .sq-sub        { color: var(--ink-mute); }
html[data-theme="light"] .sq-chip       { border-color: var(--hairline-strong); color: var(--ink-soft); }
html[data-theme="light"] .sq-chip:hover { background: rgba(60,45,30,0.06); border-color: rgba(60,45,30,0.30); color: var(--ink); }
html[data-theme="light"] .sq-chip-sub   { color: var(--ink-faint); }
html[data-theme="light"] .sq-back-btn   { color: var(--ink-mute); border-color: var(--hairline-strong); }
html[data-theme="light"] .sq-back-btn:hover { background: rgba(60,45,30,0.06); border-color: rgba(60,45,30,0.30); color: var(--ink); }
`;

let _cssInjected = false;
function _injectCSS() {
  if (_cssInjected) return;
  _cssInjected = true;
  const s = document.createElement("style");
  s.textContent = CSS;
  document.head.appendChild(s);
}

function _shortLabel(ex, posIndex) {
  const raw = String(ex.title || "").trim().toLowerCase();
  const num = posIndex + 1;
  if (/^problema/.test(raw))                             return `Prob ${num}`;
  if (/^apartado/.test(raw))                             return `Apart. ${num}`;
  if (/^actividad/.test(raw))                            return `Act. ${num}`;
  if (/^cuesti[oó]n/.test(raw) || /^pregunta/.test(raw)) return `Preg. ${num}`;
  return `Ej ${num}`;
}

function _subTitle(ex) {
  return String(ex.title || "").trim()
    .replace(/^(ejercicio|problema|actividad|apartado|cuestión|pregunta)\s*\d*\s*[—:\-]?\s*/i, "")
    .trim();
}

// Returns Promise<{type:'exercise', exercise:{index,title}} | {type:'back'}>
export function showSeguimosPanel(chatPaneEl, pendingExercises = []) {
  _injectCSS();

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sq-overlay";

    const title = document.createElement("h2");
    title.className = "sq-title";
    title.textContent = "¿Seguimos?";
    overlay.appendChild(title);

    if (pendingExercises.length === 0) {
      const msg = document.createElement("p");
      msg.className = "sq-sub";
      msg.textContent = "Has terminado todos los ejercicios de esta hoja.";
      overlay.appendChild(msg);
    } else {
      const sub = document.createElement("p");
      sub.className = "sq-sub";
      sub.textContent = "Elige el siguiente ejercicio o vuelve a la agenda.";
      overlay.appendChild(sub);

      const chips = document.createElement("div");
      chips.className = "sq-chips";

      pendingExercises.forEach((ex, i) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sq-chip";
        btn.title = ex.title || "";

        const lbl = document.createElement("span");
        lbl.className = "sq-chip-label";
        lbl.textContent = _shortLabel(ex, i);
        btn.appendChild(lbl);

        const sub = _subTitle(ex);
        if (sub) {
          const subEl = document.createElement("span");
          subEl.className = "sq-chip-sub";
          subEl.textContent = sub;
          btn.appendChild(subEl);
        }

        btn.addEventListener("click", () => {
          overlay.remove();
          resolve({ type: "exercise", exercise: ex });
        });
        chips.appendChild(btn);
      });
      overlay.appendChild(chips);
    }

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "sq-back-btn";
    backBtn.textContent = "Volver a la agenda";
    backBtn.addEventListener("click", () => {
      overlay.remove();
      resolve({ type: "back" });
    });
    overlay.appendChild(backBtn);

    chatPaneEl.appendChild(overlay);
    try { overlay.scrollIntoView({ block: "nearest" }); } catch {}
  });
}
