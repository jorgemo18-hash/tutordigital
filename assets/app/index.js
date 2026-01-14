// queríamos alguna subcarpeta más...
import { DOM } from "../lib/state.js";
import { getHistory, setHistory, ensureToday } from "../lib/storage.js";
import { normalizeInput, asciiToLatex, looksMath } from "../lib/math.js";
import { toggleMic, stopMic } from "../lib/mic.js";
import { initAttach } from "../features/attach/attach.js";

console.log("✅ app.js cargado");

// =========================
//  iOS: mantener el composer visible incluso con teclado abierto
// =========================
function setupVisualViewportFooter() {
  const vv = window.visualViewport;
  const padEl = document.getElementById("pad");

  function computeKeyboardPx() {
    if (!vv) return 0;
    return Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
  }

  function updateVars() {
    const kb = computeKeyboardPx();

    const padShown = !!(padEl && padEl.classList.contains("show"));
    const padH = padShown && padEl ? (padEl.offsetHeight || 0) : 0;

    document.documentElement.style.setProperty("--kb", kb + "px");
    document.documentElement.style.setProperty("--padH", padH + "px");
  }

  if (vv) {
    vv.addEventListener("resize", updateVars);
    vv.addEventListener("scroll", updateVars);
  }
  window.addEventListener("resize", updateVars);

  // para recalcular cuando abrimos/cerramos el pad
  window.__ttdUpdateLayout = updateVars;

  updateVars();
}

setupVisualViewportFooter();

const {
  chat, inp, btn, kbd, pad, eqPreview, micBtn,
  agenda, btnDeberes, btnExamen, btnTrabajo
} = DOM;


let pendingImage = null; // { file, dataUrl }

// =========================
//  Modo (Deberes / Exámenes / Trabajo)
//  - Se resetea cada día (porque el historial se resetea)
//  - Si el alumno escribe sin modo, mostramos chips (sin frase) y esperamos selección
// =========================
const MODES = {
  DEBERES: "Deberes",
  EXAMEN: "Exámenes",
  TRABAJO: "Trabajo",
};

let currentMode = "";              // "Deberes" | "Exámenes" | "Trabajo" | ""
let pendingFirstQuestion = "";     // última pregunta escrita si aún no hay modo
let waitingForMode = false;         // estamos esperando que el alumno diga el modo

function isModeText(s) {
  const t = String(s || "").trim().toLowerCase();
  return t === "deberes" || t === "exámenes" || t === "examenes" || t === "trabajo";
}

function normalizeModeFromText(s) {
  const t = String(s || "").trim().toLowerCase();
  if (t === "deberes") return MODES.DEBERES;
  if (t === "trabajo") return MODES.TRABAJO;
  // examen / exámenes
  if (t === "exámenes" || t === "examenes") return MODES.EXAMEN;
  return "";
}



function showModeQuestion() {
  // No mostramos chips. Solo una pregunta en burbuja.
  if (waitingForMode) return;
  waitingForMode = true;
  add("assistant", "Antes de empezar: ¿estás con deberes, repasar examen o preparar trabajo? (Responde: Deberes / Exámenes / Trabajo)");
}

async function chooseMode(mode) {
  const m = String(mode || "").trim();
  if (!m) return;

  currentMode = m;
  waitingForMode = false;

  // Si había una pregunta pendiente, la enviamos ahora sin duplicar burbuja
  if (pendingFirstQuestion) {
    const q = pendingFirstQuestion;
    pendingFirstQuestion = "";
    await sendText(q, { silentUser: true });
  } else {
    // Si no hay pregunta, solo enfoca input
    setTimeout(() => inp && inp.focus(), 0);
  }
}

let attachPreviewEl = null;
let attachPreviewImg = null;
let attachPreviewName = null;

