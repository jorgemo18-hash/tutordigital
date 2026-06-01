// sessionapi.js — ciclo de vida de sesión del tutor IA.
// El sessionId vive en memoria: se pierde al refrescar (comportamiento esperado).

import { apiFetch } from "./auth.js";

let _sessionId   = null;
let _steps       = [];
let _currentStep = 0;

export function getActiveSessionId()   { return _sessionId; }
export function getActiveSteps()       { return _steps; }
export function getActiveCurrentStep() { return _currentStep; }

export function clearActiveSession() {
  _sessionId   = null;
  _steps       = [];
  _currentStep = 0;
}

export function applyStepMap(stepMap) {
  if (!stepMap) return;
  if (Array.isArray(stepMap.steps))            _steps       = stepMap.steps;
  if (typeof stepMap.currentStep === "number") _currentStep = stepMap.currentStep;
}

// ── Phase 1 ────────────────────────────────────────────────────────────────────
// Devuelve:
//   { status: 'needs_choice', sessionId, exercises: [{index, title}] }
//   { status: 'ready',        sessionId, steps, currentStep }
export async function startSession(taskId, mode = "deberes") {
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
  }

  return result; // caller inspects result.status
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

  return { steps: _steps, currentStep: _currentStep };
}

// Recarga el mapa de pasos desde el servidor.
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
