// assets/app/state/state.js
// Centraliza accesos al DOM, versión de app y estado global.

// Evita spam: avisamos una vez por id que falte
const __DOM_WARNED = new Set();

function $(id) {
  const el = document.getElementById(id);
  if (!el && !__DOM_WARNED.has(id)) {
    __DOM_WARNED.add(id);
    // Warning de desarrollo: si un id cambia o falta, lo ves al instante.
    console.warn(`[DOM] Elemento no encontrado: #${id}`);
  }
  return el;
}

export const DOM = {
  chat: $("chat"),
  messages: $("messages"),
  inp: $("inp"),
  btn: $("sendIn") || $("btn"),
  kbd: $("kbd"),
  more: $("more"),
  filePick: $("filePick"),
  sendIn: $("sendIn"),
  pad: $("pad"),
  eqPreview: $("eqPreview"),
  micBtn: $("mic"),
  agenda: $("agenda"),
  btnDeberes: $("btnDeberes"),
  btnExamen: $("btnExamen"),
  btnTrabajo: $("btnTrabajo"),
};

// Version visible (para Vercel y QA)
export const APP_VERSION = "1.5.10";

/**
 * Estado global mínimo (mutable) usado por varios módulos.
 * - rec: instancia de SpeechRecognition
 * - isRecording: si el mic está activo
 * - manualStop: si el usuario detuvo el dictado (corta reinicios)
 * - draftFinal: buffer de dictado final
 * - insertCtx: contexto de inserción (before/after) para escribir en el cursor
 * - fromDictation: si el último input viene del mic (UX/preview)
 *
 * Nota: lo sellamos para evitar añadir/borrar keys por accidente.
 */
export const STATE = Object.seal({
  rec: null,
  isRecording: false,
  manualStop: false,
  draftFinal: "",
  insertCtx: null,
  // Dictado / UX
  fromDictation: false,
});
