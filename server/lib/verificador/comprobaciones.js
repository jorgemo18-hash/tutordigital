import { lee, evalua, variables, casiIgual } from "./expresionDeTexto.js";

// LAS COMPROBACIONES DE UN EJERCICIO: la misma notación y los mismos tipos que
// tools/referencias/comprueba.py (que lo hace con sympy al preparar los
// ejercicios de referencia), aquí en el servidor para los ejercicios que
// escribe la IA en el momento. Un ejercicio de referencia que Python dio por
// bueno tiene que salir bueno aquí también: lo comprueba el test.
//
//   ecuacion    { ecuacion: "2*x-5 = 4*x-7", var?: "x", respuesta: ["1"] | "sin solución" | "identidad" }
//   sistema     { ecuaciones: [...], vars: ["x","y"], respuesta: { x: "6", y: "4" } | "sin solución" | "infinitas" }
//   igualdad    { expresion, respuesta }         la misma expresión (se prueba en varios puntos)
//   valor       { expresion, respuesta, tolerancia? }
//   estadistica { datos: [...], medida: media|mediana|moda|rango, respuesta }
//
// Cada una devuelve { ok, motivo }: el motivo dice qué salió, para el registro.
const EPS = 1e-7;
const lado = (texto) => lee(texto);
const valorDe = (texto) => evalua(lee(String(texto)));

function diferencia(ecuacion) {
  const [izq, der, ...resto] = String(ecuacion).split("=");
  if (der === undefined || resto.length) throw new Error(`Una ecuación con un solo «=»: ${ecuacion}`);
  const a = lado(izq);
  const b = lado(der);
  return (valores) => evalua(a, valores) - evalua(b, valores);
}

// Coeficientes de f si es un polinomio de grado ≤ 2 en `v` (null si no lo es).
function cuadratica(f, v) {
  const en = (x) => f({ [v]: x });
  const c = en(0);
  const a = (en(1) + en(-1)) / 2 - c;
  const b = (en(1) - en(-1)) / 2;
  for (const x of [2, -3, 0.5, 7]) if (!casiIgual(en(x), a * x * x + b * x + c, 1e-6)) return null;
  return { a, b, c };
}

function raices({ a, b, c }) {
  // Cero "de verdad" frente al ruido de los decimales: 1e-9 del tamaño de
  // los coeficientes (con x = 148 500 000 el término independiente es enorme
  // y el de x vale 1, y no es cero).
  const escala = Math.max(Math.abs(a), Math.abs(b), Math.abs(c), 1);
  const nulo = (x) => Math.abs(x) < 1e-9 * escala;
  if (nulo(a)) {
    if (nulo(b)) return nulo(c) ? "identidad" : "sin solución";
    return [-c / b];
  }
  const d = b * b - 4 * a * c;
  const escalaD = Math.max(b * b, Math.abs(4 * a * c), 1);
  if (d < -1e-9 * escalaD) return "sin solución";
  if (Math.abs(d) <= 1e-9 * escalaD) return [-b / (2 * a)];
  return [(-b - Math.sqrt(d)) / (2 * a), (-b + Math.sqrt(d)) / (2 * a)].sort((x, y) => x - y);
}

function comparaSoluciones(calculada, esperada) {
  if (typeof calculada === "string" || typeof esperada === "string") {
    return calculada === esperada ? null : `sale ${JSON.stringify(calculada)}`;
  }
  const e = esperada.map(valorDe).sort((x, y) => x - y);
  if (e.length !== calculada.length || !e.every((x, i) => casiIgual(x, calculada[i], 1e-6))) {
    return `sale ${calculada.map((x) => +x.toFixed(6)).join(", ")}`;
  }
  return null;
}

function compruebaEcuacion(c) {
  const v = c.var || "x";
  const f = diferencia(c.ecuacion);
  const coef = cuadratica(f, v);
  if (!coef) {
    // No es de grado ≤ 2 (x en un denominador, grado 3…): al menos, que cada
    // solución dada la cumpla. Es más débil y se dice.
    if (!Array.isArray(c.respuesta)) return { ok: false, motivo: "no es de grado ≤ 2 y no hay soluciones que sustituir" };
    const malas = c.respuesta.filter((r) => !casiIgual(f({ [v]: valorDe(r) }), 0, 1e-6));
    return { ok: !malas.length, motivo: malas.length ? `no cumplen: ${malas.join(", ")}` : "solo se ha sustituido" };
  }
  const motivo = comparaSoluciones(raices(coef), c.respuesta);
  return { ok: !motivo, motivo };
}