function ensureAttachPreviewUI() {
  if (attachPreviewEl) return;

  // CONTENEDOR
  attachPreviewEl = document.createElement("div");
  attachPreviewEl.id = "attachPreview";
  attachPreviewEl.style.display = "none";
  attachPreviewEl.style.alignItems = "center";
  attachPreviewEl.style.gap = "10px";
  attachPreviewEl.style.padding = "8px 10px";
  attachPreviewEl.style.borderRadius = "12px";
  attachPreviewEl.style.border = "1px solid rgba(0,0,0,.08)";
  attachPreviewEl.style.background = "rgba(255,255,255,.75)";

  // Layout tipo ChatGPT (fila arriba, izquierda)
  attachPreviewEl.style.order = -1;
  attachPreviewEl.style.flexBasis = "100%";
  attachPreviewEl.style.width = "100%";
  attachPreviewEl.style.justifyContent = "flex-start";
  attachPreviewEl.style.marginBottom = "8px";

  // MINIATURA
  attachPreviewImg = document.createElement("img");
  attachPreviewImg.style.width = "44px";
  attachPreviewImg.style.height = "44px";
  attachPreviewImg.style.objectFit = "cover";
  attachPreviewImg.style.borderRadius = "10px";
  attachPreviewImg.style.border = "1px solid rgba(0,0,0,.08)";

  // NOMBRE
  attachPreviewName = document.createElement("div");
  attachPreviewName.style.fontSize = "13px";
  attachPreviewName.style.opacity = "0.85";
  attachPreviewName.style.flex = "1";
  attachPreviewName.style.overflow = "hidden";
  attachPreviewName.style.whiteSpace = "nowrap";
  attachPreviewName.style.textOverflow = "ellipsis";
  attachPreviewName.style.maxWidth = "220px"; // ✅ paso 3 aquí

  // BOTÓN X
  const btnX = document.createElement("button");
  btnX.type = "button";
  btnX.textContent = "✕";
  btnX.style.width = "34px";
  btnX.style.height = "34px";
  btnX.style.borderRadius = "10px";
  btnX.style.border = "1px solid rgba(0,0,0,.10)";
  btnX.style.background = "white";
  btnX.style.cursor = "pointer";
  btnX.addEventListener("click", () => {
    pendingImage = null;
    hideAttachPreview();
    update();
  });

  attachPreviewEl.appendChild(attachPreviewImg);
  attachPreviewEl.appendChild(attachPreviewName);
  attachPreviewEl.appendChild(btnX);

  // Lo metemos arriba dentro del composer (tu HTML ya tiene .footerRow)
  const footerRow = document.querySelector(".footerRow");
  if (footerRow) footerRow.prepend(attachPreviewEl);
}

function showAttachPreview(file) {
  ensureAttachPreviewUI();
  if (!attachPreviewEl) return;

  const url = URL.createObjectURL(file);
  attachPreviewImg.src = url;
  attachPreviewImg.onload = () => URL.revokeObjectURL(url);

  attachPreviewName.textContent = file?.name || "Imagen";
  attachPreviewEl.style.display = "flex";
    // iOS: al adjuntar, cierra teclado para no tapar barras
  try { inp && inp.blur && inp.blur(); } catch {}
  if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
}

function hideAttachPreview() {
  if (!attachPreviewEl) return;
  attachPreviewEl.style.display = "none";
  if (attachPreviewImg) attachPreviewImg.src = "";
  if (attachPreviewName) attachPreviewName.textContent = "";
    if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
}

function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file); // -> "data:image/...;base64,AAAA"
  });
}

