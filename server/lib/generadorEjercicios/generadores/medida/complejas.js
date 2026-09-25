import { reuneApartados } from "../../ejercicio.js";
import { texto, alAzar, dec, suma } from "../decimales/decimal.js";
import { MAGNITUDES, convierte } from "./unidades.js";

// MEDIDA, OBJETIVO 3: FORMA COMPLEJA E INCOMPLEJA Y SUMAR MEDIDAS
// (concepto 3). Saber B.1: «… operaciones adecuadas en problemas que
// impliquen medida».
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   4 sumar medidas en unidades distintas sin pasarlas a la misma
//     (2,5 km + 350 m = 352,5 m);
//   6 pasar a forma incompleja juntando las cifras sin mirar los escalones
//     que faltan (3 km 4 hm 5 m = 345 m, cuando es 3405 m).

const LINEALES = ["longitud", "masa", "capacidad"];

// ── "Pasa a forma incompleja" (dificultad 2) ────────────────────────────
// De 4 a 6: tres unidades de la escalera con un hueco en medio (km, hm y
// m: falta el dam), para que "juntar las cifras" no funcione.
export function aFormaIncompleja(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const magnitud = LINEALES[i % 3];
    const u = MAGNITUDES[magnitud].unidades;
    // Tres escalones consecutivos con uno saltado: i, i+1, i+3.
    const inicio = azar.entero(0, u.length - 4);
    const usadas = [inicio, inicio + 1, inicio + 3];
    const cifras = usadas.map(() => azar.entero(1, 9));
    const destino = u[usadas[2]];
    // El valor en la unidad más pequeña que aparece: cada cifra por su
    // posición.
    const valor = usadas.reduce((s, p, k) => s + cifras[k] * 10 ** (usadas[2] - p), 0);
    i += 1;
    const frase = usadas.map((p, k) => `${cifras[k]} ${u[p]}`).join(" ");
    return {
      latex: `${frase} = ___ ${destino}`,
      latexResuelto: `${frase} = ${texto(dec(valor))} ${destino}`,
      texto: `${frase} = ___ ${destino}`,
      solucion: texto(dec(valor)),
      juntando: cifras.join(""),
      razon: `En la escalera, del ${u[usadas[0]]} al ${destino} hay 3 escalones: ${cifras[0]} ${u[usadas[0]]} = ${cifras[0] * 1000} ${destino}, `
        + `${cifras[1]} ${u[usadas[1]]} = ${cifras[1] * 100} ${destino} y ${cifras[2]} ${destino}. No hay ${u[inicio + 2]}: su cifra es 0. Total, ${texto(dec(valor))} ${destino}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "a_forma_incompleja",
    arquetipo: "Pasa una medida de forma compleja a incompleja",
    enunciado: "Expresa en una sola unidad:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── "Suma medidas" (dificultad 2) ───────────────────────────────────────
// De 4 a 6 sumas de dos medidas en unidades distintas, con el resultado
// en la unidad que se pide.
export function sumaDeMedidas(azar, { cuantos = 4 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const magnitud = LINEALES[i % 3];
    const u = MAGNITUDES[magnitud].unidades;
    const j = azar.entero(0, u.length - 3);
    // Dos o tres escalones entre las dos unidades.
    const [grande, pequena] = [u[j], u[Math.min(j + azar.entero(2, 3), u.length - 1)]];
    const a = alAzar(azar, { e: 1, min: 1, max: 9 });
    const b = dec(azar.entero(12, 900));
    if (!a) return null;
    const enPequena = suma(convierte(magnitud, a, grande, pequena), b);
    if (enPequena.e > 0) return null;
    i += 1;
    return {
      latex: `${texto(a)} ${grande} + ${texto(b)} ${pequena} = ___ ${pequena}`,
      latexResuelto: `${texto(a)} ${grande} + ${texto(b)} ${pequena} = ${texto(enPequena)} ${pequena}`,
      texto: `${texto(a)} ${grande} + ${texto(b)} ${pequena} = ___ ${pequena}`,
      solucion: texto(enPequena),
      sinPasar: texto(suma(a, b)),
      razon: `Primero, todo en ${pequena}: ${texto(a)} ${grande} = ${texto(convierte(magnitud, a, grande, pequena))} ${pequena}. Después se suma: ${texto(convierte(magnitud, a, grande, pequena))} + ${texto(b)} = ${texto(enPequena)} ${pequena}.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "suma_de_medidas",
    arquetipo: "Suma medidas expresadas en unidades distintas",
    enunciado: "Calcula (pasa antes todo a la misma unidad):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
