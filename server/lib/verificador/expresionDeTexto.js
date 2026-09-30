// UNA EXPRESIÓN ESCRITA COMO TEXTO ("3*(x-2)^2 + sqrt(5)/2"), LEÍDA Y EVALUADA.
//
// Para comprobar ejercicios que NO salen de nuestros generadores (los de
// referencia y los que escribe la IA): llegan como texto, en la notación de
// `comprobar` (tools/referencias/comprueba.py hace lo mismo en Python con
// sympy). La multiplicación va siempre con `*`: "2x" no se acepta, para que
// "2x" y "2*x" no puedan leerse distinto aquí y en Python.
//
// Se evalúa con números decimales y una tolerancia relativa, no con
// fracciones exactas: hay raíces y π, y en la ESO los resultados son números
// "razonables". Donde hace falta exactitud (¿son la misma expresión?) se
// comprueba en varios puntos, no en uno.
const FUNCIONES = {
  sqrt: (a) => Math.sqrt(a),
  floor: (a) => Math.floor(a),
  abs: (a) => Math.abs(a),
  Rational: (a, b) => a / b,
  gcd: (a, b) => mcd(a, b),
  lcm: (a, b) => Math.abs(a * b) / mcd(a, b),
  divisor_count: (n) => divisores(n),
};
const CONSTANTES = { pi: Math.PI };

function mcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

function divisores(n) {
  let k = 0;
  for (let d = 1; d <= Math.abs(n); d += 1) if (n % d === 0) k += 1;
  return k;
}

function tokens(texto) {
  const salida = [];
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_]\w*|\*\*|[-+*/^%(),])/y;
  let i = 0;
  const t = String(texto);
  while (i < t.length) {
    if (/\s/.test(t[i])) { i += 1; continue; }
    re.lastIndex = i;
    const m = re.exec(t);
    if (!m) throw new Error(`No entiendo «${t.slice(i, i + 10)}»`);
    salida.push(m[1] === "**" ? "^" : m[1]);
    i = re.lastIndex;
  }
  return salida;
}

// Descenso recursivo: suma < producto < unario < potencia < átomo.
// `-3^2` es -(3²), como en matemáticas y en sympy.
export function lee(texto) {
  const ts = tokens(texto);
  let p = 0;
  const ve = () => ts[p];
  const toma = (esperado) => {
    if (esperado && ts[p] !== esperado) throw new Error(`Esperaba «${esperado}» y hay «${ts[p] ?? "fin"}»`);
    return ts[p++];
  };
  function suma() {
    let izq = producto();
    while (ve() === "+" || ve() === "-") izq = { op: toma(), a: izq, b: producto() };
    return izq;
  }
  function producto() {
    let izq = unario();
    while (ve() === "*" || ve() === "/" || ve() === "%") izq = { op: toma(), a: izq, b: unario() };
    return izq;
  }
  function unario() {
    if (ve() === "-") { toma(); return { op: "neg", a: unario() }; }
    if (ve() === "+") { toma(); return unario(); }
    return potencia();
  }
  function potencia() {
    const base = atomo();
    if (ve() === "^") { toma(); return { op: "^", a: base, b: unario() }; }
    return base;
  }
  function atomo() {
    const t = toma();
    if (t === undefined) throw new Error("La expresión acaba antes de tiempo");
    if (/^\d/.test(t)) return { num: Number(t) };
    if (t === "(") { const e = suma(); toma(")"); return e; }
    if (/^[A-Za-z_]/.test(t)) {
      if (ve() === "(") {
        if (!FUNCIONES[t]) throw new Error(`Función desconocida: ${t}`);
        toma("(");
        const args = [suma()];
        while (ve() === ",") { toma(","); args.push(suma()); }
        toma(")");
        return { fn: t, args };
      }
      if (t in CONSTANTES) return { num: CONSTANTES[t] };
      if (t.length === 1) return { variable: t };
      throw new Error(`Nombre desconocido: ${t}`);
    }
    throw new Error(`No esperaba «${t}»`);
  }
  const arbol = suma();
  if (p !== ts.length) throw new Error(`Sobra «${ts.slice(p).join(" ")}»`);
  return arbol;
}

export function evalua(arbol, valores = {}) {
  if ("num" in arbol) return arbol.num;
  if ("variable" in arbol) {
    if (!(arbol.variable in valores)) throw new Error(`Falta el valor de ${arbol.variable}`);
    return valores[arbol.variable];
  }
  if (arbol.fn) return FUNCIONES[arbol.fn](...arbol.args.map((x) => evalua(x, valores)));
  const a = evalua(arbol.a, valores);
  if (arbol.op === "neg") return -a;
  const b = evalua(arbol.b, valores);
  switch (arbol.op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return a / b;
    case "%": return ((a % b) + b) % b;
    default: return a ** b;
  }
}

export function variables(arbol, salida = new Set()) {
  if (arbol.variable) salida.add(arbol.variable);
  for (const hijo of [arbol.a, arbol.b, ...(arbol.args || [])]) if (hijo) variables(hijo, salida);
  return salida;
}

export const casiIgual = (x, y, tolerancia = 1e-9) =>
  Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tolerancia * Math.max(1, Math.abs(x), Math.abs(y));
