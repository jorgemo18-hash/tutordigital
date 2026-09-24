import { reuneApartados } from "../../ejercicio.js";
import { latexTalCual, textoTalCual } from "./fraccion.js";
import { fraccionPropia } from "./eleccion.js";
import { nombreDeParte } from "./lenguaje.js";

// FRACCIONES, OBJETIVO 1: LA FRACCIÓN DE UNA CANTIDAD (concepto 1).
//
// Es el primer uso de la fracción en 1.º ESO y el que más aparece en los
// problemas: "los 2/3 de 60". Siempre con resultado entero: la división
// entre el denominador es exacta.
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR (error 9 del tema): hacerlo al
// revés, dividir entre el numerador y multiplicar por el denominador.

// ── "Calcula la fracción de una cantidad" (dificultad 1) ────────────────
// De 6 a 8, con la cantidad múltiplo del denominador y hasta 240.
export function fraccionDeCantidad(azar, { cuantos = 6 } = {}) {
  const { apartados } = reuneApartados(() => {
    const f = fraccionPropia(azar);
    if (!f) return null;
    const cantidad = f.d * azar.entero(2, Math.floor(240 / f.d));
    const parte = cantidad / f.d;
    const solucion = parte * f.n;
    return {
      latex: `$${latexTalCual(f)}$ de $${cantidad} =$ ___`,
      latexResuelto: `$${latexTalCual(f)}$ de $${cantidad} = ${solucion}$`,
      texto: `${textoTalCual(f)} de ${cantidad} = ___`,
      solucion,
      fraccion: f,
      cantidad,
      razon: f.n === 1
        ? `Un ${nombreDeParte(f.d)} de ${cantidad}: ${cantidad} : ${f.d} = ${solucion}.`
        : `${cantidad} : ${f.d} = ${parte} es un ${nombreDeParte(f.d)}; ${f.n} ${nombreDeParte(f.d, true)} son ${parte} · ${f.n} = ${solucion}.`,
    };
  }, { cuantos, clave: (a) => `${a.fraccion.d}` });

  return {
    clave: "fraccion_de_cantidad",
    arquetipo: "Calcula la fracción de una cantidad",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "Halla el número del que se conoce una fracción" (dificultad 2) ─────
// De 3 a 5: "los 3/5 de un número son 24". Es la operación inversa, y la
// que hace falta en los problemas de "gasté 24 €, que eran los 3/5 de…".
export function cantidadDesdeFraccion(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const f = fraccionPropia(azar);
    if (!f || f.n === 1) return null;
    const unaParte = azar.entero(2, 20);
    const dato = unaParte * f.n;
    const solucion = unaParte * f.d;
    const frase = `Los $${latexTalCual(f)}$ de un número son $${dato}$. El número es`;
    return {
      latex: `${frase} ___`,
      latexResuelto: `${frase} $${solucion}$`,
      texto: `Los ${textoTalCual(f)} de un número son ${dato}. El número es ___`,
      solucion,
      fraccion: f,
      dato,
      razon: `${dato} son ${f.n} ${nombreDeParte(f.d, true)}: un ${nombreDeParte(f.d)} es ${dato} : ${f.n} = ${unaParte}. `
        + `El número entero son ${f.d} ${nombreDeParte(f.d, true)}: ${unaParte} · ${f.d} = ${solucion}.`,
    };
  }, { cuantos, clave: (a) => `${a.fraccion.n}/${a.fraccion.d}` });

  return {
    clave: "cantidad_desde_fraccion",
    arquetipo: "Halla el número del que se conoce una fracción",
    enunciado: "Halla el número:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
