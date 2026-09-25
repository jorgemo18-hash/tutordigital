import { reuneApartados } from "../../ejercicio.js";
import { termino, textoDe, latexDe, numeroTexto, conParentesis } from "./terminos.js";

// ÁLGEBRA, OBJETIVOS 4 Y 5: ECUACIONES DE PRIMER GRADO (conceptos 5, 6 y 7).
//
// SOLUCIONES ENTERAS Y PEQUEÑAS, siempre: en 1.º ESO no se deja calculadora
// (Jorge, 17/9, claude/algebra-1eso-metodo.md), así que una ecuación que dé
// 23/7 es una hoja inservible. Se construye al revés: primero la x, después
// la ecuación que la tiene de solución.
//
// EL MÉTODO DEL EJEMPLO ES LA TRANSPOSICIÓN ("pasa restando"), que es el que
// enseña Jorge. El de sumar lo mismo en los dos lados da los mismos
// ejercicios y las mismas soluciones: solo cambiaría la explicación, y
// queda para cuando el centro pueda elegirlo.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR (con respuesta-trampa):
//   5 pasar un término sin cambiarle el signo (x + 6 = 14 → x = 20);
//   6 pasar restando lo que multiplica (3x = 12 → x = 9);
//   7 en ax + b = c, dividir antes de pasar el término (x = c : a − b);
//   8 quitar un paréntesis multiplicando solo el primer término.

const MENOS = "−";
const ecLatex = (izq, der) => `${latexDe(izq)} = ${latexDe(der)}`;
const ecTexto = (izq, der) => `${textoDe(izq)} = ${textoDe(der)}`;

function aApartado({ izq, der, x, razon, extra = {} }) {
  const eL = ecLatex(izq, der);
  return {
    latex: `$${eL} \\qquad x =$ ___`,
    latexResuelto: `$${eL} \\qquad x = ${x}$`,
    texto: `${ecTexto(izq, der)} → x = ___`,
    solucion: x,
    razon,
    ...extra,
  };
}

