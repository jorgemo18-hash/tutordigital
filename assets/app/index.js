// queríamos alguna subcarpeta más...
import { DOM } from "../lib/state.js";
import { getHistory, setHistory, ensureToday } from "../lib/storage.js";
import { normalizeInput, asciiToLatex, looksMath } from "../lib/math.js";
import { toggleMic, stopMic } from "../lib/mic.js";
import { initAttach } from "../features/attach/attach.js";

console.log("✅ app.js cargado");
// Mensaje inicial (lo lanzamos al final del tick para asegurar que `add()` ya existe)
queueMicrotask(() => {
  try {
    if (typeof add === "function") {
      add("assistant", "¿En qué te ayudo hoy? Elige una opción arriba.");
    }
  } catch (e) {
    console.warn("No se pudo mostrar el mensaje inicial:", e);
  }
});

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
  agenda, initialRow, btnDeberes, btnExamen, btnTrabajo
} = DOM;

// =========================
//  FIX: evitar que el input “muera” (disabled/readonly/pointer-events) tras el primer caracter
//  A veces update()/otros flujos lo dejan bloqueado. Esto lo revierte siempre.
// =========================
function ensureComposerInteractive() {
  if (!inp) return;
  try {
    inp.disabled = false;
    inp.readOnly = false;
    inp.style.pointerEvents = "auto";
    inp.style.userSelect = "text";
    inp.tabIndex = 0;
  } catch {}
}

// aplica ya al cargar
ensureComposerInteractive();

// =========================
//  Inserción en el input (teclado científico interno)
// =========================
function insertAtCursor(value, cursorOffset = 0) {
  if (!inp) return;

  const v = String(value ?? "");
  const start = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
  const end = typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

  const before = inp.value.slice(0, start);
  const after = inp.value.slice(end);
  inp.value = before + v + after;

  const pos = Math.max(0, Math.min((before + v).length + cursorOffset, inp.value.length));
  try { inp.setSelectionRange(pos, pos); } catch {}

  try { inp.focus(); } catch {}
  try { update(); } catch {}
  try { renderPreview(); } catch {}
  // refuerzo: si algún flujo lo bloquea, lo reactivamos
  queueMicrotask(ensureComposerInteractive);
  setTimeout(ensureComposerInteractive, 0);
}

// Quita la franja inicial “¿Qué estás haciendo?...” si existe
try {
  if (initialRow && typeof initialRow.remove === "function") initialRow.remove();
} catch {}

// =========================
//  Envío robusto (evita que Enter/Enviar se queden “muertos”)
// =========================
async function safeSend() {
  // Si aún no han elegido opción arriba, pedimos selección y guardamos la primera pregunta
  if (!modeChosen) {
    const text = (inp?.value || "").trim();
    if (text) {
      pendingFirstQuestion = text;
      inp.value = "";
      try { update(); } catch {}
      try { renderPreview(); } catch {}
    }
    showModeQuestion();
    return;
  }
  // 1) si existe send(), úsalo
  try {
    if (typeof send === "function") {
      await send();
      return;
    }
  } catch (err) {
    console.warn("send() falló, usando fallback:", err);
  }

  // 2) fallback: usa sendText() si está disponible
  const text = (inp?.value || "").trim();
  const hasImg = !!pendingImage;

  if (!text && !hasImg) return;

  // solo imagen -> mandamos instrucción interna (NO visible)
  // Si hay imagen, SIEMPRE añadimos una instrucción interna para que el modelo la analice
  // (da igual si el alumno escribió texto, solo imagen, o ambos).
  try {
    if (typeof sendText === "function") {
      if (hasImg) {
        const userText = (text || "").trim();
        const internal =
          "Analiza la imagen adjunta (puede ser texto, gráfico, esquema, foto, etc.) " +
          "y ayúdame con ello. Si hay texto escrito por el alumno, tenlo en cuenta: " +
          (userText ? `\n\nTexto del alumno: ${userText}` : "\n\nTexto del alumno: (ninguno)");
        sendText(internal, { silentUser: true });
      } else {
        sendText(text);
      }
      setTimeout(() => inp && inp.focus(), 0);
      return;
    }
  } catch (err) {
    console.error("fallback sendText() falló:", err);
  }

  // 3) último recurso: al menos pinta la burbuja del usuario para no “perder” el mensaje
  try {
    if (text) {
      add("user", text);
      const hist = getHistory();
      hist.push({ role: "user", content: text });
      setHistory(hist);
      inp.value = "";
      update();
      renderPreview();
    }
  } catch (e) {
    console.error("No se pudo enviar ni pintar el mensaje:", e);
  }
}

