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

  // Obvious LaTeX / symbols
  if (/[\\^_=]|\b(frac|sqrt)\b/.test(s)) return true;
  if (/[π√∞∑∫≈≠≤≥]/.test(s)) return true;

  // Common operators with numbers
  if (/\d\s*[+\-*/×÷^]\s*\d/.test(s)) return true;

  // Simple patterns like 2x, 3y, x^2
  if (/\b\d\s*[a-zA-Z]\b/.test(s)) return true;
  if (/\b[a-zA-Z]\s*\^\s*\d/.test(s)) return true;

  return false;
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

  // Convert simple a/b into \frac{a}{b} when it's a very simple token fraction.
  // Avoid touching URLs or dates.
  s = s.replace(/\b([0-9a-zA-Z]+)\s*\/\s*([0-9a-zA-Z]+)\b/g, "\\frac{$1}{$2}");

  return s;
}
