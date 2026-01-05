import { STATE } from "./state.js";

export function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getHistory(){
  try { return JSON.parse(localStorage.getItem(STATE.HIST_KEY) || "[]"); }
  catch { return []; }
}

export function setHistory(arr){
  try { localStorage.setItem(STATE.HIST_KEY, JSON.stringify(arr)); } catch {}
}

export function ensureToday(){
  const saved = localStorage.getItem(STATE.DAY_KEY);
  const t = todayStr();
  if (saved !== t){
    localStorage.setItem(STATE.DAY_KEY, t);
    setHistory([]);
  }
}
