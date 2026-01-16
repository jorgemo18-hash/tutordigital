// queríamos alguna subcarpeta más...
import { DOM } from "../lib/state.js";
import { getHistory, setHistory, ensureToday } from "../lib/storage.js";
import { asciiToLatex, looksMath } from "../lib/math.js";
import { toggleMic } from "../lib/mic.js";
import { initAttach } from "../features/attach/attach.js";
import { createPreviewRenderer } from "../lib/preview.js";
import { createInputHelpers } from "../lib/input.js";
import { createTyping } from "./typing.js";
import { createAttachmentUI } from "./attachments-ui.js";
import { setupIframeBridge } from "./iframe-bridge.js";
import { setupIOSViewportFix } from "../ui/iosViewportFix.js";
import { askGPT } from "../features/chat/chatapi.js";
import { MODES, currentMode, modeChosen, showModeQuestion, chooseMode, setPendingFirstQuestion } from "../features/mode/mode.js";


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
setupIOSViewportFix();


const { chat, messages, inp, btn, kbd, pad, eqPreview, micBtn,
  agenda, initialRow, btnDeberes, btnExamen, btnTrabajo
} = DOM;

const scrollEl = chat;          // main con scroll
const chatList = messages || chat; // donde pintamos burbujas
// Estado adjunto actual (imagen)
let pendingImage = null;
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
// Placeholders de UI (se inicializan una sola vez más abajo)
let showTypingFn = () => {};
let hideTypingFn = () => {};
let showAttachPreviewFn = () => {};
let hideAttachPreviewFn = () => {};

// =========================
//  FIX: evitar que el input “muera” (disabled/readonly/pointer-events) tras el primer caracter
//  A veces update()/otros flujos lo dejan bloqueado. Esto lo revierte siempre.
// =========================
function ensureComposerInteractive() {
  if (!inp) return;
  try {
    // Si aún no hay modo elegido, respetamos el bloqueo (lo gestiona update())
    if (!modeChosen) return;

    inp.disabled = false;
    inp.readOnly = false;
    inp.style.pointerEvents = "auto";
    inp.style.userSelect = "text";
    inp.tabIndex = 0;
  } catch {}
}

// aplica ya al cargar
ensureComposerInteractive();
update();
// =========================
//  Helpers (preview + inserción)
// =========================
const { renderPreview } = createPreviewRenderer({ inp, eqPreview, looksMath, asciiToLatex });

const { insertAtCursor, insertWithCursor } = createInputHelpers({
  inp,
  update,
  renderPreview,
  ensureInteractive: ensureComposerInteractive,
});


