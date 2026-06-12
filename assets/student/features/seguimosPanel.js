// seguimosPanel.js — overlay "¿Seguimos?" tras "He terminado".
// showSeguimosPanel(chatPaneEl, allExercises, completedIndices?)
//   → Promise<{type:'exercise', exercise:{index,title}} | {type:'back'}>
//
// allExercises: todos los ejercicios de la tarea
// completedIndices: Set de indices ya completados (incluye el que acaba de terminar)

const CSS = `
.tutor-chat-pane { position: relative; }
.sq-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  background: var(--glass-strong);
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
  color: var(--ink);
  margin: 0;
  letter-spacing: -0.01em;
}
.sq-sub {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  color: var(--ink-soft);
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
  border: 1px solid var(--copper-soft);
  background: var(--copper-glow);
  color: var(--ink);
  cursor: pointer;
  transition: background .12s, border-color .12s, color .12s, opacity .12s;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}
.sq-chip:hover {
  background: rgba(196,131,74,0.22);
  border-color: var(--copper);
  color: var(--ink);
}
.sq-chip--done {
  border-color: var(--hairline-strong);
  background: transparent;
  color: var(--ink-mute);
  opacity: 0.72;
}
.sq-chip--done:hover {
  background: var(--copper-glow);
  border-color: var(--copper-soft);
  color: var(--ink-soft);
  opacity: 1;
}
.sq-chip-label { font-size: 12px; font-weight: 600; line-height: 1.2; }
.sq-chip-sub {
  font-size: 10px; font-weight: 400;
  color: var(--ink-mute);
  line-height: 1.2;
  max-width: 140px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sq-chip--done .sq-chip-label::after {
  content: " ✓";
  font-size: 10px;
  color: var(--copper-soft);
  font-weight: 400;
}
.sq-confirm {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  max-width: 280px;
}
.sq-confirm-q {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 14px;
  color: var(--ink);
  font-weight: 500;
  line-height: 1.45;
  text-align: center;
}
.sq-confirm-name {
  font-style: italic;
  color: var(--copper);
}
.sq-confirm-btns {
  display: flex;
  gap: 8px;
}
.sq-confirm-yes {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  background: var(--copper-glow);
  border: 1px solid var(--copper-soft);
  cursor: pointer;
  padding: 8px 20px;
  border-radius: 8px;
  transition: background .12s, border-color .12s;
}
.sq-confirm-yes:hover { background: rgba(196,131,74,0.22); border-color: var(--copper); }
.sq-confirm-no {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--hairline-strong);
  cursor: pointer;
  padding: 8px 20px;
  border-radius: 8px;
  transition: color .12s, background .12s;
}
.sq-confirm-no:hover { color: var(--ink); background: var(--copper-glow); }
.sq-back-btn {
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: var(--ink-soft);
  background: transparent;
  border: 1px solid var(--hairline-strong);
  cursor: pointer;
  padding: 9px 22px;
  border-radius: 8px;
  margin-top: 6px;
  transition: color .15s, background .15s, border-color .15s;
}
.sq-back-btn:hover {
  color: var(--ink);
  background: var(--copper-glow);
  border-color: var(--copper-soft);
}
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

function _buildConfirmNode(ex, label, onYes, onNo) {
  const wrap = document.createElement("div");
  wrap.className = "sq-confirm";

  const q = document.createElement("p");
  q.className = "sq-confirm-q";
  q.innerHTML = `¿Quieres repetir <span class="sq-confirm-name">${label}</span>?`;
  wrap.appendChild(q);

  const btns = document.createElement("div");
  btns.className = "sq-confirm-btns";

  const yes = document.createElement("button");
  yes.type = "button";
  yes.className = "sq-confirm-yes";
  yes.textContent = "Sí, repetirlo";
  yes.addEventListener("click", onYes);

  const no = document.createElement("button");
  no.type = "button";
  no.className = "sq-confirm-no";
  no.textContent = "Ver otros";
  no.addEventListener("click", onNo);

  btns.appendChild(yes);
  btns.appendChild(no);
  wrap.appendChild(btns);
  return wrap;
}

// Returns Promise<{type:'exercise', exercise:{index,title}} | {type:'back'}>
export function showSeguimosPanel(chatPaneEl, allExercises = [], completedIndices = new Set()) {
  _injectCSS();

  const allDone = allExercises.length > 0 && allExercises.every((ex) => completedIndices.has(ex.index));

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sq-overlay";

    const title = document.createElement("h2");
    title.className = "sq-title";
    title.textContent = "¿Seguimos?";
    overlay.appendChild(title);

    if (allExercises.length === 0 || allDone) {
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

      allExercises.forEach((ex, i) => {
        const isDone = completedIndices.has(ex.index);
        const label  = _shortLabel(ex, i);
        const btn    = document.createElement("button");
        btn.type      = "button";
        btn.className = "sq-chip" + (isDone ? " sq-chip--done" : "");
        btn.title     = ex.title || "";

        const lbl = document.createElement("span");
        lbl.className   = "sq-chip-label";
        lbl.textContent = label;
        btn.appendChild(lbl);

        const sub = _subTitle(ex);
        if (sub) {
          const subEl = document.createElement("span");
          subEl.className   = "sq-chip-sub";
          subEl.textContent = sub;
          btn.appendChild(subEl);
        }

        btn.addEventListener("click", () => {
          if (isDone) {
            // Inline confirmation: swap content
            chips.style.display = "none";
            overlay.querySelector(".sq-sub").style.display = "none";

            const confirm = _buildConfirmNode(
              ex,
              label,
              () => { overlay.remove(); resolve({ type: "exercise", exercise: ex }); },
              () => {
                confirm.remove();
                chips.style.display = "";
                overlay.querySelector(".sq-sub").style.display = "";
              },
            );
            // Insert before back button
            const backBtn = overlay.querySelector(".sq-back-btn");
            overlay.insertBefore(confirm, backBtn);
          } else {
            overlay.remove();
            resolve({ type: "exercise", exercise: ex });
          }
        });
        chips.appendChild(btn);
      });
      overlay.appendChild(chips);
    }

    const backBtn = document.createElement("button");
    backBtn.type      = "button";
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