// Sistema lineal: coeficientes de cada ecuación y eliminación gaussiana.
function compruebaSistema(c) {
  const vars = c.vars || ["x", "y"];
  const cero = Object.fromEntries(vars.map((v) => [v, 0]));
  const filas = c.ecuaciones.map((e) => {
    const f = diferencia(e);
    const indep = f(cero);
    const fila = vars.map((v) => f({ ...cero, [v]: 1 }) - indep);
    // Que de verdad sea lineal: en un punto cualquiera, cuadra.
    const prueba = Object.fromEntries(vars.map((v, i) => [v, 1.7 + i]));
    const lineal = fila.reduce((s, k, i) => s + k * prueba[vars[i]], indep);
    if (!casiIgual(f(prueba), lineal, 1e-6)) throw new Error(`No es lineal: ${e}`);
    return [...fila, -indep];
  });
  const n = vars.length;
  let rango = 0;
  for (let col = 0; col < n && rango < filas.length; col += 1) {
    let piv = rango;
    for (let i = rango + 1; i < filas.length; i += 1) if (Math.abs(filas[i][col]) > Math.abs(filas[piv][col])) piv = i;
    if (Math.abs(filas[piv][col]) < EPS) continue;
    [filas[rango], filas[piv]] = [filas[piv], filas[rango]];
    for (let i = 0; i < filas.length; i += 1) {
      if (i === rango) continue;
      const k = filas[i][col] / filas[rango][col];
      for (let j = col; j <= n; j += 1) filas[i][j] -= k * filas[rango][j];
    }
    rango += 1;
  }
  const incompatible = filas.some((f) => f.slice(0, n).every((x) => Math.abs(x) < EPS) && Math.abs(f[n]) > EPS);
  let calculada;
  if (incompatible) calculada = "sin solución";
  else if (rango < n) calculada = "infinitas";
  else {
    calculada = {};
    for (const f of filas.slice(0, n)) {
      const col = f.findIndex((x) => Math.abs(x) > EPS);
      calculada[vars[col]] = f[n] / f[col];
    }
  }
  if (typeof calculada === "string" || typeof c.respuesta === "string") {
    return { ok: calculada === c.respuesta, motivo: `sale ${JSON.stringify(calculada)}` };
  }
  const ok = vars.every((v) => casiIgual(calculada[v], valorDe(c.respuesta[v]), 1e-6));
  return { ok, motivo: ok ? null : `sale ${JSON.stringify(calculada)}` };
}

function compruebaIgualdad(c) {
  const a = lee(c.expresion);
  const b = lee(String(c.respuesta));
  const vs = [...new Set([...variables(a), ...variables(b)])];
  // Cinco puntos "raros" (no enteros pequeños, donde dos expresiones
  // distintas podrían coincidir por casualidad).
  const puntos = [0.37, 1.91, -2.43, 3.17, -0.71].map((t, i) => Object.fromEntries(vs.map((v, j) => [v, t + 0.53 * j + 0.1 * i])));
  const mal = puntos.find((p) => !casiIgual(evalua(a, p), evalua(b, p), 1e-7));
  return { ok: !mal, motivo: mal ? "no son la misma expresión" : null };
}

function compruebaValor(c) {
  const v = valorDe(c.expresion);
  const r = valorDe(c.respuesta);
  const ok = c.tolerancia != null ? Math.abs(v - r) <= c.tolerancia : casiIgual(v, r);
  return { ok, motivo: ok ? null : `sale ${+v.toFixed(6)}` };
}

function compruebaEstadistica(c) {
  const d = c.datos.map(Number);
  const orden = [...d].sort((x, y) => x - y);
  const n = d.length;
  if (c.medida === "moda") {
    const veces = new Map();
    for (const x of d) veces.set(x, (veces.get(x) || 0) + 1);
    const max = Math.max(...veces.values());
    const moda = [...veces].filter(([, k]) => k === max).map(([x]) => x).sort((x, y) => x - y);
    const esperada = c.respuesta.map(valorDe).sort((x, y) => x - y);
    const ok = moda.length === esperada.length && moda.every((x, i) => casiIgual(x, esperada[i]));
    return { ok, motivo: ok ? null : `sale ${moda.join(", ")}` };
  }
  const calculos = {
    media: () => d.reduce((s, x) => s + x, 0) / n,
    mediana: () => (n % 2 ? orden[(n - 1) / 2] : (orden[n / 2 - 1] + orden[n / 2]) / 2),
    rango: () => orden[n - 1] - orden[0],
  };
  if (!calculos[c.medida]) throw new Error(`Medida desconocida: ${c.medida}`);
  const v = calculos[c.medida]();
  const ok = casiIgual(v, valorDe(c.respuesta));
  return { ok, motivo: ok ? null : `sale ${+v.toFixed(6)}` };
}

const COMPROBADORES = {
  ecuacion: compruebaEcuacion,
  sistema: compruebaSistema,
  igualdad: compruebaIgualdad,
  valor: compruebaValor,
  estadistica: compruebaEstadistica,
};

// Una comprobación. Una expresión que no se entiende también es un fallo.
export function comprueba(c) {
  const f = COMPROBADORES[c?.tipo];
  if (!f) return { ok: false, motivo: `tipo desconocido: ${c?.tipo}` };
  try {
    return f(c);
  } catch (err) {
    return { ok: false, motivo: err.message };
  }
}
