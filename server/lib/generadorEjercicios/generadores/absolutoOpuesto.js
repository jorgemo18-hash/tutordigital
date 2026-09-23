import { reuneApartados } from "../ejercicio.js";
import { escribeNumero } from "../explicacion.js";

// OBJETIVO 2: VALOR ABSOLUTO Y OPUESTO (conceptos 3 y 4 del catálogo).
//
// A diferencia de las baterías de operaciones, aquí no hay expresión que
// evaluar: cada apartado es una definición aplicada a un número. Por eso los
// apartados traen su `razon` escrita (la usa ejemploResuelto.js cuando el
// apartado sale como ejemplo) en vez de sacarla de un árbol.
//
// LOS DOS ERRORES QUE ESTAS BATERÍAS TIENEN QUE PODER PROVOCAR, y que están
// sembrados en la migración 120: confundir el valor absoluto con el valor
// del número (`|-7| = -7`) y confundir el opuesto con el propio número o con
// el valor absoluto (`el opuesto de -6 es -6`). Los dos solo aparecen con
// NEGATIVOS, así que los negativos no pueden ser minoría.

// El valor absoluto en LaTeX. `\lvert…\rvert` y no dos `|`: con `|` suelto
// KaTeX no sabe cuál abre y cuál cierra, y el espacio a los lados del número
// sale desigual.
const absLatex = (n) => `\\lvert ${n} \\rvert`;
const absTexto = (n) => `|${n}|`;

// Un entero para estas baterías: casi siempre de una o dos cifras, y alguna
// vez de tres, que es lo que pide el arquetipo ("con algún número de dos o
// tres cifras") para que no valga hacerlo de memoria con la tabla del 1 al 9.
function unEntero(azar, { signo, grande = false } = {}) {
  const valor = grande ? azar.entero(100, 350) : azar.entero(1, 60);
  return signo < 0 ? -valor : valor;
}

// Reparte los signos: el 0 una vez, un número de tres cifras negativo, UN
// positivo como contraste y el resto negativos. Los casos fijos van primero;
// el último apartado, que es el que se convierte en ejemplo resuelto (ver
// ejemploResuelto.js), siempre es uno libre.
function valoresDeLaBateria(azar, cuantos) {
  const fijos = [0, unEntero(azar, { signo: -1, grande: true }), unEntero(azar, { signo: 1 })];
  const valores = azar.mezcla(fijos);
  // El segundo positivo solo si la batería es larga: con seis apartados y
  // dos positivos, la mitad de la hoja no practicaría lo que falla.
  let positivos = 1;
  while (valores.length < cuantos + 20) {
    const puedePositivo = positivos < 2 && cuantos >= 7;
    const positivo = puedePositivo && azar.suerte(0.25);
    if (positivo) positivos += 1;
    valores.push(unEntero(azar, { signo: positivo ? 1 : -1 }));
  }
  return valores;
}