// ========= helpers =========
function update() {
  if (!btn || !inp) return;
  const hasText = inp.value.trim().length > 0;
  const hasImg = !!pendingImage;
  btn.disabled = !(hasText || hasImg);
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
function addImageAttachment(file) {
  const row = document.createElement("div");
  row.className = "row u";

  const bub = document.createElement("div");
  bub.className = "bubble";

  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.alignItems = "center";
  wrap.style.gap = "10px";

  const img = document.createElement("img");
  img.style.width = "56px";
  img.style.height = "56px";
  img.style.objectFit = "cover";
  img.style.borderRadius = "12px";
  img.style.border = "1px solid rgba(0,0,0,.12)";

  const meta = document.createElement("div");
  meta.style.display = "flex";
  meta.style.flexDirection = "column";
  meta.style.gap = "2px";

  const title = document.createElement("div");
  title.textContent = file.name;
  title.style.fontSize = "13px";
  title.style.fontWeight = "600";

  const subtitle = document.createElement("div");
  subtitle.textContent = "Imagen adjunta";
  subtitle.style.fontSize = "12px";
  subtitle.style.opacity = "0.7";

  meta.appendChild(title);
  meta.appendChild(subtitle);

  wrap.appendChild(img);
  wrap.appendChild(meta);

  const url = URL.createObjectURL(file);
  img.src = url;
  img.onload = () => {
    URL.revokeObjectURL(url);
    requestAnimationFrame(() => (chat.scrollTop = chat.scrollHeight));
  };

  bub.appendChild(wrap);
  row.appendChild(bub);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;

  const hist = getHistory();
  hist.push({ role: "user", content: `📎 Imagen adjunta: ${file.name}` });
  setHistory(hist);
}
function renderFromHistory() {

  chat.innerHTML = "";
  if (agenda) chat.appendChild(agenda);

  const hist = getHistory(); // ✅ esto se queda
  if (hist.length === 0) {
    // Sin historial: mostramos pregunta de modo y no llamamos al backend
    showModeQuestion();
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
async function askGPT({ text, imageDataUrl } = {}) {
  const hist = getHistory();
  const messages = hist.map((m) => ({ role: m.role, content: m.content }));

  // Mandamos además el input actual (texto) y opcionalmente imagen
  const payload = { messages, text: text || "", mode: currentMode || "" };
  if (imageDataUrl) payload.image = imageDataUrl;

  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.error || "API error");
  return data?.text ? data.text : "No he podido responder ahora mismo.";
}

async function sendText(text, opts = {}) {
  ensureToday();

  const t = String(text || "").trim();
  const hasImg = !!pendingImage;
  if (!t && !hasImg) return;

  const silentUser = !!opts.silentUser;

  // 1) Si el usuario escribe un modo explícito (deberes/exámenes/trabajo), lo capturamos
  //    y NO llamamos al backend (modo = UI state).
  if (!silentUser && t && isModeText(t)) {
    pendingFirstQuestion = "";
    await chooseMode(normalizeModeFromText(t));
    return;
  }

  // 2) Si aún no hay modo y llega una pregunta normal: guardamos la pregunta,
  //    la mostramos como mensaje del usuario y sacamos pregunta de modo. No llamamos al backend.
  if (!currentMode && !silentUser && t) {
    add("user", t);
    const hist = getHistory();
    hist.push({ role: "user", content: t });
    setHistory(hist);

    pendingFirstQuestion = t;
    showModeQuestion();

    // dejamos el botón usable por si adjunta/edita
    if (btn) btn.disabled = false;
    setTimeout(() => inp && inp.focus(), 0);
    return;
  }

  // Flujo normal (ya hay modo, o silentUser, o solo imagen)
  if (!silentUser && t) {
    add("user", t);
    const hist = getHistory();
    hist.push({ role: "user", content: t });
    setHistory(hist);
  }

  if (btn) btn.disabled = true;

  try {
    const imageDataUrl = pendingImage?.dataUrl || null;
    const answer = await askGPT({ text: t, imageDataUrl });

    add("assistant", answer);

    const hist2 = getHistory();
    hist2.push({ role: "assistant", content: answer });
    setHistory(hist2);

    pendingImage = null;
    hideAttachPreview();
    update();
  } catch (e) {
    console.error(e);
    add("assistant", "Ahora mismo no puedo conectar con el tutor. Prueba otra vez.");
    update();
  } finally {
    renderPreview();
    setTimeout(() => inp && inp.focus(), 0);
  }
}
function send() {
  const text = inp.value.trim();
  const hasImg = !!pendingImage;

  if (!text && !hasImg) return;

  // si hay imagen, la añadimos al chat ahora (al enviar)
  if (hasImg) {
    addImageAttachment(pendingImage.file);
    // ✅ Oculta la preview del composer EN CUANTO se pulsa Enviar
    // (mantenemos pendingImage para poder mandarla al backend)
    hideAttachPreview();
  }

  inp.value = "";
  stopMic();
 

  update();
  renderPreview();

  // solo imagen -> mandamos instrucción interna (NO visible)
  if (!text && hasImg) {
    sendText("Analiza la imagen adjunta y ayúdame con ello.", { silentUser: true });
  } else {
    sendText(text);
  }

  setTimeout(() => inp && inp.focus(), 0);
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

// Agenda (los 3 de arriba). Solo cambian modo y opcionalmente te meten una frase corta.
btnDeberes && btnDeberes.addEventListener("click", () => {
  currentMode = MODES.DEBERES;
  // Si quieres, puedes autollenar algo aquí, pero por ahora solo foco.
  setTimeout(() => inp && inp.focus(), 0);
});

btnExamen && btnExamen.addEventListener("click", () => {
  currentMode = MODES.EXAMEN;
  setTimeout(() => inp && inp.focus(), 0);
});

btnTrabajo && btnTrabajo.addEventListener("click", () => {
  currentMode = MODES.TRABAJO;
  setTimeout(() => inp && inp.focus(), 0);
});

// Input
inp && inp.addEventListener("input", () => {
  update();
  renderPreview();
});

inp && inp.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    send();
  }
});

