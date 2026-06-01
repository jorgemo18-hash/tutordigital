// sessionapi.js — gestión del ciclo de vida de sesión del tutor IA.
// El sessionId vive en memoria: se pierde al refrescar la página (comportamiento esperado).

import { apiFetch } from "./auth.js";

// ── Estado en memoria ──────────────────────────────────────────────────────

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
  if (Array.isArray(stepMap.steps))                  _steps       = stepMap.steps;
  if (typeof stepMap.currentStep === "number")        _currentStep = stepMap.currentStep;
}

// ── API calls ──────────────────────────────────────────────────────────────

// Inicia una sesión: llama al Guía (Opus) y devuelve { sessionId, steps, currentStep }.
// Puede tardar 5-15 s — el caller debe mostrar pantalla de carga.
export async function startSession(taskId, mode = "deberes", exerciseHint = null) {
  const res = await apiFetch("/api/v1/session/start", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ taskId, mode, exerciseHint }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = body?.error?.message || `Session start failed (${res.status})`;
    throw new Error(msg);
  }

  const data = await res.json().catch(() => ({}));
  const result = data?.data || {};

  _sessionId   = result.sessionId   || null;
  _steps       = result.steps       || [];
  _currentStep = result.currentStep ?? 0;

  return { sessionId: _sessionId, steps: _steps, currentStep: _currentStep };
}

// Recarga el mapa de pasos desde el servidor (útil si el alumno refresca).
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
