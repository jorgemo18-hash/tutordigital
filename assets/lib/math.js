// assets/math.js

export function normalizeInput(s) {
  return String(s || "")
    .replaceAll("×", "*")
    .replaceAll("÷", "/")
    .replaceAll("−", "-");
}

// =========================
//  Dictado -> ASCII
// =========================
export function normalizeDictation(raw) {
  let s = String(raw || "");

  const probe = s.toLowerCase();
  const seemsMath =
    /\b(x|equis|ra[ií]z|sqrt|más|menos|por|entre|dividido|igual|al\s+cuadrado|al\s+cubo|elevado)\b/.test(probe) ||
    /[0-9+\-*/^=]/.test(probe);

  if (!seemsMath) return String(raw || "");

  s = probe;

  s = s.replace(/\bequis\b/g, "x");

  s = s
    .replace(/\b(x)\s+al\s+cuadrado\b/g, "$1^2")
    .replace(/\b(x)\s+al\s+cubo\b/g, "$1^3")
    .replace(/\b(al\s+cuadrado)\b/g, "^2")
    .replace(/\b(al\s+cubo)\b/g, "^3");

  s = s.replace(/\b(x)\s+elevado\s+a\s+(\d+)\b/g, "$1^$2");
  s = s.replace(/\b(x)\s+a\s+la\s+(\d+)\b/g, "$1^$2");

  s = s.replace(/(\d+)\s*x\b/g, "$1x");

  s = s.replace(/\bra[ií]z\s+de\s+/g, "sqrt(");
  if (s.includes("sqrt(") && !s.includes(")")) s += ")";

  s = s
    .replace(/\b(más)\b/g, "+")
    .replace(/\b(menos)\b/g, "-")
    .replace(/\b(por)\b/g, "*")
    .replace(/\b(dividido\s+entre|entre)\b/g, "/")
    .replace(/\b(igual)\b/g, "=");

  s = s.replace(/\s+/g, " ").trim();

  return s;
}

// =========================
//  ASCII -> LaTeX
// =========================
function replaceFuncParen(src, funcName, replacer) {
  let s = src;
  let i = 0;
  while (i < s.length) {
    const idx = s.indexOf(funcName + "(", i);
    if (idx === -1) break;

    let j = idx + funcName.length + 1;
    let depth = 1;
    while (j < s.length && depth > 0) {
      const ch = s[j];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      j++;
    }
    if (depth !== 0) {
      i = idx + funcName.length + 1;
      continue;
    }

    const inside = s.slice(idx + funcName.length + 1, j - 1);
    const before = s.slice(0, idx);
    const after = s.slice(j);

    s = before + replacer(inside) + after;
    i = before.length + 1;
  }
  return s;
}

export function asciiToLatex(raw) {
  let t = normalizeInput(raw);

  t = t.replaceAll("π", "\\pi");
  t = replaceFuncParen(t, "sqrt", (inside) => `\\sqrt{${inside}}`);
  t = t.replace(/sqrt\s*([0-9a-zA-Zπ]+)/g, "\\sqrt{$1}");

  t = replaceFuncParen(t, "sin", (inside) => `\\sin\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "cos", (inside) => `\\cos\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "tan", (inside) => `\\tan\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "log", (inside) => `\\log\\left(${inside}\\right)`);
  t = replaceFuncParen(t, "ln", (inside) => `\\ln\\left(${inside}\\right)`);

  t = t.replace(/\*/g, "\\cdot ");
  t = t.replace(/\(([^()]*)\)\/\(([^()]*)\)/g, "\\frac{$1}{$2}");
  return t;
}

export function looksMath(text) {
  const s = normalizeInput(text).trim();
  if (!s) return false;

  if (/^(deberes|exámenes|examenes|trabajo)$/i.test(s)) return false;

  const hasWords = /[a-zA-Záéíóúüñ]{3,}/.test(s) && /\s/.test(s);

  const hasMathSignals =
    /[+\-*/^=]/.test(s) ||
    /\b(sqrt|sin|cos|tan|log|ln)\b/i.test(s) ||
    /[π√]/.test(s);

  if (hasWords && !hasMathSignals) return false;
  return hasMathSignals;
}
