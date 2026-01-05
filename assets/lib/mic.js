// assets/mic.js
import { DOM, STATE } from "./state.js";
import { normalizeDictation } from "./math.js";

const { inp, micBtn } = DOM;

function speechSupported() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

function setMicUI(on) {
  STATE.isRecording = on;
  if (micBtn) micBtn.classList.toggle("micOn", on);
}

function ensureRec({ onLiveText } = {}) {
  if (STATE.rec) return STATE.rec;

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.lang = "es-ES";
  rec.interimResults = true;
  rec.continuous = false; // Safari: mejor así y reiniciar en onend
  STATE.rec = rec;

  rec.onresult = (e) => {
    let finalChunk = "";
    let interim = "";

    for (let i = e.resultIndex; i < e.results.length; i++) {
      const txt = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalChunk += txt + " ";
      else interim += txt;
    }

    if (finalChunk) STATE.draftFinal += finalChunk;

    const liveRaw = (STATE.draftFinal + interim).replace(/\s+/g, " ").trim();
    const live = normalizeDictation(liveRaw);

    // Inserción en cursor (si existe contexto)
    if (STATE.insertCtx) {
      inp.value = STATE.insertCtx.before + live + STATE.insertCtx.after;
      const pos = (STATE.insertCtx.before + live).length;
      try { inp.setSelectionRange(pos, pos); } catch {}
    } else {
      inp.value = live;
    }

    if (typeof onLiveText === "function") onLiveText(live);
  };

  rec.onend = () => {
    // Safari corta: si seguimos “grabando”, relanzamos
    if (!STATE.manualStop && STATE.isRecording) {
      try { rec.start(); } catch {}
    } else {
      setMicUI(false);
    }
  };

  rec.onerror = (ev) => {
    console.log("Speech error:", ev);
    STATE.manualStop = true;
    setMicUI(false);
  };

  return rec;
}

export function startMic({ onLiveText } = {}) {
  if (!speechSupported()) {
    alert("Safari a veces no soporta bien el dictado. Si falla, prueba Chrome.");
    return;
  }
  if (STATE.isRecording) return;

  const rec = ensureRec({ onLiveText });
  if (!rec) {
    alert("Este navegador no soporta SpeechRecognition.");
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

  setMicUI(true);
  try { rec.start(); } catch (e) {
    console.log(e);
    setMicUI(false);
  }
}

export function stopMic() {
  if (!STATE.rec) {
    setMicUI(false);
    return;
  }
  STATE.manualStop = true;
  try { STATE.rec.stop(); } catch {}
  setMicUI(false);
}

export function toggleMic({ onLiveText } = {}) {
  if (!STATE.isRecording) startMic({ onLiveText });
  else stopMic();
}