// =========================
//  BIND UI (anti-regresiones): asegura que los botones siempre responden
// =========================
let __ttdBound = false;
function bindCoreUI() {
  if (__ttdBound) return;
  __ttdBound = true;

  // Enviar
  if (btn) btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    ensureComposerInteractive();
    await safeSend();
    queueMicrotask(ensureComposerInteractive);
    setTimeout(ensureComposerInteractive, 0);
  });

  // Enter = enviar (sin saltos de línea raros)
  if (inp) inp.addEventListener("keydown", async (e) => {
    ensureComposerInteractive();
    if (e.key === "Enter") {
      e.preventDefault();
      await safeSend();
      queueMicrotask(ensureComposerInteractive);
      setTimeout(ensureComposerInteractive, 0);
    }
  });

  // Input: habilita botón + preview KaTeX
  if (inp) inp.addEventListener("input", () => {
    ensureComposerInteractive();
    try { update(); } catch {}
    try { renderPreview(); } catch {}
    queueMicrotask(ensureComposerInteractive);
    setTimeout(ensureComposerInteractive, 0);
  });

  // Si por cualquier razón el input pierde el foco y el navegador se pone tonto,
// forzamos recuperación de foco. Esto evita el “muere tras la primera letra”.
const footerRow = document.querySelector(".footerRow");

if (inp) {
  // Guard: nunca dejar el input deshabilitado/readonly por accidente
  try {
    inp.disabled = false;
    inp.readOnly = false;
    inp.style.pointerEvents = "auto";
  } catch {}

  // Si el input pierde foco, lo recuperamos (sin molestar al selector de archivos)
  inp.addEventListener("blur", () => {
    const ae = document.activeElement;
    if (ae && ae.id === "filePick") return;

    setTimeout(() => {
      try {
        const active = document.activeElement;
        if (active && active.closest && active.closest(".footerRow") && active !== inp) return;
        ensureComposerInteractive();
        inp.focus();
      } catch {}
    }, 0);
  });
}

// Click/tap dentro del composer -> enfoca input (salvo que pulses botones)
if (footerRow && inp) {
  const refocus = (e) => {
    if (e.target && e.target.closest && e.target.closest("button")) return;
    if (e.target === inp) return;
    try { inp.focus(); } catch {}
  };

  footerRow.addEventListener("pointerdown", refocus, { capture: true });
  footerRow.addEventListener("mousedown", refocus, { capture: true });
  footerRow.addEventListener("touchstart", refocus, { capture: true, passive: true });
}

// Último recurso: click en cualquier parte de la app (excepto botones/inputs/pad) -> re-enfoca
if (inp) {
  const globalRefocus = (e) => {
    const t = e.target;
    if (!t) return;
    if (t === inp) return;
    if (t.closest && (t.closest("button") || t.closest("input") || t.closest("textarea") || t.closest("select"))) return;
    if (t.closest && t.closest("#pad")) return;

    setTimeout(() => {
      try { inp.focus(); } catch {}
    }, 0);
  };

  document.addEventListener("pointerdown", globalRefocus, { capture: true });
  document.addEventListener("mousedown", globalRefocus, { capture: true });
}

  // Micrófono
  if (micBtn) micBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      toggleMic({
        onLiveText: () => {
          try { update(); } catch {}
          try { renderPreview(); } catch {}
        }
      });
    } catch (err) {
      console.error(err);
    }
  });

  // Teclado científico interno
  if (kbd) kbd.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (pad) pad.classList.toggle("show");
      if (window.__ttdUpdateLayout) window.__ttdUpdateLayout();
    } catch (err) {
      console.error(err);
    }
  });

  // Botones del teclado científico interno (#pad)
  if (pad) pad.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;

    e.preventDefault();
    e.stopPropagation();

    let value = b.dataset.i || "";
    if (!value) return;

    // Normaliza operadores “bonitos” por si alguno llega así
    if (value === "×") value = "*";
    if (value === "÷") value = "/";
    if (value === "−") value = "-";

    // Plantillas con cursor dentro
    if (value === "()") {
      insertAtCursor("()", -1);
      return;
    }
    if (value === "^{}") {
      insertAtCursor("^{}", -1);
      return;
    }
    if (value === "√()" || value === "√") {
      insertAtCursor("sqrt()", -1);
      return;
    }

    // Funciones tipo sin()/cos()/tan()/log()/ln() -> cursor dentro
    if (typeof value === "string" && value.endsWith("()")) {
      insertAtCursor(value, -1);
      return;
    }

    // Inserción normal
    insertAtCursor(value, 0);
  });

  // Agenda (Deberes / Exámenes / Trabajo)
  if (btnDeberes) btnDeberes.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await chooseMode(MODES.DEBERES);
  });

  if (btnExamen) btnExamen.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await chooseMode(MODES.EXAMEN);
  });

  if (btnTrabajo) btnTrabajo.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await chooseMode(MODES.TRABAJO);
  });

  // Adjuntos (+)
  try {
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
      }
    });
  } catch (err) {
    console.error(err);
  }
}

bindCoreUI();


