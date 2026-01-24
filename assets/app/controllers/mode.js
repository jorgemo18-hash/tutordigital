// assets/app/controllers/mode.js

export const MODE_KEYS = {
  DEBERES: "DEBERES",
  EXAMEN: "EXAMEN",
  TRABAJO: "TRABAJO",
};

export const MODE_LABEL = {
  [MODE_KEYS.DEBERES]: "Deberes",
  [MODE_KEYS.EXAMEN]: "Exámenes",
  [MODE_KEYS.TRABAJO]: "Trabajo",
};

// Estado compartido (simple y directo)
export let currentMode = "";          // "DEBERES" | "EXAMEN" | "TRABAJO" | ""
export let modeChosen = false;        // hasta que no elijan arriba, no se puede escribir
export let pendingFirstQuestion = ""; // última pregunta escrita si aún no hay modo
export let waitingForMode = false;    // estamos esperando que el alumno diga el modo
export let noModeAttempts = 0;
export let selectedTopic = "";        // p.ej. "Lengua · Ejercicios 3 y 4"

const MODE_CONFIRM = {
  [MODE_KEYS.DEBERES]: "Perfecto, deberes. ¿Por dónde arrancamos?",
  [MODE_KEYS.EXAMEN]: "Genial, examen. ¿Qué tema estás preparando o qué duda tienes?",
  [MODE_KEYS.TRABAJO]: "Vale, trabajo. ¿De qué va y qué te piden exactamente?",
};

function normalizeMode(input = "") {
  const s = String(input || "").trim().toLowerCase();
  if (!s) return "";

  if (s === "deberes" || s === "deber" || s === "tareas") return MODE_KEYS.DEBERES;
  if (s === "examen" || s === "exámenes" || s === "examenes") return MODE_KEYS.EXAMEN;
  if (s === "trabajo" || s === "proyecto") return MODE_KEYS.TRABAJO;

  if (s === MODE_KEYS.DEBERES.toLowerCase()) return MODE_KEYS.DEBERES;
  if (s === MODE_KEYS.EXAMEN.toLowerCase()) return MODE_KEYS.EXAMEN;
  if (s === MODE_KEYS.TRABAJO.toLowerCase()) return MODE_KEYS.TRABAJO;

  return "";
}

export function resetNoModeAttempts() {
  noModeAttempts = 0;
}

export function setSelectedTopic(v) {
  selectedTopic = String(v || "").trim();
}

export function getSelectedTopic() {
  return selectedTopic;
}

export function showModeQuestion({ add, getHistory, setHistory } = {}) {
  waitingForMode = true;
  noModeAttempts += 1;
  const attempt = noModeAttempts;
  const shouldRespond = attempt === 1 || attempt % 3 === 0;
  if (!shouldRespond) return;

  const msg = attempt === 1
    ? "Antes de seguir, elige una opción arriba: Deberes, Exámenes o Trabajo 🙂"
    : "De verdad: elige arriba una opción (Deberes, Exámenes o Trabajo) para poder ayudarte. 🙏";

  if (typeof add === "function") add("assistant", msg, { autoScroll: false });
  try {
    const hist = typeof getHistory === "function" ? getHistory() : [];
    hist.push({ role: "assistant", content: msg });
    if (typeof setHistory === "function") setHistory(hist);
  } catch {}
}

export function announceMode(mode, { add, getHistory, setHistory } = {}) {
  const m = normalizeMode(mode);
  if (!m) return;

  const msg = MODE_CONFIRM[m] || "Vale. ¿Qué necesitas hacer exactamente?";

  if (typeof add === "function") add("assistant", msg);

  try {
    const hist = typeof getHistory === "function" ? getHistory() : [];
    hist.push({ role: "assistant", content: msg });
    if (typeof setHistory === "function") setHistory(hist);
  } catch {}
}

export async function chooseMode(
  mode,
  { add, getHistory, setHistory, sendText, inp, skipAnnounce = false } = {}
) {
  const m = normalizeMode(mode);
  if (!m) return;

  if (currentMode && currentMode !== m) {
    selectedTopic = "";
  }

  currentMode = m;
  modeChosen = true;
  waitingForMode = false;
  resetNoModeAttempts();

  try {
    if (!skipAnnounce) announceMode(m, { add, getHistory, setHistory });
  } catch {}

  // Si había una pregunta pendiente, la enviamos ahora sin duplicar burbuja
  if (pendingFirstQuestion) {
    const q = pendingFirstQuestion;
    pendingFirstQuestion = "";
    if (typeof sendText === "function") await sendText(q, { silentUser: true });
  } else {
    setTimeout(() => inp && inp.focus && inp.focus(), 0);
  }
}
export function setPendingFirstQuestion(v) {
  pendingFirstQuestion = String(v || "");
}
