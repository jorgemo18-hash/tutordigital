// assets/app/state/storage.js

function normalizeTenantId(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  const map = {
    lyceo: "lyceo",
    instituto1: "lyceo",
    inst1: "lyceo",
    inst2: "instituto2",
    instituto2: "instituto2"
  };
  return map[value] || value;
}

function getTenantId() {
  try {
    const t = new URLSearchParams(window.location.search).get("tenant");
    const stored = localStorage.getItem("ttd_activeTenant") || "";
    return normalizeTenantId(t || stored || "");
  } catch {
    return "";
  }
}

function key(base) {
  return `${base}_${getTenantId()}`;
}

const DAY_KEY = key("ttd_chat_day");
const HIST_KEY = key("ttd_chat_history_v1");
const THREADS_KEY = key("ttd_threads_v1");
const ACTIVE_THREADS_KEY = key("ttd_active_thread_v1");

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

export function ensureToday(){
  const saved = localStorage.getItem(DAY_KEY);
  const t = todayStr();
  if (saved !== t){
    localStorage.setItem(DAY_KEY, t);
  }
}

function normalizeModeKey(mode = "") {
  return String(mode || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeItem(text = "") {
  let s = String(text || "").trim().toLowerCase();
  if (!s) return "";
  try {
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  } catch {}
  s = s.replace(/\s+/g, " ");
  s = s.replace(/\s*·\s*/g, " · ");
  return s.trim();
}

export function computeItemsForMode(mode = "") {
  const modeKey = normalizeModeKey(mode);
  const buttonId =
    modeKey === "deberes" ? "btnDeberes"
    : (modeKey === "examen" || modeKey === "examenes") ? "btnExamen"
    : modeKey === "trabajo" ? "btnTrabajo"
    : "";

  if (!buttonId || !globalThis.document) return [];

  const btn = document.getElementById(buttonId);
  if (!btn) return [];

  const items = [];
  btn.querySelectorAll("li").forEach((li) => {
    const title = String(li?.textContent || "").trim();
    if (!title) return;
    const itemKey = normalizeItem(title);
    if (!itemKey) return;
    items.push({ title, itemKey });
  });

  return items;
}

export function makeThreadId(mode = "", itemKey = "") {
  const modeKey = normalizeModeKey(mode) || "modo";
  const safeKey = itemKey ? encodeURIComponent(itemKey) : "default";
  return `${modeKey}:${safeKey}`;
}

function readThreadsIndex() {
  try {
    const parsed = JSON.parse(localStorage.getItem(THREADS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeThreadsIndex(obj) {
  try { localStorage.setItem(THREADS_KEY, JSON.stringify(obj || {})); } catch {}
}

function readActiveThreads() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_THREADS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeActiveThreads(obj) {
  try { localStorage.setItem(ACTIVE_THREADS_KEY, JSON.stringify(obj || {})); } catch {}
}

export function setActiveThreadForMode(mode = "", threadId = "") {
  const modeKey = normalizeModeKey(mode);
  if (!modeKey) return;
  const active = readActiveThreads();
  active[modeKey] = threadId;
  writeActiveThreads(active);
}

export function getActiveThreadForMode(mode = "") {
  const modeKey = normalizeModeKey(mode);
  if (!modeKey) return "";
  const active = readActiveThreads();
  return String(active[modeKey] || "");
}

export function ensureThread(mode = "", itemKey = "", title = "") {
  const threadId = makeThreadId(mode, itemKey);
  const idx = readThreadsIndex();
  if (!idx[threadId]) {
    idx[threadId] = {
      mode: String(mode || ""),
      itemKey: String(itemKey || ""),
      title: String(title || ""),
      updatedAt: new Date().toISOString(),
    };
  } else {
    idx[threadId] = {
      ...idx[threadId],
      title: title ? String(title || "") : idx[threadId].title,
      updatedAt: new Date().toISOString(),
    };
  }
  writeThreadsIndex(idx);
  return threadId;
}

export function getThreadHistory(threadId = "") {
  if (!threadId) return [];
  const key = `ttd_thread_history_${getTenantId()}_${threadId}`;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setThreadHistory(threadId = "", arr = []) {
  if (!threadId) return;
  const key = `ttd_thread_history_${getTenantId()}_${threadId}`;
  const safeArr = Array.isArray(arr) ? arr.slice(-200) : [];
  try { localStorage.setItem(key, JSON.stringify(safeArr)); } catch {}

  const idx = readThreadsIndex();
  if (idx[threadId]) {
    idx[threadId] = { ...idx[threadId], updatedAt: new Date().toISOString() };
    writeThreadsIndex(idx);
  }
}
