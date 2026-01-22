// assets/app/controllers/mode.js

export const MODES = {
  DEBERES: "Deberes",
  EXAMEN: "Exámenes",
  TRABAJO: "Trabajo",
};

// Estado compartido (simple y directo)
export let currentMode = "";          // "Deberes" | "Exámenes" | "Trabajo" | ""
export let modeChosen = false;        // hasta que no elijan arriba, no se puede escribir
export let pendingFirstQuestion = ""; // última pregunta escrita si aún no hay modo
export let waitingForMode = false;    // estamos esperando que el alumno diga el modo
export let noModeAttempts = 0;

const MODE_CONFIRM = {
  [MODES.DEBERES]: "Perfecto, deberes. ¿Por dónde arrancamos?",
  [MODES.EXAMEN]: "Genial, examen. ¿Qué tema estás preparando o qué duda tienes?",
  [MODES.TRABAJO]: "Vale, trabajo. ¿De qué va y qué te piden exactamente?",
};

export function resetNoModeAttempts() {
  noModeAttempts = 0;
}

export function showModeQuestion({ add, getHistory, setHistory } = {}) {
  noModeAttempts += 1;
  const attempt = noModeAttempts;
  const shouldRespond = attempt === 1 || attempt % 3 === 0;
  if (!shouldRespond) return;

  const msg = attempt === 1
    ? "Antes de seguir, elige una opción arriba: Deberes, Examen o Trabajo 🙂"
    : "De verdad: elige arriba una opción (Deberes, Examen o Trabajo) para poder ayudarte. 🙏";

  if (typeof add === "function") add("assistant", msg, { autoScroll: false });
  try {
    const hist = typeof getHistory === "function" ? getHistory() : [];
    hist.push({ role: "assistant", content: msg });
    if (typeof setHistory === "function") setHistory(hist);
  } catch {}
}

export function announceMode(mode, { add, getHistory, setHistory } = {}) {
  const m = String(mode || "").trim();
  if (!m) return;

  const msg = MODE_CONFIRM[m] || "Vale. ¿Qué necesitas hacer exactamente?";

  if (typeof add === "function") add("assistant", msg);

  try {
    const hist = typeof getHistory === "function" ? getHistory() : [];
    hist.push({ role: "assistant", content: msg });
    if (typeof setHistory === "function") setHistory(hist);
  } catch {}
}

export async function chooseMode(mode, { add, getHistory, setHistory, sendText, inp } = {}) {
  const m = String(mode || "").trim();
  if (!m) return;

  currentMode = m;
  modeChosen = true;
  waitingForMode = false;
  resetNoModeAttempts();

  try {
    announceMode(m, { add, getHistory, setHistory });
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
