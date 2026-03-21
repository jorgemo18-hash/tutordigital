// assets/app/state/storage.js
import { getTenantSlug } from "../../shared/js/auth.js";

// Tenant actual (puede cambiar tras login / cambio de centro)
function getTenant() {
  return getTenantSlug() || "";
}

// Si no hay tenant, NO leemos/escribimos storage tenant-scoped.
// Esto evita colisiones tipo ttd_*_ y mezclar datos entre centros.
function requireTenant() {
  const t = getTenant();
  return t ? t : "";
}

function key(base) {
  const t = requireTenant();
  if (!t) return ""; // sin tenant: no key
  return `${base}_${t}`;
}

// Keys dinámicas (NO congeladas)
function DAY_KEY() { return key("ttd_chat_day"); }
function HIST_KEY() { return key("ttd_chat_history_v1"); }
function THREADS_KEY() { return key("ttd_threads_v1"); }
function ACTIVE_THREADS_KEY() { return key("ttd_active_thread_v1"); }

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getHistory() {
  const k = HIST_KEY();
  if (!k) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(k) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ensureToday() {
  const k = DAY_KEY();
  if (!k) return;
  const saved = localStorage.getItem(k);
  const t = todayStr();
  if (saved !== t) {
    localStorage.setItem(k, t);
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
    const taskId = li.querySelector("[data-task-id]")?.dataset?.taskId || null;
    items.push({ title, itemKey, taskId });
  });

  return items;
}

export function makeThreadId(mode = "", itemKey = "") {
  const modeKey = normalizeModeKey(mode) || "modo";
  const safeKey = itemKey ? encodeURIComponent(itemKey) : "default";
  return `${modeKey}:${safeKey}`;
}

function readThreadsIndex() {
  const k = THREADS_KEY();
  if (!k) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(k) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeThreadsIndex(obj) {
  const k = THREADS_KEY();
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(obj || {})); } catch {}
}

function readActiveThreads() {
  const k = ACTIVE_THREADS_KEY();
  if (!k) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(k) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeActiveThreads(obj) {
  const k = ACTIVE_THREADS_KEY();
  if (!k) return;
  try { localStorage.setItem(k, JSON.stringify(obj || {})); } catch {}
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

function threadHistKey(threadId = "") {
  const t = requireTenant();
  if (!t || !threadId) return "";
  return `ttd_thread_history_${t}_${threadId}`;
}

export function getThreadHistory(threadId = "") {
  const k = threadHistKey(threadId);
  if (!k) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(k) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function setThreadHistory(threadId = "", arr = []) {
  const k = threadHistKey(threadId);
  if (!k) return;
  const safeArr = Array.isArray(arr) ? arr.slice(-200) : [];
  try { localStorage.setItem(k, JSON.stringify(safeArr)); } catch {}

  const idx = readThreadsIndex();
  if (idx[threadId]) {
    idx[threadId] = { ...idx[threadId], updatedAt: new Date().toISOString() };
    writeThreadsIndex(idx);
  }
}