// assets/app/index.js
import { DOM } from "../lib/state.js";
import { getHistory, setHistory, ensureToday } from "../lib/storage.js";
import { asciiToLatex, looksMath } from "../lib/math.js";
import { toggleMic } from "../lib/mic.js";
import { initAttach } from "../features/attach/attach.js";
import { createPreviewRenderer } from "../lib/preview.js";
import { createInputHelpers } from "../lib/input.js";
import { createTyping } from "./typing.js";
import { createChatRenderer } from "./mod.js";
import { createAttachmentUI } from "./AttachmentsUI.js";
import { setupIframeBridge } from "./IframeBridge.js";
import { setupIOSViewportFix } from "../ui/iosViewportFix.js";
import { askGPT } from "../features/chat/chatapi.js";

  MODES,
  currentMode,
  modeChosen,
  showModeQuestion,
  chooseMode,
  setPendingFirstQuestion,
} from "../features/mode/mode.js";

console.log("✅ index.js imports OK");
console.log("✅ app.js cargado");

// =========================
//  iOS: mantener el composer visible incluso con teclado abierto
// =========================
try {
  setupIOSViewportFix();
} catch (e) {
  console.warn("setupIOSViewportFix() falló (no bloquea la app):", e);
}

const {
  chat,
  messages,
  inp,
  btn,
  kbd,
  pad,
  eqPreview,
  micBtn,
  agenda,
  initialRow,
  btnDeberes,
  btnExamen,
  btnTrabajo,
} = DOM;

const scrollEl = chat; // main con scroll
const chatList = messages || chat; // donde pintamos burbujas

// =========================
//  Input multiline con autogrow
//  Enter = enviar | Shift+Enter = salto de línea
// =========================
function autoGrowInput() {
  if (!inp) return;
  try {
    inp.style.height = "auto";
    const max = 140; // debe coincidir con el max-height del CSS
    inp.style.height = Math.min(inp.scrollHeight, max) + "px";
  } catch {}
}

