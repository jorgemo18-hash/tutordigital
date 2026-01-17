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
  const original = String(raw || "");
  let s = original;

  // --- Heurística: SOLO normalizamos si parece realmente matemático ---
  // Evitamos que frases normales ("voy por la calle") conviertan "por" -> "*".
  const probe = s.toLowerCase();

  const hasHardMathSymbols = /[0-9+\-*/^=]/.test(probe);
  const hasMathWords =
    /\b(equis|ra[ií]z|sqrt|más|menos|dividido|igual|al\s+cuadrado|al\s+cubo|elevado|seno|coseno|tangente|logaritmo|ln|sin|cos|tan|log|derivada|integral)\b/.test(
      probe
    );

  // "por" y "entre" SOLO cuentan como matemáticos si están entre operandos
  const hasPorAsOperator =
    /(?:\b\d+\b|\bx\b|\by\b|\)|\})\s+por\s+(?:\b\d+\b|\bx\b|\by\b|\(|\{|ra[ií]z|sqrt)/.test(
      probe
    );
  const hasEntreAsOperator =
    /(?:\b\d+\b|\bx\b|\by\b|\)|\})\s+(?:entre|dividido\s+entre)\s+(?:\b\d+\b|\bx\b|\by\b|\(|\{|ra[ií]z|sqrt)/.test(
      probe
    );

  const seemsMath = hasHardMathSymbols || hasMathWords || hasPorAsOperator || hasEntreAsOperator;
  if (!seemsMath) return original;

  // Trabajamos en minúsculas para los reemplazos de palabras,
  // pero mantenemos la estructura del texto.
  s = probe;

  // Variables
  s = s.replace(/\bequis\b/g, "x");

  // Potencias (lo más específico primero)
  s = s
    .replace(/\b(x)\s+al\s+cuadrado\b/g, "$1^2")
    .replace(/\b(x)\s+al\s+cubo\b/g, "$1^3")
    .replace(/\b(al\s+cuadrado)\b/g, "^2")
    .replace(/\b(al\s+cubo)\b/g, "^3");

  s = s.replace(/\b(x)\s+elevado\s+a\s+(\d+)\b/g, "$1^$2");
  s = s.replace(/\b(x)\s+a\s+la\s+(\d+)\b/g, "$1^$2");

  // 3 x -> 3x (solo si es un producto típico)
  s = s.replace(/(\d+)\s*x\b/g, "$1x");

  // Raíz
  s = s.replace(/\bra[ií]z\s+de\s+/g, "sqrt(");
  // Cerramos un sqrt( simple si no hay ninguno cerrado (heurístico)
  if (s.includes("sqrt(") && !s.includes(")")) s += ")";

  // Operadores: más/menos/igual siempre son seguros en contexto math
  s = s
    .replace(/\b(más)\b/g, "+")
    .replace(/\b(menos)\b/g, "-")
    .replace(/\b(igual)\b/g, "=");

  // "por" y "entre" SOLO como operadores cuando están entre operandos
  s = s.replace(
    /((?:\b\d+\b|\bx\b|\by\b|\)|\}))\s+por\s+((?:\b\d+\b|\bx\b|\by\b|\(|\{|ra[ií]z|sqrt))/g,
    "$1 * $2"
  );

  s = s.replace(
    /((?:\b\d+\b|\bx\b|\by\b|\)|\}))\s+(?:dividido\s+entre|entre)\s+((?:\b\d+\b|\bx\b|\by\b|\(|\{|ra[ií]z|sqrt))/g,
    "$1 / $2"
  );

  // Normaliza espacios alrededor de símbolos para que NO quede todo pegado
  s = s.replace(/\s*([+\-*/=^])\s*/g, " $1 ");

  // Limpia espacios
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
