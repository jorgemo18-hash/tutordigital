// assets/app/controllers/math.js
// Lightweight math helpers used across the app.
// IMPORTANT: This module must ONLY export helpers (no side-effects / boot code),
// because index.js imports { asciiToLatex, looksMath } from here.

/**
 * Heuristic: decide if a string likely contains math.
 */
export function looksMath(input = "") {
  const s = String(input || "").trim();
  if (!s) return false;

  const hasObviousMath =
    /[\\^_=]|\b(frac|sqrt)\b/.test(s) ||
    /[π√∞∑∫≈≠≤≥]/.test(s);

  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const digits = (s.match(/\d/g) || []).length;
  const ops = (s.match(/[+\-*/×÷^=()]/g) || []).length;
  const varTokens = (s.match(/\b[A-Za-z]\b/g) || []).length;
  const words = (s.match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || []).length;
  const mathScore = digits + ops + varTokens;
  const letterScore = Math.max(0, letters - varTokens);

  const hasBasicMath =
    /\d\s*[+\-*/×÷^]\s*\d/.test(s) ||
    /\b\d\s*[a-zA-Z]\b/.test(s) ||
    /\b[a-zA-Z]\s*\^\s*\d/.test(s);

  if (!hasObviousMath && !hasBasicMath) return false;

  // If there is a lot of text, avoid treating it as math.
  if (words >= 2 && mathScore < words * 2) return false;
  if (letterScore > mathScore * 1.5 && mathScore < 6) return false;
  if (words >= 1 && letters > mathScore) return false;
  if (letters >= 10 && mathScore < 8) return false;

  return true;
}

/**
 * Convert a relaxed/ascii-ish math string into something KaTeX can render.
 * This is intentionally conservative; other parts of the app may already
 * build proper LaTeX snippets.
 */
export function asciiToLatex(input = "") {
  let s = String(input || "");
  if (!s.trim()) return "";

  // If it already looks like LaTeX, keep it.
  if (/\\(frac|sqrt|times|cdot|pi|left|right)/.test(s)) return s;

  // Normalize common unicode operators
  s = s
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/π/g, "\\pi")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/≠/g, "\\ne ")
    .replace(/≈/g, "\\approx ");

  // Convert naive sqrt patterns like: √(x+1)
  // We do a simple pass: for each '√(' replace the first following ')' with '}'
  // This won't handle nested parentheses perfectly, but is enough for most inputs.
  while (s.includes("√(")) {
    const i = s.indexOf("√(");
    const j = s.indexOf(")", i + 2);
    if (j === -1) {
      s = s.replace("√(", "\\sqrt{");
      break;
    }
    s = s.slice(0, i) + "\\sqrt{" + s.slice(i + 2, j) + "}" + s.slice(j + 1);
  }

  // Convert ascii sqrt patterns like: sqrt (x+1) or sqrt(x+1)
  while (/\bsqrt\s*\(/.test(s)) {
    const m = s.match(/\bsqrt\s*\(/);
    if (!m) break;
    const i = m.index;
    const start = i + m[0].length;
    const j = s.indexOf(")", start);
    if (i === undefined) break;
    if (j === -1) {
      s = s.replace(/\bsqrt\s*\(/, "\\sqrt{");
      break;
    }
    s = s.slice(0, i) + "\\sqrt{" + s.slice(start, j) + "}" + s.slice(j + 1);
  }

  // Convert simple a/b into \frac{a}{b} only in math-like context.
  const hasMathContext =
    /[=+^()]/.test(s) ||
    /\b\d+\b/.test(s) ||
    /\b[A-Za-z]\b/.test(s);

  if (hasMathContext) {
    // UNA barra invertida, no dos. Aquí había `"$1\\\\frac{$2}{$3}"`, que en una
    // cadena de JavaScript son DOS barras: KaTeX recibía `\\\\frac{1}{2}`, leía el
    // `\\\\` como un salto de línea de LaTeX y pintaba la palabra "frac12" tal
    // cual. Se vio el 14/09/2026 en la primera prueba con KaTeX cargado de
    // verdad: `1/2 + x^3` salía como "frac12 + x³".
    //
    // Llevaba ahí desde siempre y no lo había visto nadie porque KaTeX no
    // estaba cargado: sin motor no se dibujaba nada, así que el traductor
    // nunca se ejercitó. Un fallo tapado por otro.
    //
    // LOS BORDES SON ESTRECHOS A PROPÓSITO (`(^|\s)` … `(?=\s|$)`): solo se
    // convierte una fracción que va sola entre espacios. Así "14/09/2026" no
    // se convierte en una fracción — y una fecha escrita por el alumno es más
    // frecuente que `(1/2)`, que se queda sin convertir y es el precio.
    s = s.replace(/(^|\s)([0-9a-zA-Z]+)\s*\/\s*([0-9a-zA-Z]+)(?=\s|$)/g, "$1\\frac{$2}{$3}");
  }

  return s;
}

export function normalizeDictation(input = "") {
  const s = String(input || "");

  let out = s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (!looksMath(out)) return out;

  out = out
    .replace(/\bpor\b/gi, "×")
    .replace(/\bentre\b/gi, "÷");

  out = out
    .replace(/\bra[ií]z de\s*\(/gi, "√(")
    .replace(/\bra[ií]z de\s+/gi, "√(");

  return out;
}

export function isMathOnly(input = "") {
  const s = String(input || "").trim();
  if (!s) return false;

  const longWords = (s.match(/\b[A-Za-zÀ-ÿ]{3,}\b/g) || []).length;
  if (longWords >= 1) return false;

  const hasMathSignals =
    /[\\^_=]|\b(frac|sqrt)\b/.test(s) ||
    /[π√∞∑∫≈≠≤≥]/.test(s) ||
    /\d\s*[+\-*/×÷^=]\s*\d/.test(s) ||
    /\b[a-zA-Z]\s*\^\s*\d/.test(s) ||
    /\b\d\s*[a-zA-Z]\b/.test(s);

  if (!hasMathSignals) return false;

  const letters = (s.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const digits = (s.match(/\d/g) || []).length;
  const ops = (s.match(/[+\-*/×÷^=()]/g) || []).length;
  const varTokens = (s.match(/\b[A-Za-z]\b/g) || []).length;

  const mathScore = digits + ops + varTokens;
  const letterScore = Math.max(0, letters - varTokens);

  if (letterScore > mathScore) return false;

  return true;
}