// "Calcula el valor absoluto" (dificultad 1).
// Instrucción: de 6 a 8, mezclando positivos y negativos, con algún número
// de dos o tres cifras. Incluye |0| en algún apartado.
export function valorAbsoluto(azar, { cuantos = 6 } = {}) {
  const valores = valoresDeLaBateria(azar, cuantos);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const n = valores[i];
    i += 1;
    if (n === undefined) return null;
    const solucion = Math.abs(n);
    return {
      latex: `$${absLatex(n)}=$ ___`,
      latexResuelto: `$${absLatex(n)}=${solucion}$`,
      texto: `${absTexto(n)} = ___`,
      solucion,
      razon: razonAbsoluto(n),
    };
  // NO SE REPITE EL VALOR ABSOLUTO. `|-7|` y `|7|` en la misma batería se
  // contestan el segundo copiando el primero, sin pensar.
  }, { cuantos, clave: (a) => String(a.solucion) });

  return {
    clave: "valor_absoluto",
    arquetipo: "Calcula el valor absoluto",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

function razonAbsoluto(n) {
  if (n === 0) return "El 0 está en el cero: su distancia al cero es 0.";
  if (n > 0) return `Un positivo ya es su distancia al cero: se queda igual, ${n}.`;
  return `El valor absoluto es la distancia al cero, así que se quita el signo: `
    + `${absTexto(escribeNumero(n))} = ${-n}.`;
}

// "Escribe el opuesto" (dificultad 1).
// Instrucción: de 6 a 8, mezclando positivos y negativos. Incluye el 0.
export function escribeOpuesto(azar, { cuantos = 6 } = {}) {
  const valores = valoresDeLaBateria(azar, cuantos);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const n = valores[i];
    i += 1;
    if (n === undefined) return null;
    // `0 - n` y no `-n`: `-0` es un número distinto de `0` para JavaScript,
    // y en la hoja saldría "el opuesto de 0 es -0".
    const solucion = 0 - n || 0;
    return {
      latex: `El opuesto de $${n}$ es ___`,
      latexResuelto: `El opuesto de $${n}$ es $${solucion}$`,
      texto: `El opuesto de ${n} es ___`,
      solucion,
      razon: razonOpuesto(n, solucion),
    };
  }, { cuantos, clave: (a) => String(Math.abs(a.solucion)) });

  return {
    clave: "escribe_opuesto",
    arquetipo: "Escribe el opuesto",
    enunciado: "Completa:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

function razonOpuesto(n, opuesto) {
  if (n === 0) return "El 0 no tiene signo: su opuesto es él mismo, 0.";
  return `Mismo número y signo contrario: el opuesto de ${escribeNumero(n)} es ${escribeNumero(opuesto)}.`;
}

// "Expresiones encadenadas de opuesto y valor absoluto" (dificultad 2).
// Instrucción: enunciados en palabras que encadenan las dos definiciones,
// para aplicarlas en orden. De 4 a 6 apartados, no más de dos por apartado.
//
// LAS CUATRO FORMAS, y cada una está por algo:
//   - opuesto del valor absoluto de un NEGATIVO: da negativo, y es donde se
//     ve si se aplican en orden (el valor absoluto primero).
//   - valor absoluto del opuesto de un negativo: da positivo; puesta al lado
//     de la anterior, enseña que el orden cambia el resultado.
//   - opuesto del opuesto: vuelve al número de partida.
//   - opuesto del valor absoluto de un POSITIVO: el valor absoluto no hace
//     nada y solo cuenta el opuesto.
const FORMAS = [
  { palabras: "El opuesto del valor absoluto de", pasos: ["abs", "op"], signo: -1 },
  { palabras: "El valor absoluto del opuesto de", pasos: ["op", "abs"], signo: -1 },
  { palabras: "El opuesto del opuesto de", pasos: ["op", "op"], signo: 0 },
  { palabras: "El opuesto del valor absoluto de", pasos: ["abs", "op"], signo: 1 },
];

const APLICA = { abs: (x) => Math.abs(x), op: (x) => 0 - x || 0 };
const NOMBRE = { abs: "el valor absoluto", op: "el opuesto" };

export function encadenadosOpuestoAbsoluto(azar, { cuantos = 4 } = {}) {
  // Las cuatro formas primero (cada una es un caso distinto) y luego se
  // repiten sorteadas con otros números.
  const plan = [...azar.mezcla(FORMAS)];
  while (plan.length < cuantos + 20) plan.push(azar.elige(FORMAS));
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const forma = plan[i];
    i += 1;
    if (!forma) return null;
    const signo = forma.signo || azar.signo();
    const n = signo * azar.entero(2, 15);
    const intermedio = APLICA[forma.pasos[0]](n);
    const solucion = APLICA[forma.pasos[1]](intermedio);
    return {
      latex: `${forma.palabras} $${n}$: ___`,
      latexResuelto: `${forma.palabras} $${n}$: $${solucion}$`,
      texto: `${forma.palabras} ${n}: ___`,
      solucion,
      // La explicación va DE DENTRO AFUERA, que es el orden en que se hace y
      // el contrario al que se lee: "el opuesto del valor absoluto" empieza
      // por el valor absoluto. Es exactamente lo que la batería entrena.
      razon: `Primero lo de dentro: ${NOMBRE[forma.pasos[0]]} de ${escribeNumero(n)} es `
        + `${escribeNumero(intermedio)}. Después, ${NOMBRE[forma.pasos[1]]} de `
        + `${escribeNumero(intermedio)} es ${escribeNumero(solucion)}.`,
    };
  }, { cuantos });

  return {
    clave: "encadenados_opuesto_absoluto",
    arquetipo: "Expresiones encadenadas de opuesto y valor absoluto",
    enunciado: "Calcula, empezando por lo de dentro:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
