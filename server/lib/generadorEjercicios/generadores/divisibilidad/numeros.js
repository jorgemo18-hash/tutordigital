import { factoriza, mcd, mcm } from "./aritmetica.js";

// CÓMO SE ELIGEN LOS NÚMEROS de las baterías de m.c.d. y m.c.m. (y de sus
// problemas). Aparte de los generadores porque lo usan dos archivos, y
// aparte de aritmetica.js porque esto no es aritmética: es criterio de qué
// números merecen salir en una hoja.

// El hueco LARGO de la hoja (nueve guiones o más, ver
// assets/shared/hoja/js/huecos.js): para las respuestas que son una lista o
// una descomposición, que en un hueco normal no caben.
export const HUECO_LARGO = "_________";

// Sin primos grandes: dividir entre 17 no se hace de cabeza en 1.º.
export const PRIMOS_PEQUENOS = [2, 3, 5, 7, 11, 13];
export const soloPrimosPequenos = (n) => factoriza(n).every(([p]) => PRIMOS_PEQUENOS.includes(p));

// Dos números con algún factor común y sin que uno divida al otro: con
// m.c.d. = 1 los errores del m.c.m. no se distinguen de la respuesta buena,
// y si uno divide al otro el m.c.d. se ve sin calcular.
export function parejaInteresante(azar, { desde, hasta, topeMcm = Infinity, mcdMinimo = 2 }) {
  for (let intento = 0; intento < 200; intento += 1) {
    const a = azar.entero(desde, hasta);
    const b = azar.entero(desde, hasta);
    if (a === b || a % b === 0 || b % a === 0) continue;
    if (mcd(a, b) < mcdMinimo || mcm(a, b) > topeMcm) continue;
    if (!soloPrimosPequenos(a) || !soloPrimosPequenos(b)) continue;
    return a < b ? [a, b] : [b, a];
  }
  return null;
}