// =========================
//  Puente con el PADRE (index.html) via postMessage
// =========================
window.addEventListener("message", async (event) => {
  const data = event.data;
  if (!data) return;

  // 1) foco en input
  if (data === "focusInput" || data?.type === "focusInput") {
    try { inp && inp.focus(); } catch {}
    return;
  }

  // 2) fullscreen: quita márgenes del shell (usa CSS ya definido en app.html)
  if (data?.type === "setFullscreen") {
    const on = !!data.on;
    try {
      document.body.classList.toggle("fullscreenApp", on);
    } catch {}
    return;
  }

  // 3) inserciones desde teclado externo
  if (data?.type === "insert") {
    try {
      insertAtCursor(String(data.value ?? ""), 0);
    } catch (e) {
      console.error(e);
    }
    return;
  }

  if (data?.type === "moveCursor") {
    const off = Number(data.offset || 0);
    try {
      const pos = (typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length) + off;
      const p = Math.max(0, Math.min(pos, inp.value.length));
      inp.setSelectionRange(p, p);
      inp.focus();
      update();
      renderPreview();
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // 4) miniBar: enviar texto directo
  if (data?.type === "sendText") {
    try {
      const t = String(data.text ?? "").trim();
      if (!t) return;
      inp.value = t;
      update();
      renderPreview();
      await safeSend();
    } catch (e) {
      console.error(e);
    }
    return;
  }
});


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
let modeChosen = false; // ⛔️ hasta que no elijan arriba, no se puede escribir
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
  add("assistant", "¿Es para deberes, examen o trabajo?");
}

async function chooseMode(mode) {
  const m = String(mode || "").trim();
  if (!m) return;

  currentMode = m;
  modeChosen = true;
  try { announceMode(m); } catch {}
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

function announceMode(mode) {
  const m = String(mode || "").trim();
  if (!m) return;

  // Mensaje de confirmación (sin decir "modo")
  let msg = "";
  if (m === MODES.DEBERES) {
    msg = "Vale, te ayudo con los deberes. ¿Por dónde empezamos: Matemáticas, Lengua, Tecnología u otra?";
  } else if (m === MODES.EXAMEN) {
    msg = "Vale, preparamos el examen. ¿De qué asignatura es y qué tema entra?";
  } else if (m === MODES.TRABAJO) {
    msg = "Vale, vamos con el trabajo. ¿De qué asignatura es y qué te piden exactamente?";
  } else {
    msg = "Vale. ¿Qué necesitas hacer exactamente?";
  }

  add("assistant", msg);
  const hist = getHistory();
  hist.push({ role: "assistant", content: msg });
  setHistory(hist);
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

function update() {
  if (!btn || !inp) return;

  // 🔒 Si no se ha elegido modo arriba, todo bloqueado
  if (!modeChosen) {
    inp.disabled = true;
    btn.disabled = true;
    inp.placeholder = "Primero elige una opción arriba";
    return;
  }

  // 🔓 Modo elegido → comportamiento normal
  inp.disabled = false;
  inp.placeholder = "Escribe aquí…";

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
let __ttdTypingRow = null;

function showTyping(){
  if(__ttdTypingRow) return;
  __ttdTypingRow = document.createElement("div");
  __ttdTypingRow.className = "row a";
  const bub = document.createElement("div");
  bub.className = "bubble";
  bub.innerHTML = '<div class="typingDots"><span></span><span></span><span></span></div>';
  __ttdTypingRow.appendChild(bub);
  chat.appendChild(__ttdTypingRow);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping(){
  if(!__ttdTypingRow) return;
  __ttdTypingRow.remove();
  __ttdTypingRow = null;
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
    // Sin historial: NO mostramos frase inicial. Solo dejamos la agenda.
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

  // Si no se ha elegido arriba, no enviamos (el input ya está bloqueado, pero lo reforzamos)
  if (!modeChosen && !silentUser) {
    add("assistant", "Primero elige una opción arriba.");
    const hist0 = getHistory();
    hist0.push({ role: "assistant", content: "Primero elige una opción arriba." });
    setHistory(hist0);
    update();
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
  showTyping();

  try {
    const imageDataUrl = pendingImage?.dataUrl || null;

    // ✅ Si hay imagen, forzamos instrucción interna SIEMPRE (sin cambiar lo que ve el usuario).
    // Si silentUser=true, asumimos que el texto ya es interno y NO lo envolvemos otra vez.
    let modelText = t;
    if (imageDataUrl && !silentUser) {
      modelText =
        "Analiza la imagen adjunta (puede ser texto, gráfico, esquema, foto, etc.) y ayúdame con ello." +
        (t ? `\n\nTexto del alumno: ${t}` : "\n\nTexto del alumno: (ninguno)");
    }

    const answer = await askGPT({ text: modelText, imageDataUrl });

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
    hideTyping();
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

  // ✅ Siempre enviamos por sendText. Si hay imagen, sendText añade la instrucción interna.
  sendText(text);

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


  // Safety net: si algún flujo externo vuelve a bloquear el input, lo reactivamos
  setInterval(ensureComposerInteractive, 500);