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

export function showModeQuestion({ add } = {}) {
  if (waitingForMode) return;
  waitingForMode = true;
  if (typeof add === "function") add("assistant", "¿Es para deberes, examen o trabajo?", { autoScroll: false });
}

export function announceMode(mode, { add, getHistory, setHistory } = {}) {
  const m = String(mode || "").trim();
  if (!m) return;

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
