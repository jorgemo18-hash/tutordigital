import { DOM } from "./state.js";
import { getHistory, setHistory, ensureToday } from "./storage.js";

const {
  chat, inp, btn, kbd, pad, eqPreview, micBtn,
  agenda, initialRow, btnDeberes, btnExamen, btnTrabajo
} = DOM;
// ========= helpers =========
function update() {
  btn.disabled = inp.value.trim().length === 0;
}

function normalizeInput(s) {
  return String(s || "")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-");
}

// =========================
//  ASCII -> LaTeX (alumno)
// =========================
function normalizeDictation(raw) {
  let s = String(raw || "");

  const probe = s.toLowerCase();
  const seemsMath =
    /\b(x|equis|ra[ií]z|sqrt|más|menos|por|entre|dividido|igual|al\s+cuadrado|al\s+cubo|elevado)\b/.test(probe) ||
    /[0-9+\-*/^=]/.test(probe);

  if (!seemsMath) return String(raw || "");

  s = probe;

  // "equis" -> x
  s = s.replace(/\bequis\b/g, "x");

  // --- potencias ---
  s = s
    .replace(/\b(x)\s+al\s+cuadrado\b/g, "$1^2")
    .replace(/\b(x)\s+al\s+cubo\b/g, "$1^3")
    .replace(/\b(al\s+cuadrado)\b/g, "^2")
    .replace(/\b(al\s+cubo)\b/g, "^3");

  s = s.replace(/\b(x)\s+elevado\s+a\s+(\d+)\b/g, "$1^$2");
  s = s.replace(/\b(x)\s+a\s+la\s+(\d+)\b/g, "$1^$2");

  // --- multiplicación implícita ---
  s = s.replace(/(\d+)\s*x\b/g, "$1x");

  // --- raíces ---
  s = s.replace(/\bra[ií]z\s+de\s+/g, "sqrt(");
  if (s.includes("sqrt(") && !s.includes(")")) s += ")";

  // --- operadores en palabras ---
  s = s
    .replace(/\b(más)\b/g, "+")
    .replace(/\b(menos)\b/g, "-")
    .replace(/\b(por)\b/g, "*")
    .replace(/\b(dividido\s+entre|entre)\b/g, "/")
    .replace(/\b(igual)\b/g, "=");

  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function replaceFuncParen(src, funcName, replacer) {
  let s = src;
  let i = 0;
  while (i < s.length) {
    const idx = s.indexOf(funcName + "(", i);
    if (idx === -1) break;

    let j = idx + funcName.length + 1;
    let depth = 1;
    while (j < s.length && depth > 0) {
      const ch = s[j];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      j++;
    }
    if (depth !== 0) {
      i = idx + funcName.length + 1;
      continue;
    }

    const inside = s.slice(idx + funcName.length + 1, j - 1);
    const before = s.slice(0, idx);
    const after = s.slice(j);

    s = before + replacer(inside) + after;
    i = before.length + 1;
  }
  return s;
}

function asciiToLatex(raw) {
  let t = normalizeInput(raw);

  t = t.replaceAll("π", "\\pi");
  t = replaceFuncParen(t, "sqrt", (inside) => `\\sqrt{${inside}}`);
  t = t.replace(/sqrt\s*([0-9a-zA-Zπ]+)/g, "\\sqrt{$1}");

  t = replaceFuncParen(t, "sin", (inside) => `\\sin\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "cos", (inside) => `\\cos\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "tan", (inside) => `\\tan\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "log", (inside) => `\\log\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "ln", (inside) => `\\ln\\left(${inside}\\right)`);

  t = t.replace(/\*/g, "\\cdot ");
  t = t.replace(/\(([^()]*)\)\/\(([^()]*)\)/g, "\\frac{$1}{$2}");
  return t;
}

function looksMath(text) {
  const s = normalizeInput(text).trim();
  if (!s) return false;

  // comandos: NO son mates
  if (/^(deberes|exámenes|examenes|trabajo)$/i.test(s)) return false;

  // Si es una frase “normal” (tiene palabras y espacios), NO la tratamos como mates
  const hasWords = /[a-zA-Záéíóúüñ]{3,}/.test(s) && /\s/.test(s);

  // Señales claras de mates
  const hasMathSignals =
    /[+\-*/^=]/.test(s) ||
    /\b(sqrt|sin|cos|tan|log|ln)\b/i.test(s) ||
    /[π√]/.test(s);

  if (hasWords && !hasMathSignals) return false;
  return hasMathSignals;
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
//  MICRO (Web Speech API)
// =========================
let rec = null;
let isRecording = false;
let manualStop = false;

let draftFinal = "";
let insertCtx = null;

function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function setMicUI(on) {
  isRecording = on;
  if (micBtn) micBtn.classList.toggle("micOn", on);
}

function ensureRec() {
  if (rec) return rec;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  rec = new SR();
  rec.lang = "es-ES";
  rec.interimResults = true;
  rec.continuous = false;

  rec.onresult = (e) => {
    let finalChunk = "";
    let interim = "";

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalChunk += txt + " ";
      else interim += txt;
    }

    if (finalChunk) draftFinal += finalChunk;

    const liveRaw = (draftFinal + interim).replace(/\s+/g, " ").trim();
    const live = normalizeDictation(liveRaw);

    if (insertCtx) {
      inp.value = insertCtx.before + live + insertCtx.after;
      const pos = (insertCtx.before + live).length;
      try { inp.setSelectionRange(pos, pos); } catch {}
    } else {
      inp.value = live;
    }

    update();
    renderPreview();
  };

  rec.onend = () => {
    if (!manualStop && isRecording) {
      try { rec.start(); } catch {}
    } else {
      setMicUI(false);
    }
  };

  rec.onerror = (ev) => {
    console.log("Speech error:", ev);
    manualStop = true;
    setMicUI(false);
  };

  return rec;
}

function startMic() {
  if (!speechSupported()) {
    alert("Safari a veces no soporta bien el dictado. Si falla, prueba Chrome.");
    return;
  }
  if (isRecording) return;

  const r = ensureRec();
  if (!r) {
    alert("Este navegador no soporta SpeechRecognition.");
    return;
  }

  manualStop = false;
  draftFinal = "";

  const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
  const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

  insertCtx = {
    before: inp.value.slice(0, start),
    after: inp.value.slice(end),
  };

  setMicUI(true);
  try { r.start(); } catch (e) {
    console.log(e);
    setMicUI(false);
  }
}

function stopMic() {
  if (!rec) {
    setMicUI(false);
    return;
  }
  manualStop = true;
  try { rec.stop(); } catch {}
  setMicUI(false);
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

micBtn && micBtn.addEventListener("click", (e) => {
  e.stopImmediatePropagation();
  if (!isRecording) startMic();
  else stopMic();
  setTimeout(() => inp.focus(), 0);
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
