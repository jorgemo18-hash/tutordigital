import { reuneApartados } from "../../ejercicio.js";
import { dec, suma, resta, texto, latex, alAzar, compara } from "./decimal.js";

// DECIMALES, OBJETIVO 3: SUMAR Y RESTAR (concepto 5). Saber A.3:
// «Operaciones con números enteros, fraccionarios o decimales…».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   4 colocar las cifras alineadas a la DERECHA, como con los enteros, y no
//     por la coma (2,5 + 1,25 → 25 + 125 = 150 → 1,50); por eso los dos
//     números tienen casi siempre distinto número de decimales;
//   5 al restar a un número entero, dejar las cifras decimales como están
//     (5 − 1,25 → 4,25).

// Lo que sale alineando a la derecha: las cifras sin coma sumadas (o
// restadas) y la coma donde la tiene el que más decimales tiene.
function alineadoALaDerecha(a, b, signo) {
  const r = signo > 0 ? a.n + b.n : a.n - b.n;
  return r > 0 ? texto(dec(r, Math.max(a.e, b.e))) : null;
}

// ── "Suma" (dificultad 1) ───────────────────────────────────────────────
// De 6 a 8 sumas de dos números con distinto número de decimales (algunas,
// un entero y un decimal).
export function sumaDecimales(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const ea = azar.entero(0, 2);
    const eb = azar.entero(1, 3);
    if (ea === eb) return null;
    const a = ea === 0 ? dec(azar.entero(2, 30)) : alAzar(azar, { e: ea, min: 0, max: 30 });
    const b = alAzar(azar, { e: eb, min: 0, max: 20 });
    if (!a || !b) return null;
    const r = suma(a, b);
    const e = Math.max(a.e, b.e);
    return {
      latex: `$${latex(a)} + ${latex(b)} =$ ___`,
      latexResuelto: `$${latex(a)} + ${latex(b)} = ${latex(r)}$`,
      texto: `${texto(a)} + ${texto(b)} = ___`,
      solucion: texto(r),
      alineado: alineadoALaDerecha(a, b, 1),
      razon: `Coma debajo de coma, completando con ceros: ${texto(a, e)} + ${texto(b, e)} = ${texto(r, e)}${r.e < e ? `, que es ${texto(r)}` : ""}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "suma_decimales",
    arquetipo: "Suma números decimales",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Resta" (dificultad 2) ──────────────────────────────────────────────
// De 6 a 8, con el primero siempre mayor y un tercio de las veces entero
// (5 − 1,25), que es donde está el error 5.
export function restaDecimales(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const deEntero = i % 3 === 0;
    i += 1;
    const eb = azar.entero(1, 3);
    const ea = deEntero ? 0 : azar.entero(1, 3);
    if (!deEntero && ea === eb) return null;
    const a = deEntero ? dec(azar.entero(2, 30)) : alAzar(azar, { e: ea, min: 1, max: 30 });
    const b = alAzar(azar, { e: eb, min: 0, max: 15 });
    if (!a || !b || compara(a, b) <= 0) return null;
    const r = resta(a, b);
    const e = Math.max(a.e, b.e);
    // Error 5: 5 − 1,25 → (5 − 1) y ",25" detrás.
    const entera = Math.floor(b.n / 10 ** b.e);
    const bajando = deEntero && a.n - entera > 0 ? `${a.n - entera},${String(b.n % 10 ** b.e).padStart(b.e, "0")}` : null;
    return {
      latex: `$${latex(a)} - ${latex(b)} =$ ___`,
      latexResuelto: `$${latex(a)} - ${latex(b)} = ${latex(r)}$`,
      texto: `${texto(a)} − ${texto(b)} = ___`,
      solucion: texto(r),
      alineado: deEntero ? null : alineadoALaDerecha(a, b, -1),
      bajando,
      razon: `Coma debajo de coma, completando con ceros${deEntero ? ` (${texto(a)} es ${texto(a, e)})` : ""}: ${texto(a, e)} − ${texto(b, e)} = ${texto(r, e)}${r.e < e ? `, que es ${texto(r)}` : ""}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "resta_decimales",
    arquetipo: "Resta números decimales",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
