import { reuneApartados } from "../../ejercicio.js";
import { escribe, expresion, expresionL, tabla } from "./escritura.js";

// FUNCIONES, OBJETIVO 2: TABLAS Y EXPRESIONES (conceptos 2 y 3). Saber D.5:
// «Relaciones lineales: … tablas, gráficas o expresiones algebraicas».
//
// Solo relaciones LINEALES y = ax + b con a y b enteros: son las que nombra
// D.5 en 1.º.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   3 sustituir un negativo sin su signo (y = 2x + 1 con x = −2 → 5);
//   4 intercambiar la parte fija y la que multiplica (una tabla que va de 3
//     en 3 y empieza en 1 → y = x + 3 en vez de y = 3x + 1).

const XS = [-2, -1, 0, 1, 2];

// ── "Completa la tabla de valores" (dificultad 1) ───────────────────────
export function completaTablaFuncion(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(-4, 4);
    const b = azar.entero(-5, 5);
    if (a === 0 || b === 0) return null;
    const ys = XS.map((x) => a * x + b);
    const vacia = tabla(XS, XS.map(() => "\\;\\;\\;"));
    const llena = tabla(XS, ys);
    return {
      latex: `$y = ${expresionL(a, b)}$ $${vacia}$`,
      latexResuelto: `$y = ${expresionL(a, b)}$ $${llena}$`,
      texto: `y = ${expresion(a, b)}; x: ${XS.map(escribe).join(", ")} → y: ___`,
      solucion: ys.map(escribe),
      sinSigno: XS.map((x) => escribe(a * Math.abs(x) + b)),
      razon: `Se sustituye cada x, con su signo y entre paréntesis si es negativa: ${XS.slice(0, 2).map((x) => `${escribe(a)} · (${escribe(x)}) ${b < 0 ? "−" : "+"} ${Math.abs(b)} = ${escribe(a * x + b)}`).join("; ")}…`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "completa_tabla_funcion",
    arquetipo: "Completa la tabla de valores de la relación",
    enunciado: "Completa la tabla de valores:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Escribe la expresión a partir de la tabla" (dificultad 2) ──────────
export function tablaAExpresion(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(2, 6) * (azar.suerte(0.25) ? -1 : 1);
    const b = azar.entero(-6, 6);
    if (b === 0 || Math.abs(b) === Math.abs(a)) return null;
    const xs = [0, 1, 2, 3, 4];
    const ys = xs.map((x) => a * x + b);
    return {
      latex: `$${tabla(xs, ys)}$ $y =$ ___`,
      latexResuelto: `$${tabla(xs, ys)}$ $y = ${expresionL(a, b)}$`,
      texto: `x: ${xs.join(", ")} | y: ${ys.map(escribe).join(", ")} → y = ___`,
      solucion: expresion(a, b),
      cambiada: expresion(b, a),
      razon: `Cada vez que x sube 1, y ${a > 0 ? "sube" : "baja"} ${Math.abs(a)}: es ${expresion(a, 0)}. Para x = 0, y vale ${escribe(b)}: se ${b > 0 ? "suma" : "resta"} ${Math.abs(b)}. y = ${expresion(a, b)}.`,
    };
  }, { cuantos, clave: (a) => a.solucion });

  return {
    clave: "tabla_a_expresion",
    arquetipo: "Escribe la expresión de la relación a partir de su tabla",
    enunciado: "Escribe la expresión algebraica de cada tabla:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
