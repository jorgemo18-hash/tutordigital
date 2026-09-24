import { reuneApartados } from "../../ejercicio.js";
import { milesLatex, milesTexto } from "./formato.js";

// POTENCIAS Y RAÍCES, OBJETIVO 4: RAÍCES CUADRADAS (conceptos 6 y 7).
// Saber A.3: «Relaciones inversas entre las operaciones (… elevar al
// cuadrado y extraer la raíz cuadrada)».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   7 confundir la raíz cuadrada con la mitad (√16 = 8);
//   8 en la raíz entera, dar de resto la diferencia con la RAÍZ y no con su
//     cuadrado (√50: raíz 7, "resto 43").

// Los cuadrados que se saben de memoria (2² a 15²) y los de decenas
// redondas, que se sacan con la tabla del 1 al 9 y los ceros.
const RAICES_EXACTAS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// ── "Raíz cuadrada exacta" (dificultad 1) ───────────────────────────────
// De 6 a 8. Siempre una de decenas redondas (√3600) y ninguna de un número
// cuya mitad sea también su raíz (√4 = 2 = 4 : 2: el error 7 no se vería).
export function raizExacta(azar, { cuantos = 6 } = {}) {
  // UNA de decenas redondas y el resto de la tabla (3² a 15²). Mezcladas
  // sin más, salían cuatro redondas de seis (visto impreso): la batería
  // pasaba a ser de contar ceros.
  const redondas = RAICES_EXACTAS.filter((r) => r >= 20);
  const deTabla = RAICES_EXACTAS.filter((r) => r > 2 && r < 20);
  const plan = [azar.elige(redondas), ...azar.mezcla(deTabla)];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const r = plan[i];
    i += 1;
    if (r === undefined) return null;
    const n = r * r;
    return {
      latex: `$\\sqrt{${milesLatex(n)}} =$ ___`,
      latexResuelto: `$\\sqrt{${milesLatex(n)}} = ${r}$`,
      texto: `√${milesTexto(n)} = ___`,
      solucion: r,
      numero: n,
      razon: `${r} · ${r} = ${milesTexto(n)}, así que √${milesTexto(n)} = ${r}.`,
    };
  }, { cuantos, clave: (a) => String(a.numero) });

  return {
    clave: "raiz_exacta",
    arquetipo: "Calcula la raíz cuadrada exacta",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

// Un número que no es cuadrado perfecto, hasta 250.
function noCuadrado(azar) {
  const n = azar.entero(10, 250);
  const r = Math.floor(Math.sqrt(n));
  return r * r === n ? null : { n, r };
}

// ── "¿Entre qué dos números está la raíz?" (dificultad 2) ───────────────
export function raizEntreDos(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const c = noCuadrado(azar);
    if (!c) return null;
    const { n, r } = c;
    return {
      latex: `$\\sqrt{${n}}$ está entre ___ y ___`,
      latexResuelto: `$\\sqrt{${n}}$ está entre $${r}$ y $${r + 1}$`,
      texto: `√${n} está entre ___ y ___`,
      solucion: `${r} y ${r + 1}`,
      numero: n,
      razon: `${r}² = ${r * r} y ${r + 1}² = ${(r + 1) * (r + 1)}; ${n} está entre los dos.`,
    };
  }, { cuantos, clave: (a) => String(a.solucion) });

  return {
    clave: "raiz_entre_dos",
    arquetipo: "Di entre qué dos números naturales está la raíz",
    enunciado: "Completa con dos números naturales seguidos:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "Raíz entera y resto" (dificultad 2) ────────────────────────────────
export function raizEntera(azar, { cuantos = 4 } = {}) {
  const { apartados } = reuneApartados(() => {
    const c = noCuadrado(azar);
    if (!c) return null;
    const { n, r } = c;
    const resto = n - r * r;
    return {
      latex: `$\\sqrt{${n}}$: raíz ___, resto ___`,
      latexResuelto: `$\\sqrt{${n}}$: raíz $${r}$, resto $${resto}$`,
      texto: `√${n}: raíz ___, resto ___`,
      solucion: `${r}, resto ${resto}`,
      numero: n,
      raiz: r,
      razon: `${r}² = ${r * r} no pasa de ${n} y ${r + 1}² = ${(r + 1) * (r + 1)} sí: raíz ${r}. `
        + `Resto: ${n} − ${r * r} = ${resto}.`,
    };
  }, { cuantos, clave: (a) => String(a.raiz) });

  return {
    clave: "raiz_entera",
    arquetipo: "Calcula la raíz cuadrada entera y el resto",
    enunciado: "Calcula la raíz entera y el resto:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
