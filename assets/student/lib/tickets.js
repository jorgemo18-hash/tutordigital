// assets/app/lib/tickets.js
// Local ticket queue for "Enviar al profesor".

import { warn } from "./log.js";

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

const KEY = `ttd_teacher_tickets_${getTenantId()}`;
const SPAM_WINDOW_MS = 10_000;

function readTickets() {
  try {
    const raw = localStorage.getItem(KEY) || "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    warn("tickets:read", e);
    return [];
  }
}

function writeTickets(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list || []));
  } catch (e) {
    warn("tickets:write", e);
  }
}

function isDuplicateRecent(list, type, nowMs) {
  if (!Array.isArray(list) || !list.length) return false;
  const last = list[list.length - 1];
  if (!last || last.type !== type) return false;
  const lastMs = Date.parse(last.createdAt || "");
  if (!Number.isFinite(lastMs)) return false;
  return nowMs - lastMs < SPAM_WINDOW_MS;
}

export function appendTicket(ticket) {
  const list = readTickets();
  const nowMs = Date.now();
  if (isDuplicateRecent(list, ticket?.type, nowMs)) {
    return { ok: false, reason: "duplicate" };
  }
  list.push(ticket);
  writeTickets(list);
  return { ok: true };
}

export function createTicket({
  type,
  mode,
  lastMessages = [],
  attachment = null,
} = {}) {
  const now = new Date();
  const id = `ttd_ticket_${now.getTime()}_${Math.random().toString(16).slice(2)}`;
  return {
    id,
    createdAt: now.toISOString(),
    type: type === "review" ? "review" : "help",
    mode: String(mode || "").trim(),
    summary: "",
    lastMessages: Array.isArray(lastMessages) ? lastMessages : [],
    attachment: attachment || null,
  };
}

export function getTickets() {
  return readTickets();
}
