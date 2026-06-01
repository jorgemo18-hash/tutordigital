// sessionapi.js — ciclo de vida de sesión del tutor IA.
// El sessionId vive en memoria. También se persiste en localStorage (ttd_session_{taskId})
// para poder restaurar la sesión si el alumno vuelve a la misma tarea sin cerrar el navegador.

import { apiFetch } from "./auth.js";

// ── Estado en memoria ──────────────────────────────────────────────────────────

let _sessionId   = null;
let _steps       = [];
let _currentStep = 0;
let _taskId      = null;
let _exercises   = [];

export function getActiveSessionId()   { return _sessionId; }
export function getActiveSteps()       { return _steps; }
export function getActiveCurrentStep() { return _currentStep; }
export function getActiveExercises()   { return _exercises; }

export function clearActiveSession() {
  _sessionId   = null;
  _steps       = [];
  _currentStep = 0;
  _taskId      = null;
  _exercises   = [];
}

export function applyStepMap(stepMap) {
  if (!stepMap) return;
  if (Array.isArray(stepMap.steps))            _steps       = stepMap.steps;
  if (typeof stepMap.currentStep === "number") _currentStep = stepMap.currentStep;
}

// ── Cache localStorage ─────────────────────────────────────────────────────────

const _cacheKey = (taskId) => `ttd_session_${taskId}`;

function _saveCache(taskId, sessionId) {
  if (!taskId || !sessionId) return;
  try { localStorage.setItem(_cacheKey(taskId), sessionId); } catch {}
}

export function clearSessionCache(taskId) {
  if (!taskId) return;
  try { localStorage.removeItem(_cacheKey(taskId)); } catch {}
}

// ── Restauración de sesión ─────────────────────────────────────────────────────
// Comprueba si hay sessionId en localStorage para esta tarea.
// Si existe, verifica con GET /api/v1/session/:id/map que la sesión sigue viva en BD.
// Si el mapa tiene pasos válidos → restaura y devuelve { sessionId, steps, currentStep }.
// Si falla o no hay pasos → limpia el cache y devuelve null (se creará sesión nueva).

export async function restoreSession(taskId) {
  if (!taskId) return null;

  let cachedId;
  try { cachedId = localStorage.getItem(_cacheKey(taskId)) || null; } catch {}
  if (!cachedId) return null;

  try {
    const res = await apiFetch(`/api/v1/session/${encodeURIComponent(cachedId)}/map`);
    if (!res.ok) { clearSessionCache(taskId); return null; }

    const data        = await res.json().catch(() => ({}));
    const map         = data?.data || {};
    const steps       = Array.isArray(map.steps) ? map.steps : [];
    const currentStep = map.currentStep ?? 0;

    if (steps.length === 0) {
      // Sesión abandonada antes de generar pasos — arrancar de cero
      clearSessionCache(taskId);
      return null;
    }

    _sessionId   = cachedId;
    _steps       = steps;
    _currentStep = currentStep;
    _taskId      = taskId;
    _exercises   = Array.isArray(map.exercises) ? map.exercises : [];

    return { sessionId: cachedId, steps, currentStep, exercises: _exercises };
  } catch {
    clearSessionCache(taskId);
    return null;
  }
}

// ── Phase 1 ────────────────────────────────────────────────────────────────────
// Devuelve:
//   { status: 'needs_choice', sessionId, exercises: [{index, title}] }
//   { status: 'ready',        sessionId, steps, currentStep }

export async function startSession(taskId, mode = "deberes") {
  _taskId = taskId;

  const res = await apiFetch("/api/v1/session/start", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ taskId, mode }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Session start failed (${res.status})`);
  }

  const data   = await res.json().catch(() => ({}));
  const result = data?.data || {};

  _sessionId = result.sessionId || null;

  if (result.status === "ready") {
    _steps       = result.steps       || [];
    _currentStep = result.currentStep ?? 0;
    _exercises   = result.exercises   || [];
    _saveCache(taskId, _sessionId);
  }
  if (result.status === "needs_choice") {
    _exercises = result.exercises || [];
  }

  return result;
}

// ── Phase 2 ────────────────────────────────────────────────────────────────────
// Llamado cuando el alumno elige un ejercicio concreto.
// Devuelve { steps, currentStep }.

export async function chooseExercise(sessionId, exerciseIndex, exerciseTitle = "") {
  const res = await apiFetch("/api/v1/session/choose", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ sessionId, exerciseIndex, exerciseTitle }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Choose exercise failed (${res.status})`);
  }

  const data   = await res.json().catch(() => ({}));
  const result = data?.data || {};

  _steps       = result.steps       || [];
  _currentStep = result.currentStep ?? 0;
  _saveCache(_taskId, sessionId);

  return { steps: _steps, currentStep: _currentStep };
}

// ── Recarga el mapa desde el servidor ─────────────────────────────────────────

export async function fetchSessionMap(sessionId) {
  const id = sessionId || _sessionId;
  if (!id) return null;

  const res = await apiFetch(`/api/v1/session/${encodeURIComponent(id)}/map`);
  if (!res.ok) return null;

  const data = await res.json().catch(() => ({}));
  const map  = data?.data || {};

  _steps       = map.steps       || _steps;
  _currentStep = map.currentStep ?? _currentStep;

  return { steps: _steps, currentStep: _currentStep };
}
