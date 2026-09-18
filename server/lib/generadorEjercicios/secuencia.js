import { op, num } from "./expresion.js";

// UNA SECUENCIA PLANA DE NÚMEROS Y OPERADORES, Y SUS DOS MANERAS DE
// EVALUARLA: `[4, "+", 5, "-", 6, "·", 2]`.
//
// ¿POR QUÉ HACE FALTA ESTO SI YA HAY ÁRBOLES? Porque el arquetipo de
// operaciones combinadas pide una condición que NO se puede comprobar con un
// árbol solo:
//
//   *"El objetivo es que el orden importe: si da lo mismo operar de izquierda
//   a derecha, el ejercicio no sirve."*
//
// Un árbol ya lleva la jerarquía dentro, así que evaluarlo da siempre el
// resultado correcto. Para saber si el orden importa hay que calcular TAMBIÉN
// el resultado equivocado —el que sale operando de izquierda a derecha— y
// comprobar que son distintos. Y eso se hace sobre la secuencia plana, que es
// justo lo que el alumno ve escrito.
//
// La secuencia es la fuente de la verdad y el árbol se deriva de ella: así lo
// que se compara es lo mismo que se imprime. Si se construyera el árbol a mano
// y la secuencia aparte, podrían decir cosas distintas y el ejercicio saldría
// con una solución que no le corresponde.

const PRIORITARIOS = new Set(["·", ":"]);
const SUMAS = new Set(["+", "-"]);

function aplica(simbolo, a, b) {
  switch (simbolo) {
    case "+": return a + b;
    case "-": return a - b;
    case "·": return a * b;
    case ":": return b === 0 || a % b !== 0 ? null : a / b;
    default: return null;
  }
}

function valida(piezas) {
  if (!Array.isArray(piezas) || piezas.length < 3 || piezas.length % 2 === 0) return false;
  for (let i = 0; i < piezas.length; i += 1) {
    const esOperador = i % 2 === 1;
    if (esOperador && !PRIORITARIOS.has(piezas[i]) && !SUMAS.has(piezas[i])) return false;
    if (!esOperador && !Number.isInteger(piezas[i])) return false;
  }
  return true;
}

// EL ÁRBOL CON LA JERARQUÍA PUESTA. Dos pasadas, que es exactamente como se
// explica en clase: primero los productos y cocientes, después las sumas y
// restas, y las dos de izquierda a derecha.
export function arbolDeSecuencia(piezas) {
  if (!valida(piezas)) throw new Error(`secuencia inválida: ${JSON.stringify(piezas)}`);

  // Primera pasada: se contraen los `·` y `:`, que aprietan más.
  const nivel = [piezas[0]];
  for (let i = 1; i < piezas.length; i += 2) {
    const simbolo = piezas[i];
    const derecha = piezas[i + 1];
    if (PRIORITARIOS.has(simbolo)) {
      const izquierda = nivel.pop();
      nivel.push(op(simbolo, izquierda, derecha));
    } else {
      nivel.push(simbolo, derecha);
    }
  }

  // Segunda pasada: lo que queda son sumas y restas, asociando a la izquierda.
  let arbol = typeof nivel[0] === "number" ? num(nivel[0]) : nivel[0];
  for (let i = 1; i < nivel.length; i += 2) {
    arbol = op(nivel[i], arbol, nivel[i + 1]);
  }
  return arbol;
}

// EL RESULTADO EQUIVOCADO: operando de izquierda a derecha sin mirar la
// jerarquía. Es el error que el ejercicio quiere provocar, así que hay que
// poder calcularlo. Devuelve null si por el camino sale una división no
// exacta (lo cual también cuenta como "distinto", pero se trata aparte).
export function valorDeIzquierdaADerecha(piezas) {
  if (!valida(piezas)) return null;
  let valor = piezas[0];
  for (let i = 1; i < piezas.length; i += 2) {
    valor = aplica(piezas[i], valor, piezas[i + 1]);
    if (valor === null) return null;
  }
  return valor;
}

// ¿IMPORTA EL ORDEN EN ESTA SECUENCIA?
//
// Es la condición que decide si el ejercicio vale. Y hay que tener cuidado con
// una trampa: `2 + 3 · 4` y `2 · 3 + 4` la cumplen, pero `2 + 3 + 4 · 1` no,
// y tampoco `0 · 5 + 3`. Con números pequeños las coincidencias salen más a
// menudo de lo que uno espera, así que se comprueba, no se supone.
//
// Una secuencia SIN ningún `·` ni `:` nunca la cumple: sin jerarquía, operar
// de izquierda a derecha ES el orden correcto. Se descarta antes de calcular.
export function elOrdenImporta(piezas, valorCorrecto) {
  if (!valida(piezas)) return false;
  const tienePrioritario = piezas.some((p, i) => i % 2 === 1 && PRIORITARIOS.has(p));
  if (!tienePrioritario) return false;
  const aLaBruta = valorDeIzquierdaADerecha(piezas);
  // Si a la bruta sale una división no exacta, el orden importa de la
  // manera más evidente posible: el camino equivocado no llega a ningún
  // número entero.
  if (aLaBruta === null) return true;
  return aLaBruta !== valorCorrecto;
}
