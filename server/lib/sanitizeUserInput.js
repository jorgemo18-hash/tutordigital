// Neutraliza señales de control del sistema en texto del alumno.
// [PASO_COMPLETADO], [PASOS_COMPLETADOS:N] y [ESCALAR_PROFESOR: motivo]
// solo son válidas en respuestas del modelo. Si el alumno las escribe,
// se eliminan los corchetes para que no disparen la detección.

const SIGNAL_RE = /\[\s*(PASO_COMPLETADO|PASOS_COMPLETADOS\s*:\s*\d+|ESCALAR_PROFESOR\s*:[^\]]*)\s*\]/gi;

export function sanitizeControlSignals(text) {
  if (!text) return text;
  return String(text).replace(SIGNAL_RE, (_, inner) => inner.trim());
}