// Enviar
btn && btn.addEventListener("click", () => send());

// Mic (dictado)
micBtn && micBtn.addEventListener("click", () => {
  toggleMic({
    onLiveText: () => {
      update();
      renderPreview();
    },
  });
});

// Teclado científico: en escritorio lo maneja el PADRE (index.html) -> enviamos postMessage.
// En móvil (app.html directo) usamos el pad interno.
kbd && kbd.addEventListener("click", () => {
  const inIframe = window.self !== window.top;
  if (inIframe) {
    try {
      window.parent && window.parent.postMessage({ type: "togglePad" }, "*");
    } catch {}
    return;
  }

  // Standalone: toggle pad interno
  if (!pad) return;
  pad.classList.toggle("show");
  if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
});

// Click en botones del pad interno
pad && pad.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (!b) return;
  const value = b.dataset.i;
  handleInsert(value);
});

// Attach (+) y picker
initAttach({
  onFile: async (file) => {
    try {
      const dataUrl = await fileToDataURL(file);
      pendingImage = { file, dataUrl };
      showAttachPreview(file);
      update();
    } catch (err) {
      console.error(err);
    }
  },
});

// Mensajes desde el PADRE (miniBar / teclado externo)
window.addEventListener("message", (event) => {
  const data = event.data;
  if (!data) return;

  if (data === "focusInput") {
    setTimeout(() => inp && inp.focus(), 0);
    return;
  }

  if (data.type === "sendText") {
    const t = String(data.text || "").trim();
    if (t) sendText(t);
    return;
  }

  if (data.type === "insert") {
    handleInsert(String(data.value || ""));
    return;
  }

  if (data.type === "moveCursor") {
    const off = Number(data.offset || 0);
    if (!inp || !Number.isFinite(off)) return;
    const pos = (typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length) + off;
    const clamped = Math.max(0, Math.min(inp.value.length, pos));
    try { inp.setSelectionRange(clamped, clamped); } catch {}
    inp.focus();
    return;
  }
});

// Init
ensureToday();
renderFromHistory();
update();
renderPreview();

// Si KaTeX carga después, re-render de lo que se quedó como raw
setTimeout(() => {
  try { rerenderPendingMath(); } catch {}
}, 350);