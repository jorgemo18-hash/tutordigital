// sessionapi.js — ciclo de vida de sesión del tutor IA.
// El sessionId vive en memoria. También se persiste en localStorage (ttd_session_{taskId})
// para poder restaurar la sesión si el alumno vuelve a la misma tarea sin cerrar el navegador.

import { apiFetch } from "./auth.js";

// ── Estado en memoria ──────────────────────────────────────────────────────────

let _sessionId              = null;
let _steps                  = [];
let _currentStep            = 0;
let _taskId                 = null;
let _exercises              = [];
let _workedExerciseIndices  = new Set();

export function getActiveSessionId()          { return _sessionId; }
export function getActiveSteps()              { return _steps; }
export function getActiveCurrentStep()        { return _currentStep; }
export function getActiveExercises()          { return _exercises; }
export function getWorkedExerciseIndices()    { return _workedExerciseIndices; }

export function clearActiveSession() {
  _sessionId              = null;
  _steps                  = [];
  _currentStep            = 0;
  _taskId                 = null;
  _exercises              = [];
  _workedExerciseIndices  = new Set();
}

export function applyStepMap(stepMap) {
  if (!stepMap) return;
  if (Array.isArray(stepMap.steps))            _steps       = stepMap.steps;
  if (typeof stepMap.currentStep === "number") _currentStep = stepMap.currentStep;
}

// ── Cache localStorage ─────────────────────────────────────────────────────────

const _cacheKey = (taskId) => `ttd_session_${taskId}`;

function _saveCache(taskId, sessionId, exerciseCtx = null) {
  if (!taskId || !sessionId) return;
  try {
    const payload = {
      sessionId,
      exerciseIndex: exerciseCtx?.index  ?? null,
      exerciseTitle: exerciseCtx?.title  ?? null,
    };
    localStorage.setItem(_cacheKey(taskId), JSON.stringify(payload));
  } catch {}
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

  // Leer y parsear el cache — soporta tanto el formato JSON nuevo como el string plano antiguo
  let cachedId = null;
  let exerciseCtx = null;
  try {
    const raw = localStorage.getItem(_cacheKey(taskId));
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed   = JSON.parse(raw);
      cachedId       = parsed.sessionId || null;
      const idx      = parsed.exerciseIndex;
      const title    = parsed.exerciseTitle;
      exerciseCtx    = (idx != null) ? { index: idx, title: title || "" } : null;
    } else {
      cachedId = raw; // formato antiguo (string plano)
    }
    console.log("[restoreSession] cache →", { cachedId, exerciseCtx });
  } catch {}
  if (!cachedId) return null;

  try {
    const res = await apiFetch(`/api/v1/session/${encodeURIComponent(cachedId)}/map`);
    if (!res.ok) {
      console.log("[restoreSession] API not ok:", res.status, "→ null");
      clearSessionCache(taskId);
      return null;
    }

    const data        = await res.json().catch(() => ({}));
    const map         = data?.data || {};
    const steps       = Array.isArray(map.steps) ? map.steps : [];
    const currentStep = map.currentStep ?? 0;

    console.log("[restoreSession] map →", { steps: steps.length, currentStep, exerciseCtx });

    if (steps.length === 0) {
      // Sesión abandonada antes de generar pasos — arrancar de cero
      console.log("[restoreSession] steps=0 → null");
      clearSessionCache(taskId);
      return null;
    }

    _sessionId   = cachedId;
    _steps       = steps;
    _currentStep = currentStep;
    _taskId      = taskId;
    _exercises   = Array.isArray(map.exercises) ? map.exercises : [];
    if (exerciseCtx?.index != null) _workedExerciseIndices.add(exerciseCtx.index);

    console.log("[restoreSession] SUCCESS → exerciseCtx:", exerciseCtx);
    return { sessionId: cachedId, steps, currentStep, exercises: _exercises, exerciseCtx };
  } catch (err) {
    console.log("[restoreSession] catch:", err?.message, "→ null");
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
    const singleEx = _exercises[0] ?? null;
    if (singleEx?.index != null) _workedExerciseIndices.add(singleEx.index);
    _saveCache(taskId, _sessionId, singleEx ? { index: singleEx.index, title: singleEx.title } : null);
  }
  if (result.status === "needs_choice") {
    _exercises = result.exercises || [];
    _saveCache(taskId, _sessionId, null);
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
  _workedExerciseIndices.add(exerciseIndex);
  _saveCache(_taskId, sessionId, { index: exerciseIndex, title: exerciseTitle });

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
