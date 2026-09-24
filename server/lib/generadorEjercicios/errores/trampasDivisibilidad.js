import { factoriza, desdeFactores, mcd, mcm } from "../generadores/divisibilidad/aritmetica.js";

// LAS RESPUESTAS-TRAMPA DEL TEMA DIVISIBILIDAD: qué escribiría un alumno con
// cada error predecible de la migración 135 (los ocho con `predecible =
// true`). Mismo contrato que las de enteros (trampasDelApartado.js): no se
// imprimen, van con la hoja guardada, y solo se apunta un error si su
// respuesta es DISTINTA de la correcta.
//
// LOS NÚMEROS DE ERROR SON LOS DE ESTE TEMA (su `orden` en la migración 135),
// no los de enteros: el error 5 de enteros es la regla de los signos y el 5
// de aquí es confundir m.c.d. y m.c.m. Una hoja guardada sabe de qué tema es,
// y con eso se lee el número.
export const ERRORES_DIVISIBILIDAD = [
  { numero: 1, id: "c2000000-0000-4000-8000-000000000201", categoria: "conceptual", corto: "Confunde múltiplo y divisor" },
  { numero: 2, id: "c2000000-0000-4000-8000-000000000202", categoria: "procedimiento", corto: "Olvida el 1 y el propio número entre los divisores" },
  { numero: 3, id: "c2000000-0000-4000-8000-000000000203", categoria: "conceptual", corto: "Aplica al 3 el criterio de la última cifra" },
  { numero: 4, id: "c2000000-0000-4000-8000-000000000204", categoria: "conceptual", corto: "Cree que un impar es primo" },
  { numero: 5, id: "c2000000-0000-4000-8000-000000000205", categoria: "conceptual", corto: "Confunde el m.c.d. con el m.c.m." },
  { numero: 6, id: "c2000000-0000-4000-8000-000000000206", categoria: "procedimiento", corto: "m.c.d. con los comunes al mayor exponente" },
  { numero: 7, id: "c2000000-0000-4000-8000-000000000207", categoria: "procedimiento", corto: "m.c.m. multiplicando los dos números" },
  { numero: 8, id: "c2000000-0000-4000-8000-000000000208", categoria: "operacion", corto: "Potencia como base por exponente" },
];

// Error 3: "divisible por 3" si acaba en 0, 3, 6 o 9.
const pareceDeTres = (n) => [0, 3, 6, 9].includes(n % 10);

function divisiblesConError3(n) {
  const lista = [2, 3, 5, 10].filter((k) => (k === 3 ? pareceDeTres(n) : n % k === 0));
  return lista.length ? lista : "ninguno";
}

// Con el hueco al final, quien tiene el error 3 elige las cifras que hacen
// que el número ACABE como un múltiplo de 3. Con el hueco en medio el error
// no deja una respuesta (la última cifra ya está puesta), y no se apunta.
function cifrasConError3({ cifras, posicion, divisores }) {
  if (posicion !== cifras.length - 1 || !divisores.includes(3)) return null;
  const valen = [];
  for (let c = 0; c <= 9; c += 1) {
    const n = Number(cifras.map((x, k) => (k === posicion ? c : x)).join(""));
    if (divisores.every((d) => (d === 3 ? pareceDeTres(n) : n % d === 0))) valen.push(c);
  }
  return valen.length ? valen : null;
}

// Error 6: los comunes, pero con el MAYOR exponente.
function mcdConMayorExponente([a, b]) {
  const fb = new Map(factoriza(b));
  return desdeFactores(factoriza(a).filter(([p]) => fb.has(p)).map(([p, e]) => [p, Math.max(e, fb.get(p))]));
}

// Error 8: cada potencia como base por exponente.
const conPotenciaMalHecha = (factores) => factores.reduce((acc, [p, e]) => acc * (e === 1 ? p : p * e), 1);

const esImparCompuesto = (n) => n % 2 === 1 && n > 1 && [3, 5, 7, 11, 13].some((p) => p < n && n % p === 0);

export const TRAMPAS_DIVISIBILIDAD = {
  // Quien confunde las dos palabras contesta a la pregunta al revés, y la
  // pregunta al revés (¿es el grande divisor del pequeño?) siempre es "no".
  es_multiplo_o_divisor: () => [{ error: 1, respuesta: "no" }],
  todos_los_divisores: (a) => [{ error: 2, respuesta: a.solucion.filter((d) => d !== 1 && d !== a.numero) }],
  divisible_por: (a) => [{ error: 3, respuesta: divisiblesConError3(a.numero) }],
  cifra_que_falta: (a) => [{ error: 3, respuesta: cifrasConError3(a) }],
  primo_o_compuesto: (a) => (esImparCompuesto(a.numero) ? [{ error: 4, respuesta: "primo" }] : []),
  numero_desde_factores: (a) => [{ error: 8, respuesta: conPotenciaMalHecha(a.factores) }],
  mcd_de_dos: (a) => [
    { error: 5, respuesta: mcm(...a.pareja) },
    { error: 6, respuesta: mcdConMayorExponente(a.pareja) },
  ],
  mcm_de_dos: (a) => [
    { error: 5, respuesta: mcd(...a.pareja) },
    { error: 7, respuesta: a.pareja[0] * a.pareja[1] },
  ],
  mcd_y_mcm_de_tres: (a) => [{ error: 5, respuesta: a.solucion.replace(/m\.c\.d\. = (\d+); m\.c\.m\. = (\d+)/, "m.c.d. = $2; m.c.m. = $1") }],
  problemas_mcm: (a) => [{ error: 5, respuesta: a.otra }],
  problemas_mcd: (a) => [{ error: 5, respuesta: a.otra }],
  problemas_mezclados: (a) => [{ error: 5, respuesta: a.otra }],
};
