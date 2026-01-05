import { DOM } from "./state.js";
import { getHistory, setHistory, ensureToday } from "./storage.js";
import { normalizeInput, normalizeDictation, asciiToLatex, looksMath } from "./math.js";
import { initMic } from "./mic.js";

const {
  chat, inp, btn, kbd, pad, eqPreview, micBtn,
  agenda, initialRow, btnDeberes, btnExamen, btnTrabajo
} = DOM;
// ========= helpers =========
function update() {
  btn.disabled = inp.value.trim().length === 0;
}

// =========================
//  Preview (input -> KaTeX)
// =========================
function renderPreview() {
  if (!eqPreview) return;

  const raw = inp.value.trim();
  if (!raw || !looksMath(raw)) {
    eqPreview.style.display = "none";
    eqPreview.innerHTML = "";
    return;
  }

  eqPreview.style.display = "block";

  if (!window.katex) {
    eqPreview.textContent = raw;
    return;
  }

  try {
    katex.render(asciiToLatex(raw), eqPreview, { throwOnError: false, displayMode: false });
  } catch {
    eqPreview.textContent = raw;
  }
}

// =========================
//  UI helpers
// =========================
function add(role, text) {
  const row = document.createElement("div");
  row.className = "row " + (role === "user" ? "u" : "a");

  const bub = document.createElement("div");
  bub.className = "bubble";

  if (role === "assistant") {
    const safe = String(text || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\n", "<br>");

    bub.innerHTML = safe;

    if (window.renderMathInElement) {
      renderMathInElement(bub, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
      });
    }
  } else {
    const raw = String(text || "");
    if (looksMath(raw) && window.katex) {
      try {
        katex.render(asciiToLatex(raw), bub, { throwOnError: false, displayMode: false });
      } catch {
        bub.textContent = raw;
        bub.dataset.rawMath = raw;
      }
    } else {
      bub.textContent = raw;
      if (looksMath(raw)) bub.dataset.rawMath = raw;
    }
  }

  row.appendChild(bub);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function renderFromHistory() {

  chat.innerHTML = "";
  if (agenda) chat.appendChild(agenda);

  const hist = getHistory(); // ✅ esto se queda
  if (hist.length === 0) {
    if (initialRow) chat.appendChild(initialRow);
    else add("assistant", "¿Por dónde arrancamos? Escribe: deberes, exámenes o trabajos.");
    return;
  }
  for (const m of hist) add(m.role === "assistant" ? "assistant" : "user", m.content);
}

function rerenderPendingMath() {
  if (!window.katex) return;
  document.querySelectorAll(".bubble[data-raw-math]").forEach((bub) => {
    const raw = bub.dataset.rawMath || "";
    if (!raw) return;
    try {
      katex.render(asciiToLatex(raw), bub, { throwOnError: false, displayMode: false });
      delete bub.dataset.rawMath;
    } catch {}
  });
}

// =========================
//  Backend /api/chat
// =========================
async function askGPT() {
  const hist = getHistory();
  const messages = hist.map((m) => ({ role: m.role, content: m.content }));

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "API error");
  return data?.text ? data.text : "No he podido responder ahora mismo.";
}

async function sendText(text) {
  ensureToday();

  const t = String(text || "").trim();
  if (!t) return;

  add("user", t);
  const hist = getHistory();
  hist.push({ role: "user", content: t });
  setHistory(hist);

  btn.disabled = true;

  try {
    const answer = await askGPT();
    add("assistant", answer);

    const hist2 = getHistory();
    hist2.push({ role: "assistant", content: answer });
    setHistory(hist2);
  } catch (e) {
    console.error(e);
    add("assistant", "Ahora mismo no puedo conectar con el tutor. Prueba otra vez.");
  } finally {
    update();
    renderPreview();
    setTimeout(() => inp.focus(), 0);
  }
}

function send() {
  const text = inp.value.trim();
  if (!text) return;

  inp.value = "";

  draftFinal = "";
  insertCtx = null;
  if (isRecording) stopMic();

  update();
  renderPreview();
  sendText(text);

  setTimeout(() => inp.focus(), 0);
}

// =========================
//  Inserción con cursor
// =========================
function insertWithCursor(text, cursorAt) {
  const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
  const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

  const before = inp.value.slice(0, start);
  const after = inp.value.slice(end);

  inp.value = before + text + after;

  const pos = start + cursorAt;
  inp.setSelectionRange(pos, pos);
  inp.focus();

  update();
  renderPreview();
}

function handleInsert(value) {
  let v = normalizeInput(value);

  if (v === "()") return insertWithCursor("()", 1);
  if (v === "[]") return insertWithCursor("[]", 1);
  if (v === "^{}") return insertWithCursor("^()", 2);

  if (v === "√()" || v === "√") return insertWithCursor("sqrt()", 5);

  if (v === "sin()") return insertWithCursor("sin()", 4);
  if (v === "cos()") return insertWithCursor("cos()", 4);
  if (v === "tan()") return insertWithCursor("tan()", 4);
  if (v === "log()") return insertWithCursor("log()", 4);
  if (v === "ln()") return insertWithCursor("ln()", 3);

  if (v === "x^2") return insertWithCursor("x^2", 3);
  if (v === "x^3") return insertWithCursor("x^3", 3);

  if (v === "/") return insertWithCursor("()/()", 1);
  if (v === "π") return insertWithCursor("π", 1);

  return insertWithCursor(v, v.length);
}



// =========================
//  Listeners
// =========================
btnDeberes && btnDeberes.addEventListener("click", () => sendText("Deberes"));
btnExamen  && btnExamen.addEventListener("click",  () => sendText("Exámenes"));
btnTrabajo && btnTrabajo.addEventListener("click", () => sendText("Trabajo"));


inp.addEventListener("input", () => { update(); renderPreview(); });
inp.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
btn.addEventListener("click", send);

document.addEventListener("click", (e) => {
  const el = e.target.closest(".chipLink");
  if (!el) return;
  const value = el.dataset.send;
  if (value) sendText(value);
});

kbd && kbd.addEventListener("click", () => {
  const inIframe = window.parent && window.parent !== window;
  if (inIframe) {
    window.parent.postMessage({ type: "togglePad" }, "*");
  } else {
    pad && pad.classList.toggle("show");
  }
  setTimeout(() => inp.focus(), 0);
});

pad && pad.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (!b) return;
  handleInsert(b.dataset.i);
});


window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data === "focusInput") {
    setTimeout(() => inp.focus(), 0);
    return;
  }
  if (data.type === "sendText") {
    sendText(data.text);
    return;
  }
  if (data.type === "insert") {
    handleInsert(data.value);
    return;
  }
  if (data.type === "moveCursor") {
    const pos = inp.selectionStart + data.offset;
    inp.setSelectionRange(pos, pos);
    inp.focus();
    renderPreview();
    return;
  }
});

// =========================
//  INIT
// =========================
ensureToday();
renderFromHistory();
update();

window.addEventListener("load", () => {
  rerenderPendingMath();
  renderPreview();
  setTimeout(() => inp.focus(), 0);
});