// =========================
//  Layout: pad mates siempre abajo (debajo del footer)
//  y el footer sube exactamente lo que mida el pad.
// =========================
function updatePadLayout() {
  try {
    const isOpen = !!(pad && pad.classList && pad.classList.contains("show"));
    const h = isOpen && pad ? Math.ceil(pad.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--ttd-pad-h", `${h}px`);
  } catch {}
}
window.__ttdUpdateLayout = updatePadLayout;
try {
  window.addEventListener("resize", () => requestAnimationFrame(updatePadLayout));
} catch {}
try {
  requestAnimationFrame(updatePadLayout);
} catch {}

// Estado adjunto actual (imagen)
let pendingImage = null;

// Placeholders de UI (se inicializan más abajo)
let showTyping = () => {};
let hideTyping = () => {};
let showAttachPreview = () => {};
let hideAttachPreview = () => {};

// =========================
//  Estado composer
// =========================
function update() {
  if (!btn || !inp) return;

  const hasText = inp.value.trim().length > 0;
  const hasImg = !!pendingImage;

  inp.disabled = false;
  inp.placeholder = modeChosen ? "Escribe aquí…" : "Escribe tu duda…";

  const canSend = hasText || hasImg;
  btn.disabled = !canSend;
  btn.classList.toggle("ready", canSend);

  try {
    window.__ttdUpdateLayout && window.__ttdUpdateLayout();
  } catch {}
}

// FIX: evitar que el input “muera”
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
update();

// =========================
//  Helpers (preview + inserción)
// =========================
const { renderPreview } = createPreviewRenderer({
  inp,
  eqPreview,
  looksMath,
  asciiToLatex,
});

const { insertAtCursor } = createInputHelpers({
  inp,
  update,
  renderPreview,
  ensureInteractive: ensureComposerInteractive,
});

// =========================
//  UI helpers (renderer): extraídos a mod.js
// =========================
const __chatUI = createChatRenderer({
  chatList,
  scrollEl,
  looksMath,
  asciiToLatex,
  getHistory,
  setHistory,
});

const add = __chatUI.add;
const addImageAttachment = __chatUI.addImageAttachment;
const renderFromHistory = __chatUI.renderFromHistory;
const rerenderPendingMath = __chatUI.rerenderPendingMath;

// Mensaje inicial (si no hay historial)
queueMicrotask(() => {
  try {
    const hist = getHistory();
    if (!Array.isArray(hist) || hist.length === 0) {
      const msg = "¿En qué te ayudo hoy? Elige una opción arriba.";
      add("assistant", msg);
      const h = getHistory();
      h.push({ role: "assistant", content: msg });
      setHistory(h);
    }
  } catch (e) {
    console.warn("No se pudo mostrar el mensaje inicial:", e);
  }
});

// =========================
//  Envío robusto (mínimo)
// =========================
async function safeSend() {
  // Si no han elegido modo, guardamos su primera pregunta y pedimos elección
  if (!modeChosen) {
    const text = (inp?.value || "").trim();
    if (text) {
      setPendingFirstQuestion(text);
      inp.value = "";
      try {
        update();
      } catch {}
      try {
        renderPreview();
      } catch {}
    }
    showModeQuestion({ add });
    return;
  }

  const text = (inp?.value || "").trim();
  const hasImg = !!pendingImage;
  if (!text && !hasImg) return;

  // Limpia el input YA (UX): no esperar a la respuesta del chat
  // (pero DESPUÉS de capturar `text`)
  try {
    inp.value = "";
    update();
    renderPreview();
  } catch {}
  try { autoGrowInput(); } catch {}
    // Si hay imagen, pinta YA una confirmación visual (texto + miniatura)
  // para que el usuario sepa que se ha enviado, aunque usemos silentUser.
  try {
    if (hasImg) {
      if (text) {
        add("user", text);
        const hU = getHistory();
        hU.push({ role: "user", content: text });
        setHistory(hU);
      }

      // Burbuja con miniatura (además deja rastro en historial)
      addImageAttachment(pendingImage.file);
  requestAnimationFrame(() => {
  try { __chatUI.scrollToBottom(); } catch {}
});

      // Quita el preview del adjunto del composer inmediatamente (sin perder pendingImage)
      try { hideAttachPreview(); } catch {}
    }
  } catch {}

  // Si hay imagen, mandamos instrucción interna para que la analice
  try {
    if (typeof sendText === "function") {
      if (hasImg) {
        const userText = text;
        const internal =
          "Analiza la imagen adjunta (puede ser texto, gráfico, esquema, foto, etc.) " +
          "y ayúdame con ello. Si hay texto escrito por el alumno, tenlo en cuenta: " +
          (userText
            ? `\n\nTexto del alumno: ${userText}`
            : "\n\nTexto del alumno: (ninguno)");
        await sendText(internal, { silentUser: true });
      } else {
        await sendText(text);
      }
      setTimeout(() => {
        try {
          inp && inp.focus();
        } catch {}
      }, 0);
      return;
    }
  } catch (err) {
    console.error("sendText() falló:", err);
  }

  // último recurso: pinta la burbuja del usuario para no perderlo
  try {
    add("user", text);
    const hist = getHistory();
    hist.push({ role: "user", content: text });
    setHistory(hist);
    inp.value = "";
    update();
    renderPreview();
  } catch (e) {
    console.error("No se pudo enviar ni pintar el mensaje:", e);
  }
}

// =========================
//  BIND UI: una sola vez, sin duplicados
// =========================
let __ttdBound = false;
function bindCoreUI() {
  if (__ttdBound) return;
  __ttdBound = true;

  try {
    window.__ttdUpdateLayout && window.__ttdUpdateLayout();
  } catch {}

  const ensure = () => {
    try {
      ensureComposerInteractive();
    } catch {}
  };

  // Enviar
  if (btn)
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      ensure();
      await safeSend();
      queueMicrotask(ensure);
      setTimeout(ensure, 0);
    });

  // Enter = enviar
  if (inp)
  inp.addEventListener("keydown", async (e) => {
    ensure();

    // Shift+Enter = nueva línea
    if (e.key === "Enter" && e.shiftKey) {
      setTimeout(() => {
        try { autoGrowInput(); } catch {}
      }, 0);
      return;
    }

    // Enter = enviar
    if (e.key === "Enter") {
      e.preventDefault();
      await safeSend();
      try { autoGrowInput(); } catch {}
      queueMicrotask(ensure);
      setTimeout(ensure, 0);
    }
  });

  // Input -> update + preview
  if (inp)
  inp.addEventListener("input", () => {
    ensure();
    try { update(); } catch {}
    try { renderPreview(); } catch {}
    try { autoGrowInput(); } catch {}
    queueMicrotask(ensure);
    setTimeout(ensure, 0);
  });

  // Click en footerRow: re-enfocar input si no pulsas botón
  const footerRow = document.querySelector(".footerRow");
  if (footerRow && inp) {
    footerRow.addEventListener(
      "pointerdown",
      (e) => {
        if (e.target && e.target.closest && e.target.closest("button")) return;
        if (e.target === inp) return;
        try {
          inp.focus({ preventScroll: true });
        } catch {
          try {
            inp.focus();
          } catch {}
        }
      },
      { capture: true }
    );
  }

  // Micrófono
