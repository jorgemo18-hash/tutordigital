// assets/mic.js
import { DOM, STATE } from "./state.js";

const { inp, micBtn } = DOM;
const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const SAFETY_TIMEOUT_MS = 20000;
let safetyTimerId = 0;

function speechSupported() {
  return !!SpeechCtor;
}

function emitMicError(code, message) {
  try {
    window.dispatchEvent(new CustomEvent("ttd:mic-error", { detail: { code, message } }));
  } catch {}
}

function setMicUI(on) {
  if (micBtn) micBtn.classList.toggle("micOn", on);
}

function clearSafetyTimer() {
  if (!safetyTimerId) return;
  try { clearTimeout(safetyTimerId); } catch {}
  safetyTimerId = 0;
}

function armSafetyTimer() {
  clearSafetyTimer();
  safetyTimerId = setTimeout(() => {
    if (!STATE.isRecording) return;
    STATE.manualStop = true;
    STATE.isRecording = false;
    try { STATE.rec && STATE.rec.stop && STATE.rec.stop(); } catch {}
    setMicUI(false);
    emitMicError("timeout", "El dictado se ha quedado colgado. Prueba otra vez.");
  }, SAFETY_TIMEOUT_MS);
}

function ensureRec({ onLiveText } = {}) {
  if (STATE.rec) return STATE.rec;

  if (!SpeechCtor) return null;

  const rec = new SpeechCtor();
  rec.lang = "es-ES";
  rec.interimResults = true;
  rec.continuous = false; // Safari: mejor así y reiniciar en onend
  STATE.rec = rec;

  rec.onresult = (e) => {
    armSafetyTimer();
    // 🔒 El dictado SIEMPRE es texto plano
    STATE.fromDictation = true;
    // Si nos han parado manualmente, ignora resultados tardíos
    if (!STATE.isRecording || STATE.manualStop) return;

    let finalChunk = "";
    let interim = "";

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalChunk += txt + " ";
      else interim += txt;
    }

    if (finalChunk) STATE.draftFinal += finalChunk;

    const live = (STATE.draftFinal + interim).replace(/\s+/g, " ").trim();

    // Inserción en cursor (si existe contexto)
    if (STATE.insertCtx) {
      inp.value = STATE.insertCtx.before + live + STATE.insertCtx.after;
      const pos = (STATE.insertCtx.before + live).length;
      try { inp.setSelectionRange(pos, pos); } catch {}
    } else {
      inp.value = live;
    }

    // 🔔 Importante: al cambiar el valor por código, disparamos "input" para que
    // el composer (update/enable-send) se entere y habilite el botón de enviar.
    try {
      inp && inp.dispatchEvent(new Event("input", { bubbles: true }));
    } catch {}

    if (typeof onLiveText === "function") onLiveText(live);
  };

  rec.onend = () => {
    clearSafetyTimer();
    // Safari corta: si seguimos “grabando”, relanzamos
    if (!STATE.manualStop && STATE.isRecording) {
      try { rec.start(); } catch {}
      armSafetyTimer();
    } else {
      STATE.isRecording = false;
      setMicUI(false);
    }
  };

  rec.onerror = (ev) => {
    clearSafetyTimer();
    STATE.manualStop = true;
    STATE.isRecording = false;
    setMicUI(false);
    const code = String(ev?.error || "").trim();
    const msg =
      code === "not-allowed" || code === "service-not-allowed"
        ? "Necesito permiso para usar el micro."
        : code === "no-speech"
          ? "No he detectado voz. Prueba a hablar un poco mas alto."
          : code === "audio-capture"
            ? "No puedo acceder al micro. Puede estar ocupado."
            : code
              ? "Ha fallado el dictado. Prueba otra vez."
              : "Ha fallado el dictado. Prueba otra vez.";
    emitMicError(code || "unknown", msg);
  };

  return rec;
}

export function startMic({ onLiveText } = {}) {
  if (!speechSupported()) {
    emitMicError("unsupported", "Este navegador no soporta dictado.");
    return;
  }
  if (STATE.isRecording) return;

  const rec = ensureRec({ onLiveText });
  if (!rec) {
    emitMicError("unsupported", "Este navegador no soporta dictado.");
    return;
  }

  STATE.manualStop = false;
  STATE.draftFinal = "";

  // Guardar punto exacto del cursor (antes/después)
  const start =
    typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
  const end =
    typeof inp.selectionEnd === "number" ? inp.selectionEnd : inp.value.length;

  STATE.insertCtx = {
    before: inp.value.slice(0, start),
    after: inp.value.slice(end),
  };

  STATE.isRecording = true;
  setMicUI(true);
  armSafetyTimer();
  try { rec.start(); } catch (e) {
    console.log(e);
    clearSafetyTimer();
    STATE.isRecording = false;
    setMicUI(false);
  }
}
export function stopMic() {
  // Marca parada manual ANTES para cortar onend/onresult tardíos
  STATE.manualStop = true;
  STATE.isRecording = false;
  clearSafetyTimer();

  // Limpia contexto para que no reescriba el input tras parar
  STATE.draftFinal = "";
  STATE.insertCtx = null;

  if (!STATE.rec) {
    setMicUI(false);
    return;
  }

  try { STATE.rec.stop(); } catch {}
  setMicUI(false);
}
export function toggleMic(opts = {}) {
  if (STATE.isRecording) {
    stopMic();

    // UX: si el usuario ha parado desde el botón de micro,
    // deja el cursor listo al final para seguir escribiendo.
    if (opts && opts.focusOnStop) {
      try {
        const pos = (inp && typeof inp.value === "string") ? inp.value.length : 0;
        inp && inp.focus && inp.focus();
        try { inp && inp.setSelectionRange && inp.setSelectionRange(pos, pos); } catch {}
      } catch {}
    }

    return;
  }
  startMic(opts);
}
