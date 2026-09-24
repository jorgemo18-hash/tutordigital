import { reuneApartados } from "../../ejercicio.js";
import { suma, resta, producto, cociente, latex, texto, latexTalCual, textoTalCual } from "./fraccion.js";
import { fraccionPropia } from "./eleccion.js";

// FRACCIONES, OBJETIVO 6: OPERACIONES COMBINADAS (concepto 7).
//
// Tres fracciones y dos operaciones, siempre con la jerarquía en juego: en
// las de dificultad 2 hay una suma o resta y un producto o cociente SIN
// paréntesis (así importa el orden), y en las de dificultad 3 un paréntesis
// cambia ese orden.
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR (error 12 del tema): operar de
// izquierda a derecha sin jerarquía. En las formas sin paréntesis su
// respuesta-trampa sale de hacer la cuenta en ese orden; se descartan los
// casos en que da lo mismo (el ejercicio no mide nada).

const OP = { "+": suma, "-": resta, "·": producto, ":": cociente };
const LATEX = { "+": "+", "-": "-", "·": "\\cdot", ":": ":" };
const TEXTO = { "+": "+", "-": "−", "·": "·", ":": ":" };

// Cada forma: cómo se escribe y en qué orden se hace. x, y, z son las tres
// fracciones; `pasos` devuelve [descripción, resultado] en orden.
const SIN_PARENTESIS = [
  { ops: ["+", "·"], primero: 1 },
  { ops: ["-", ":"], primero: 1 },
  { ops: ["·", "+"], primero: 0 },
  { ops: [":", "-"], primero: 0 },
];
const CON_PARENTESIS = [
  { ops: ["+", "·"], parentesis: [0, 1] },
  { ops: [":", "-"], parentesis: [1, 2] },
  { ops: ["-", ":"], parentesis: [0, 1] },
  { ops: ["·", "+"], parentesis: [1, 2] },
];

function escribe(fs, ops, parentesis, conv, sep) {
  const [x, y, z] = fs.map(conv);
  const a = sep(ops[0]);
  const b = sep(ops[1]);
  const abre = "(";
  const cierra = ")";
  if (!parentesis) return `${x} ${a} ${y} ${b} ${z}`;
  return parentesis[0] === 0 ? `${abre}${x} ${a} ${y}${cierra} ${b} ${z}` : `${x} ${a} ${abre}${y} ${b} ${z}${cierra}`;
}

function resuelve(fs, forma) {
  const [x, y, z] = fs;
  const [o1, o2] = forma.ops;
  const primeroEsElSegundo = forma.parentesis ? forma.parentesis[0] === 1 : forma.primero === 1;
  if (primeroEsElSegundo) {
    const p = OP[o2](y, z);
    const r = OP[o1](x, p);
    return { p, r, pasos: [[`${textoTalCual(y)} ${TEXTO[o2]} ${textoTalCual(z)}`, p], [`${textoTalCual(x)} ${TEXTO[o1]} ${texto(p)}`, r]] };
  }
  const p = OP[o1](x, y);
  const r = OP[o2](p, z);
  return { p, r, pasos: [[`${textoTalCual(x)} ${TEXTO[o1]} ${textoTalCual(y)}`, p], [`${texto(p)} ${TEXTO[o2]} ${textoTalCual(z)}`, r]] };
}

// Lo que da de izquierda a derecha, sin jerarquía (error 12).
function deIzquierdaADerecha(fs, ops) {
  const [x, y, z] = fs;
  const p = OP[ops[0]](x, y);
  return p.n < 0 ? null : OP[ops[1]](p, z);
}

function aceptable(r) {
  return r.n > 0 && r.d <= 60 && Math.abs(r.n) <= 99;
}

// Sin séptimos ni onceavos: con tres fracciones, un 7 o un 11 lleva el
// denominador común a 77 o a 132 y la combinada pasa a ser de multiplicar
// (visto al imprimirla: 3/5 − 4/11 : 2/3 = 3/55).
const DENOMINADORES = [2, 3, 4, 5, 6, 8, 9, 10, 12];

function unaDeLaForma(azar, forma, conParentesis) {
  const fs = [0, 1, 2].map(() => fraccionPropia(azar, { denominadores: DENOMINADORES }));
  if (fs.some((f) => !f)) return null;
  return { fs, forma, conParentesis };
}

function bateria(azar, cuantos, formas, { conParentesis }) {
  let i = 0;
  return reuneApartados(() => {
    // Se reintenta DENTRO de la forma: si un intento fallido pasara a la
    // siguiente, las formas que más se rechazan desaparecerían y la batería
    // saldría con la misma forma tres veces (visto impreso).
    const forma = formas[i % formas.length];
    i += 1;
    for (let k = 0; k < 80; k += 1) {
      const intento = unaDeLaForma(azar, forma, conParentesis);
      const apartado = intento && apartadoDe(intento);
      if (apartado) return apartado;
    }
    return null;
  }, { cuantos, intentos: 40, clave: (a) => a.texto }).apartados;
}

function apartadoDe({ fs, forma, conParentesis }) {
  let res;
  try { res = resuelve(fs, forma); } catch { return null; }
  // Un resultado intermedio entero ("5/6 + 1/6 = 1") deja el segundo paso
  // en multiplicar por 1: el ejercicio pierde la mitad.
  if (res.p.n <= 0 || res.p.d === 1 || !aceptable(res.r)) return null;
  let sinJerarquia = null;
  if (!conParentesis) {
    try { sinJerarquia = deIzquierdaADerecha(fs, forma.ops); } catch { sinJerarquia = null; }
    if (sinJerarquia && sinJerarquia.n * res.r.d === res.r.n * sinJerarquia.d) return null;
  }
  const par = conParentesis ? forma.parentesis : null;
  const expLatex = escribe(fs, forma.ops, par, latexTalCual, (o) => LATEX[o]).replace(/\(/g, "\\left(").replace(/\)/g, "\\right)");
  const expTexto = escribe(fs, forma.ops, par, textoTalCual, (o) => TEXTO[o]);
  const quePrimero = conParentesis ? "Primero el paréntesis" : "Primero el producto o el cociente";
  return {
    latex: `$${expLatex} =$ ___`,
    latexResuelto: `$${expLatex} = ${latex(res.r)}$`,
    texto: `${expTexto} = ___`,
    solucion: texto(res.r),
    sinJerarquia: sinJerarquia && sinJerarquia.n > 0 ? texto(sinJerarquia) : null,
    razon: `${quePrimero}: ${res.pasos[0][0]} = ${texto(res.pasos[0][1])}. Después: ${res.pasos[1][0]} = ${texto(res.pasos[1][1])}.`,
  };
}

// ── "Operaciones combinadas" (dificultad 2) ─────────────────────────────
export function combinadaFracciones(azar, { cuantos = 3 } = {}) {
  return {
    clave: "combinada_fracciones",
    arquetipo: "Resuelve operaciones combinadas con fracciones",
    enunciado: "Calcula respetando la jerarquía, y simplifica:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados: bateria(azar, cuantos, azar.mezcla(SIN_PARENTESIS), { conParentesis: false }),
  };
}

// ── "Operaciones combinadas con paréntesis" (dificultad 3) ──────────────
export function combinadaConParentesis(azar, { cuantos = 2 } = {}) {
  return {
    clave: "combinada_fracciones_parentesis",
    arquetipo: "Resuelve operaciones combinadas con fracciones y paréntesis",
    enunciado: "Calcula empezando por el paréntesis, y simplifica:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    apartados: bateria(azar, cuantos, azar.mezcla(CON_PARENTESIS), { conParentesis: true }),
  };
}