if (micBtn)
  micBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      toggleMic({
        onLiveText: () => {
          try { update(); } catch {}
          try { renderPreview(); } catch {}
          try { autoGrowInput(); } catch {}
        },
      });
    } catch (err) {
      console.error(err);
    }
  });

  // Pad mates (∑)
  if (kbd)
    kbd.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        if (!pad) return;

        const willShow = !pad.classList.contains("show");

        const nearBottom = (() => {
          try {
            const threshold = 120;
            const remaining =
              scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
            return remaining < threshold;
          } catch {
            return true;
          }
        })();

        pad.classList.toggle("show");
        try {
          window.__ttdUpdateLayout && window.__ttdUpdateLayout();
        } catch {}

        if (willShow && nearBottom) {
          requestAnimationFrame(() => {
            try {
              scrollEl.scrollTop = scrollEl.scrollHeight;
            } catch {}
          });
        }

        try {
          inp && inp.focus({ preventScroll: true });
        } catch {
          try {
            inp && inp.focus();
          } catch {}
        }
      } catch (err) {
        console.error(err);
      }
    });

  // Botones del pad (#pad)
  if (pad)
    pad.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;

      e.preventDefault();
      e.stopPropagation();

      let value = b.dataset.i || "";
      if (!value) return;

      if (value === "×") value = "*";
      if (value === "÷") value = "/";
      if (value === "−") value = "-";

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
      if (typeof value === "string" && value.endsWith("()")) {
        insertAtCursor(value, -1);
        return;
      }

      insertAtCursor(value, 0);
    });

  // Agenda (Deberes / Exámenes / Trabajo)
  if (btnDeberes)
    btnDeberes.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await chooseMode(MODES.DEBERES, { add, getHistory, setHistory, sendText, inp });
    });

  if (btnExamen)
    btnExamen.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await chooseMode(MODES.EXAMEN, { add, getHistory, setHistory, sendText, inp });
    });

  if (btnTrabajo)
    btnTrabajo.addEventListener("click", async (e) => {
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
          try {
            showAttachPreview(file);
          } catch {}
          try {
            update();
          } catch {}
        } catch (err) {
          console.error(err);
        }
      },
    });
  } catch (err) {
    console.error(err);
  }
}

// =========================
//  UI módulos (typing + adjuntos + bridge iframe)
// =========================
const __typing = createTyping({ chatList, scrollEl });
showTyping = __typing.showTyping;
hideTyping = __typing.hideTyping;

const __attachUI = createAttachmentUI({
  inp,
  update,
  onClear: () => {
    pendingImage = null;
  },
});
showAttachPreview = __attachUI.showAttachPreview;
hideAttachPreview = __attachUI.hideAttachPreview;

setupIframeBridge({
  inp,
  insertAtCursor,
  update,
  renderPreview,
  safeSend,
});

bindCoreUI();

// =========================
//  Helpers adjuntos
// =========================
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
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

  if (!modeChosen && !silentUser) {
    const msg = "Primero elige una opción arriba.";
    add("assistant", msg);
    const h0 = getHistory();
    h0.push({ role: "assistant", content: msg });
    setHistory(h0);
    update();
    return;
  }

  if (!silentUser && t) {
    add("user", t);
    const h = getHistory();
    h.push({ role: "user", content: t });
    setHistory(h);
  }

  if (!silentUser && hasImg && !t) {
    try {
      addImageAttachment(pendingImage.file);
    } catch {}
  }

  try {
    btn && (btn.disabled = true);
  } catch {}
  try {
    showTyping();
  } catch {}

  try {
    const imageDataUrl = pendingImage?.dataUrl || null;

    let modelText = t;
    if (imageDataUrl && !silentUser) {
      modelText =
        "Analiza la imagen adjunta y ayúdame con ello." +
        (t ? `\n\nTexto del alumno: ${t}` : "");
    }

    const answer = await askGPT({
      text: modelText,
      imageDataUrl,
      mode: currentMode,
    });

    add("assistant", answer);

    const h2 = getHistory();
    h2.push({ role: "assistant", content: answer });
    setHistory(h2);

    pendingImage = null;
    try {
      hideAttachPreview();
    } catch {}

    if (!silentUser) inp.value = "";
  } catch (err) {
    console.error(err);

    const msg = "No he podido responder ahora mismo.";
    add("assistant", msg);
    const hE = getHistory();
    hE.push({ role: "assistant", content: msg });
    setHistory(hE);
  } finally {
    try {
      hideTyping();
    } catch {}
    try {
      update();
    } catch {}
    try {
      renderPreview();
    } catch {}
    try { autoGrowInput(); } catch {}
    try {
      rerenderPendingMath();
    } catch {}

    // No fuerces btn.disabled = false: update() decide si se puede enviar
    setTimeout(() => {
      try {
        inp && inp.focus();
      } catch {}
    }, 0);
  }
}

// =========================
//  BOOT
// =========================
(function boot() {
  try {
    renderFromHistory();
  } catch (e) {
    console.warn("renderFromHistory() falló:", e);
  }

  try {
    rerenderPendingMath();
  } catch {}

  try {
    ensureComposerInteractive();
  } catch {}
  try {
    update();
  } catch {}
  try {
    renderPreview();
  } catch {}

 requestAnimationFrame(() => {
  try {
    // No forzar al final al arrancar: respeta el historial visible
    // (si quieres arrancar arriba del todo)
    // scrollEl.scrollTop = 0;

    // O si prefieres arrancar en el final SOLO la primera vez,
    // coméntalo aquí y ya controlas el scroll con add().
  } catch {}
});

  setTimeout(() => {
    try {
      rerenderPendingMath();
    } catch {}
  }, 0);
  setTimeout(() => {
    try {
      rerenderPendingMath();
    } catch {}
  }, 300);
})();