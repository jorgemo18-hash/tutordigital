import { STATE } from "./state.js";
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

  const hasHardMathSymbols = /[+\-*/^=]/.test(probe);
  const hasDigits = /\d/.test(probe);
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

  // --- Anti-falsos-positivos en dictado ---
  // Si el dictado parece una frase (muchas palabras) aunque contenga números o palabras sueltas tipo "derivada",
  // NO lo normalizamos a ASCII matemático. Así evitamos que luego se renderice como KaTeX y se "pegue" sin espacios.
  const wordTokens = probe.match(/[a-zA-Záéíóúüñ]+/g) || [];
  const wordCount = wordTokens.length;

  const mathWordHits = (
    probe.match(
      /\b(equis|ra[ií]z|sqrt|más|menos|dividido|igual|al\s+cuadrado|al\s+cubo|elevado|seno|coseno|tangente|logaritmo|ln|sin|cos|tan|log|derivada|integral)\b/g
    ) || []
  ).length;

  const hasOpSymbols = /[+\-*/^=]/.test(probe);

  // Frase larga sin operadores explícitos: lo tratamos como texto normal.
  // (Incluye casos con números: "Colón conquistó América en 1492" o dictados mezclados.)
  if (wordCount >= 6 && !hasOpSymbols && !hasPorAsOperator && !hasEntreAsOperator) {
    // Si solo hay 1-2 palabras "matemáticas" sueltas, no merece la pena normalizar.
    if (mathWordHits <= 2) return original;
    // Incluso con más palabras matemáticas, si es una frase muy larga, mejor no tocar.
    if (wordCount >= 10) return original;
  }

  const seemsMath = hasHardMathSymbols || hasMathWords || hasPorAsOperator || hasEntreAsOperator;
  // Nota: `hasDigits` NO activa por sí sola el modo matemático.
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
  if (STATE?.fromDictation) return false;
  const s = normalizeInput(text).trim();
  if (!s) return false;

  // Botones rápidos
  if (/^(deberes|exámenes|examenes|trabajo)$/i.test(s)) return false;

  // Señales de mates
  const hasOps = /[+\-*/^=]/.test(s);
  const hasFuncs = /\b(sqrt|sin|cos|tan|log|ln)\b/i.test(s) || /[π√]/.test(s);
  const hasMathSignals = hasOps || hasFuncs;

  // Si parece frase (muchas palabras), NO lo trates como fórmula completa.
  // Esto evita que texto normal con un trocito tipo "x^2" se renderice como KaTeX
  // (KaTeX ignora espacios en modo matemático y queda todo pegado).
  const wordTokens = s.match(/[a-zA-Záéíóúüñ]+/g) || [];
  const wordCount = wordTokens.length;

  // Cuenta de símbolos/funciones matemáticas presentes
  const funcCount = (s.match(/\b(sqrt|sin|cos|tan|log|ln)\b/gi) || []).length;
  const symCount = (s.match(/[+\-*/^=π√]/g) || []).length;

  // Heurística anti-falsos-positivos:
  // - Frase larga sin apenas señales matemáticas => texto.
  // - Frase con UN solo mini-trozo matemático (x^2, +4, etc.) => también texto (sin preview KaTeX).
  if (wordCount >= 6 && !hasOps) return false;
  if (wordCount >= 8 && (funcCount + symCount) <= 2) return false;

  // Caso típico que te ha pasado: dictas una frase y luego añades "x^2 + 4".
  // Aquí hay operadores, pero el input sigue siendo una frase: no queremos KaTeX.
  // Si hay >= 6 palabras y las señales matemáticas son "pocas", lo consideramos texto.
  if (wordCount >= 6 && (funcCount + symCount) <= 4) return false;

  // Si hay palabras "largas" (texto) y solo 1-2 operadores sueltos, también es texto.
  const longWordCount = (wordTokens.filter(w => (w || "").length >= 4)).length;
  if (longWordCount >= 4 && (funcCount + symCount) <= 4) return false;

  // Más agresivo: si es claramente una frase (palabras) y solo hay un mini-trozo de mates,
  // no lo renderices como KaTeX completo (KaTeX “pega” los espacios).
  const letterChars = (wordTokens.join("") || "").length;
  const mathChars = (s.match(/[0-9+\-*/^=π√(){}\[\]]/g) || []).length;

  // Frase con bastante texto + pocas señales matemáticas => texto.
  if (wordCount >= 4 && letterChars >= 12 && (funcCount + symCount) <= 5 && mathChars <= 12) {
    return false;
  }

  // Si hay signos de puntuación típicos de frase, es texto (aunque haya un x^2 suelto).
  if (/[.,;:¡!¿?]/.test(s) && wordCount >= 3) return false;

  // Si hay palabras y no hay señales de mates, es texto.
  const hasWordsAndSpaces = /[a-zA-Záéíóúüñ]{3,}/.test(s) && /\s/.test(s);
  if (hasWordsAndSpaces && !hasMathSignals) return false;

  return hasMathSignals;
}