// =========================
//  Envío robusto (evita que Enter/Enviar se queden “muertos”)
// =========================
async function safeSend() {
  // Si aún no han elegido opción arriba, pedimos selección y guardamos la primera pregunta
  if (!modeChosen) {
    const text = (inp?.value || "").trim();
    if (text) {
      setPendingFirstQuestion(text);
      inp.value = "";
      try { update(); } catch {}
      try { renderPreview(); } catch {}
    }
    showModeQuestion({ add });
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
    await chooseMode(MODES.DEBERES, { add, getHistory, setHistory, sendText, inp });
  });

  if (btnExamen) btnExamen.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
   await chooseMode(MODES.EXAMEN, { add, getHistory, setHistory, sendText, inp });
  });

  if (btnTrabajo) btnTrabajo.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await chooseMode(MODES.TRABAJO, { add, getHistory, setHistory, sendText, inp });
  });

  // Adjuntos (+)
  try {
    initAttach({
      onFile: async (file) => {
        try {
          const dataUrl = await fileToDataURL(file);
          pendingImage = { file, dataUrl };
          showAttachPreviewFn(file);
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

// =========================
//  UI módulos (typing + adjuntos + bridge iframe)
//  IMPORTANTE: se inicializa UNA SOLA VEZ (no dentro de sendText)
// =========================
({ showTyping: showTypingFn, hideTyping: hideTypingFn } = createTyping({ chatList, scrollEl }));

({ showAttachPreview: showAttachPreviewFn, hideAttachPreview: hideAttachPreviewFn } = createAttachmentUI({
  inp,
  update,
  onClear: () => { pendingImage = null; },
}));

setupIframeBridge({
  inp,
  insertAtCursor,
  update,
  renderPreview,
  safeSend,
});

bindCoreUI();


function fileToDataURL(file){
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file); // -> "data:image/...;base64,AAAA"
  });
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
  chatList.appendChild(row);
  scrollEl.scrollTop = scrollEl.scrollHeight;
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
    requestAnimationFrame(() => (scrollEl.scrollTop = scrollEl.scrollHeight));
  };

  bub.appendChild(wrap);
  row.appendChild(bub);

  // ✅ SIEMPRE dentro de #messages (chatList)
  chatList.appendChild(row);
  scrollEl.scrollTop = scrollEl.scrollHeight;

  const hist = getHistory();
  hist.push({ role: "user", content: `📎 Imagen adjunta: ${file.name}` });
  setHistory(hist);
}
// IMPORTANTE: NO mover #agenda en renders. Si hacemos appendChild(agenda) la movemos al final
// y deja de verse al volver arriba. La agenda vive fija en app.html por encima de #messages.
function renderFromHistory() {
  chatList.innerHTML = "";

  const hist = getHistory();
  if (hist.length === 0) {
    // Sin historial: NO mostramos frase inicial. Solo dejamos la agenda (que ya está fija).
    return;
  }

  for (const m of hist) {
    add(m.role === "assistant" ? "assistant" : "user", m.content);
  }
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

  // Flujo normal (ya hay modo, o silentUser)
  if (!silentUser && t) {
    add("user", t);
    const hist = getHistory();
    hist.push({ role: "user", content: t });
    setHistory(hist);
  }

  // Si hay imagen y el usuario NO escribió texto (o silentUser), pintamos una burbuja visible de adjunto
  // (opcional, pero ayuda a no “perder” el adjunto en el chat)
  if (!silentUser && hasImg && !t) {
    try {
      addImageAttachment(pendingImage.file);
    } catch {}
  }

  if (btn) btn.disabled = true;
  showTypingFn();

  try {
    const imageDataUrl = pendingImage?.dataUrl || null;

    // ✅ Si hay imagen, forzamos instrucción interna SIEMPRE (sin cambiar lo que ve el usuario).
    // Si silentUser=true, asumimos que el texto ya es interno y NO lo envolvemos otra vez.
    let modelText = t;
    if (imageDataUrl && !silentUser) {
      const userText = (t || "").trim();
      modelText =
        "Analiza la imagen adjunta (puede ser texto, gráfico, esquema, foto, etc.) " +
        "y ayúdame con ello. Si hay texto escrito por el alumno, tenlo en cuenta: " +
        (userText ? `\n\nTexto del alumno: ${userText}` : "\n\nTexto del alumno: (ninguno)");
    }

    const answer = await askGPT({
      text: modelText,
      imageDataUrl,
      mode: currentMode,
    });

    add("assistant", answer);

    const hist2 = getHistory();
    hist2.push({ role: "assistant", content: answer });
    setHistory(hist2);

    // Reset estado de adjunto
    if (pendingImage) {
      pendingImage = null;
      try { hideAttachPreviewFn(); } catch {}
    }

    // Limpieza input
    if (!silentUser) {
      inp.value = "";
    }

    try { update(); } catch {}
    try { renderPreview(); } catch {}
    try { rerenderPendingMath(); } catch {}

  } catch (err) {
    console.error(err);
    const msg = "No he podido responder ahora mismo.";
    add("assistant", msg);
    const histE = getHistory();
    histE.push({ role: "assistant", content: msg });
    setHistory(histE);
  } finally {
    try { hideTypingFn(); } catch {}
    try { update(); } catch {}
    setTimeout(() => {
      try { inp && inp.focus(); } catch {}
    }, 0);
  }
}