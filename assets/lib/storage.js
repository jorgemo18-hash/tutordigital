// assets/storage.js

const DAY_KEY  = "ttd_chat_day";
const HIST_KEY = "ttd_chat_history_v1";

export function todayStr(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getHistory(){
  try {
    const parsed = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setHistory(arr){
  try { localStorage.setItem(HIST_KEY, JSON.stringify(arr)); } catch {}
}

export function ensureToday(){
  const saved = localStorage.getItem(DAY_KEY);
  const t = todayStr();
  if (saved !== t){
    localStorage.setItem(DAY_KEY, t);
    setHistory([]);
  }
}

export function clearAll(){
  try { localStorage.removeItem(DAY_KEY); } catch {}
  try { localStorage.removeItem(HIST_KEY); } catch {}
}