// ── "¿Es solución?" (dificultad 1) ──────────────────────────────────────
// De 5 a 7, mitad sí y mitad no. Enseña QUÉ es una solución antes de
// buscarla: el número que hace cierta la igualdad.
export function compruebaSolucion(azar, { cuantos = 5 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const x = azar.entero(-3, 9);
    const a = azar.entero(2, 6);
    const b = azar.entero(-9, 9);
    if (b === 0) return null;
    const c = a * x + b;
    const esSolucion = i % 2 === 0;
    i += 1;
    const propuesto = esSolucion ? x : x + azar.elige([-2, -1, 1, 2]);
    const izq = [termino(a, true), termino(b)];
    const valor = a * propuesto + b;
    const frase = `¿Es $x = ${propuesto}$ solución de $${latexDe(izq)} = ${c}$?`;
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} ${esSolucion ? "Sí" : "No"}`,
      texto: `¿Es x = ${numeroTexto(propuesto)} solución de ${textoDe(izq)} = ${numeroTexto(c)}? ___`,
      solucion: esSolucion ? "sí" : "no",
      propuesto,
      razon: `Se sustituye: ${a} · ${conParentesis(propuesto)} ${b < 0 ? MENOS : "+"} ${Math.abs(b)} = ${numeroTexto(valor)}`
        + (esSolucion ? `, que es ${numeroTexto(c)}: sí.` : `, y no ${numeroTexto(c)}: no.`),
    };
    // Un número distinto en cada apartado: con "¿Es x = 6…?" cuatro veces
    // de siete la hoja parece copiada.
  }, { cuantos, clave: (a) => String(a.propuesto) });

  return {
    clave: "comprueba_solucion",
    arquetipo: "Comprueba si el número es solución de la ecuación",
    enunciado: "Sustituye y contesta sí o no:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Ecuaciones de un paso: sumas y restas" (dificultad 1) ──────────────
// x + a = b, x − a = b y a + x = b, con la x entre −5 y 15.
export function ecuacionSumaResta(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const x = azar.entero(-5, 15);
    const a = azar.entero(2, 12);
    const forma = i % 3;
    i += 1;
    const signo = forma === 1 ? -1 : 1;
    const b = x + signo * a;
    const izq = forma === 2 ? [termino(a), termino(1, true)] : [termino(1, true), termino(signo * a)];
    const der = [termino(b)];
    const como = signo > 0 ? `está sumando: pasa restando. x = ${numeroTexto(b)} ${MENOS} ${a}` : `está restando: pasa sumando. x = ${numeroTexto(b)} + ${a}`;
    return aApartado({
      izq, der, x,
      razon: `El ${a} ${como} = ${numeroTexto(x)}.`,
      // Error 5: se pasa sin cambiar el signo.
      extra: { conError5: signo > 0 ? b + a : b - a },
    });
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ecuacion_suma_resta",
    arquetipo: "Resuelve ecuaciones de un paso con sumas y restas",
    enunciado: "Resuelve:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Ecuaciones de un paso: productos y cocientes" (dificultad 1) ───────
// ax = b y x : a = b. Con x : a, la x es múltiplo de a (para que "x : a"
// sea exacto también antes de resolver).
export function ecuacionProductoCociente(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const a = azar.entero(2, 9);
    const producto = i % 3 !== 2;
    i += 1;
    if (producto) {
      const x = azar.entero(-6, 12);
      if (x === 0) return null;
      const b = a * x;
      return aApartado({
        izq: [termino(a, true)], der: [termino(b)], x,
        razon: `El ${a} está multiplicando a la x: pasa dividiendo. x = ${numeroTexto(b)} : ${a} = ${numeroTexto(x)}.`,
        extra: { conError6: b - a },
      });
    }
    const b = azar.entero(2, 12);
    const x = a * b;
    const eL = `\\dfrac{x}{${a}} = ${b}`;
    return {
      latex: `$${eL} \\qquad x =$ ___`,
      latexResuelto: `$${eL} \\qquad x = ${x}$`,
      texto: `x/${a} = ${b} → x = ___`,
      solucion: x,
      razon: `El ${a} está dividiendo a la x: pasa multiplicando. x = ${b} · ${a} = ${x}.`,
      conError6: Number.isInteger(b / a) ? b / a : null,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ecuacion_producto_cociente",
    arquetipo: "Resuelve ecuaciones de un paso con productos y cocientes",
    enunciado: "Resuelve:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Ecuaciones de dos pasos: ax + b = c" (dificultad 2) ────────────────
export function ecuacionDosPasos(azar, { cuantos = 5 } = {}) {
  const { apartados } = reuneApartados(() => {
    const x = azar.suerte(0.25) ? -azar.entero(1, 6) : azar.entero(1, 12);
    const a = azar.entero(2, 9);
    const b = azar.entero(1, 15) * (azar.suerte(0.4) ? -1 : 1);
    const c = a * x + b;
    const pasa = b > 0 ? `pasa restando: ${a}x = ${numeroTexto(c)} ${MENOS} ${b}` : `pasa sumando: ${a}x = ${numeroTexto(c)} + ${-b}`;
    const ax = c - b;
    const conError7 = Number.isInteger(c / a) ? c / a - b : null;
    return aApartado({
      izq: [termino(a, true), termino(b)], der: [termino(c)], x,
      razon: `Primero el número: el ${Math.abs(b)} ${b > 0 ? "está sumando" : "está restando"} y ${pasa} = ${numeroTexto(ax)}. `
        + `Después el ${a}, que multiplica, pasa dividiendo: x = ${numeroTexto(ax)} : ${a} = ${numeroTexto(x)}.`,
      extra: {
        conError5: Number.isInteger((c + b) / a) ? (c + b) / a : null,
        conError7,
      },
    });
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ecuacion_dos_pasos",
    arquetipo: "Resuelve ecuaciones de la forma ax + b = c",
    enunciado: "Resuelve:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "La x en los dos lados" (dificultad 2) ──────────────────────────────
// ax + b = cx + d, con a ≠ c y a > c casi siempre (el coeficiente final
// positivo, que es el caso de 1.º).
export function ecuacionXDosLados(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const x = azar.suerte(0.2) ? -azar.entero(1, 5) : azar.entero(1, 10);
    const c = azar.entero(1, 6);
    const a = c + azar.entero(1, 5);
    const b = azar.entero(-12, 12);
    const d = (a - c) * x + b;
    if (b === 0 || d === 0 || d === b) return null;
    const k = a - c;
    const n = d - b;
    const cx = c === 1 ? "x" : `${c}x`;
    return aApartado({
      izq: [termino(a, true), termino(b)], der: [termino(c, true), termino(d)], x,
      razon: `Las x a la izquierda y los números a la derecha, cambiando de signo lo que pasa: ${a}x ${MENOS} ${cx} = ${numeroTexto(d)} ${b > 0 ? MENOS : "+"} ${Math.abs(b)}. `
        + `${k === 1 ? "x" : `${k}x`} = ${numeroTexto(n)}${k === 1 ? "" : `, x = ${numeroTexto(n)} : ${k} = ${numeroTexto(x)}`}.`,
      extra: { conError5: Number.isInteger(n / (a + c)) ? n / (a + c) : null },
    });
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ecuacion_x_dos_lados",
    arquetipo: "Resuelve ecuaciones con la x en los dos miembros",
    enunciado: "Resuelve:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Con paréntesis" (dificultad 3) ─────────────────────────────────────
// a(x + b) = c y a(x + b) = cx + d. Primero se quita el paréntesis.
export function ecuacionConParentesis(azar, { cuantos = 3 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const x = azar.entero(-3, 10);
    const a = azar.entero(2, 5);
    const b = azar.entero(1, 9) * (azar.suerte(0.4) ? -1 : 1);
    const conXDerecha = i % 2 === 1;
    i += 1;
    const c = conXDerecha ? azar.entero(1, a - 1 || 1) : 0;
    if (conXDerecha && c >= a) return null;
    const d = a * (x + b) - c * x;
    const dentroL = `x ${b < 0 ? "-" : "+"} ${Math.abs(b)}`;
    const dentroT = `x ${b < 0 ? MENOS : "+"} ${Math.abs(b)}`;
    const der = conXDerecha ? [termino(c, true), termino(d)] : [termino(d)];
    if (der.every((t) => t.coef === 0)) return null;
    const eL = `${a}(${dentroL}) = ${latexDe(der)}`;
    const eT = `${a}(${dentroT}) = ${textoDe(der)}`;
    const quitado = textoDe([termino(a, true), termino(a * b)]);
    const k = a - c;
    const n = d - a * b;
    // Error 8: solo se multiplica el primer término: ax + b = …
    const n8 = d - b;
    return {
      latex: `$${eL} \\qquad x =$ ___`,
      latexResuelto: `$${eL} \\qquad x = ${x}$`,
      texto: `${eT} → x = ___`,
      solucion: x,
      conError8: Number.isInteger(n8 / k) ? n8 / k : null,
      razon: `Primero el paréntesis, multiplicando los dos términos: ${quitado} = ${textoDe(der)}. `
        + `Después se agrupa: ${k === 1 ? "x" : `${k}x`} = ${numeroTexto(n)}${k === 1 ? "" : `, x = ${numeroTexto(n)} : ${k} = ${numeroTexto(x)}`}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "ecuacion_con_parentesis",
    arquetipo: "Resuelve ecuaciones con paréntesis",
    enunciado: "Quita primero el paréntesis y resuelve:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
