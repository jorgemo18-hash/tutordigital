// scoreValidation.js — Shared validation for grade/score inputs across the
// teacher panel (grade-drawer.js, bulk-grade-drawer.js). A score must be a
// decimal number between 0 and 10, written with a comma or dot separator.

const SCORE_SHAPE_RE = /^\d{1,2}([.,]\d{1,2})?$/;

// Returns { valid, empty, normalized, error }.
// - empty input is considered valid (callers decide what an empty score means)
// - normalized always uses "." as the decimal separator, ready for the API
export function parseScore(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { valid: true, empty: true, normalized: "", error: null };

  if (!SCORE_SHAPE_RE.test(trimmed)) {
    return { valid: false, empty: false, normalized: null, error: "Solo números, ej. 8,5" };
  }

  const normalized = trimmed.replace(",", ".");
  const num = parseFloat(normalized);
  if (!Number.isFinite(num) || num < 0 || num > 10) {
    return { valid: false, empty: false, normalized: null, error: "Debe estar entre 0 y 10" };
  }

  return { valid: true, empty: false, normalized, error: null };
}
