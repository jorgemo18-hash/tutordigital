import { num, op, neg, evaluar, render, OPERADORES } from "./expresion.js";

// LOS PASOS DE UNA OPERACIÓN COMBINADA, escritos como los escribe un profesor
// en la pizarra:
//
//   2 · [4 - 3 · (-10 + 12) - (6 - 8)]
//   = 2 · [4 - 3 · 2 - (-2)]
//   = 2 · [4 - 6 + 2]
//   = 2 · 0 = 0
//
// POR QUÉ NO BASTA CON DECIR LA REGLA. El apartado más difícil de la hoja es
// justo este, y su ejemplo resuelto es lo más valioso de la página. La primera
// versión ponía "el paréntesis manda: primero se resuelve lo de dentro y
// después la operación de fuera", que es verdad y no resuelve nada: el alumno
// que se pierde en una combinada no se pierde en la regla, se pierde a mitad
// del desarrollo.
//
// LA ÚNICA PARTE DELICADA ES EL ORDEN DE LOS PASOS, y ahí me equivoqué
// primero. Reduciendo el árbol por la izquierda en profundidad, la expresión
// `4 - 6 - (6 - 8)` hacía `4 - 6` ANTES del paréntesis. El resultado final
// salía bien, pero el desarrollo enseñaba un procedimiento incorrecto — que
// es peor que no enseñar ninguno, porque el alumno lo copia.
//
// El orden correcto se decide por dos cosas, en este orden:
//
//   1. CUÁNTOS PARÉNTESIS LO ENCIERRAN. Lo de más dentro va primero, siempre.
//   2. QUÉ APRIETA MÁS. A igual nivel de paréntesis, el producto antes que la
//      suma.
//
// Y a igualdad de las dos, de izquierda a derecha.

// Hasta dónde se desarrolla. Una combinada de 1.º ESO se resuelve en cuatro o
// cinco pasos; el tope existe para que un árbol raro no deje el generador
// girando dentro de una petición web.
const TOPE_PASOS = 12;

// EL MENOS DE LAS EXPLICACIONES, en un solo sitio.
//
// Vive aquí y no en `explicacion.js` —que es donde se usa más— por una razón
// de dependencias: `explicacion.js` importa de este archivo, así que si la
// constante estuviera allí y este la importara, los dos módulos se
// importarían en círculo.
//
// Y existe porque la explicación es TEXTO PLANO: no pasa por KaTeX, así que
// el carácter que se escriba es el que se imprime. `render()` usa el guion
// ASCII, que es lo correcto para un log o un test, y en el folio quedaba la
// mezcla de los dos glifos en la misma hoja: las explicaciones de signos con
// menos tipográfico y las de jerarquía con guion.
export const MENOS = "\u2212";

// Pasa un desarrollo de `render()` a la tipografía de las explicaciones. Solo
// se le aplica a las etapas, que llevan números, operadores y paréntesis y
// nada más: no hay ningún guion que no sea un menos.
function conMenosDeVerdad(texto) {
  return texto.replace(/-/g, MENOS);
}

// Los nodos que ya se pueden calcular —los dos operandos son números— con el
// nivel de paréntesis que los encierra y lo que aprieta su operador.
//
// El NIVEL se calcula con el mismo criterio que usa el renderizador para
// decidir si envuelve algo (ver `imprime` en expresion.js): si el padre
// aprieta más que el hijo, el hijo va entre paréntesis y por tanto está un
// nivel más adentro. Dicho de otra forma: el nivel que se cuenta aquí es el
// que el alumno VE en el papel, no la profundidad del árbol.
function reducibles(nodo, nivel = 0, ruta = []) {
  if (nodo.tipo === "num") return [];

  if (nodo.tipo === "neg") {
    // `-(...)`: lo de dentro está un nivel más adentro salvo que sea un
    // número suelto, que no lleva paréntesis propios.
    const dentro = nodo.hijo;
    if (dentro.tipo === "num") {
      return [{ ruta, nivel, precedencia: 4 }];
    }
    return reducibles(dentro, nivel + 1, [...ruta, "hijo"]);
  }

  const { precedencia } = OPERADORES[nodo.simbolo];
  const nivelHijo = (hijo, lado) => {
    if (hijo.tipo === "num") return nivel;
    const suya = hijo.tipo === "neg" ? 2 : OPERADORES[hijo.simbolo].precedencia;
    const envuelto = precedencia > suya
      || (precedencia === suya && lado === "der" && !OPERADORES[nodo.simbolo].asociativa)
      || nodo.simbolo === "^";
    return envuelto ? nivel + 1 : nivel;
  };

  const dentro = [
    ...reducibles(nodo.izq, nivelHijo(nodo.izq, "izq"), [...ruta, "izq"]),
    ...reducibles(nodo.der, nivelHijo(nodo.der, "der"), [...ruta, "der"]),
  ];
  if (dentro.length) return dentro;

  // Los dos operandos son números: este nodo ya se puede calcular.
  return [{ ruta, nivel, precedencia }];
}

// El siguiente paso que daría un alumno: lo de más dentro, y a igual
// profundidad lo que más aprieta.
function siguiente(arbol) {
  const candidatos = reducibles(arbol);
  if (!candidatos.length) return null;
  return candidatos.reduce((mejor, c) => {
    if (c.nivel !== mejor.nivel) return c.nivel > mejor.nivel ? c : mejor;
    if (c.precedencia !== mejor.precedencia) return c.precedencia > mejor.precedencia ? c : mejor;
    return mejor;
  });
}

function nodoEn(arbol, ruta) {
  return ruta.reduce((n, paso) => n[paso], arbol);
}

// Devuelve un árbol NUEVO con el nodo de `ruta` sustituido por su valor. No
// se muta nada: cada paso del desarrollo es un árbol independiente, que es lo
// que permite imprimirlos todos.
function conNodoResuelto(arbol, ruta) {
  const objetivo = nodoEn(arbol, ruta);
  const { valor } = evaluar(objetivo);
  if (valor === null) return null;
  const sustituye = (nodo, resto) => {
    if (!resto.length) return num(valor);
    const [paso, ...cola] = resto;
    if (nodo.tipo === "neg") return neg(sustituye(nodo.hijo, cola));
    return paso === "izq"
      ? op(nodo.simbolo, sustituye(nodo.izq, cola), nodo.der)
      : op(nodo.simbolo, nodo.izq, sustituye(nodo.der, cola));
  };
  return sustituye(arbol, ruta);
}

// Las etapas del desarrollo, ya escritas, SIN incluir la expresión de
// partida: esa ya está impresa en el enunciado del apartado.
export function pasosDeJerarquia(arbol, opciones = {}) {
  const etapas = [];
  let actual = arbol;
  for (let i = 0; i < TOPE_PASOS; i += 1) {
    const paso = siguiente(actual);
    if (!paso) break;
    const reducido = conNodoResuelto(actual, paso.ruta);
    if (!reducido) break;
    actual = reducido;
    etapas.push(conMenosDeVerdad(render(actual, opciones)));
  }
  return etapas;
}

// EL ENCABEZADO SE SACA DEL PRIMER PASO, no se escribe fijo.
//
// "Primero lo de dentro del paréntesis" es falso en `8 - 2 · 3`, donde no hay
// ningún paréntesis, y decirlo igualmente enseña a buscar algo que no está.
// Así que se mira qué ha mandado de verdad en el primer paso: la profundidad
// o el operador.
function encabezado(primero) {
  if (!primero) return "";
  if (primero.nivel > 0) return "Primero lo de dentro del paréntesis";
  if (primero.precedencia >= 2) return "El producto y el cociente aprietan más que la suma";
  return "De izquierda a derecha";
}

// La explicación de una combinada: el desarrollo entero en una línea.
//
// Se dice ANTES qué manda, porque el desarrollo solo enseña si se sabe qué se
// está mirando; y el último paso ya es el resultado, así que no se repite.
export function explicaJerarquia(arbol, valor, opciones = {}) {
  const etapas = pasosDeJerarquia(arbol, opciones);
  if (!etapas.length) return null;
  // SI EL DESARROLLO NO TERMINA EN LA SOLUCIÓN, NO SE IMPRIME. Es la
  // comprobación que impide publicar un razonamiento que lleva a otro número
  // que el del apartado: el alumno lo seguiría hasta una respuesta que el
  // folio dice que está mal.
  if (etapas[etapas.length - 1] !== conMenosDeVerdad(String(valor))) return null;
  return `${encabezado(siguiente(arbol))}: = ${etapas.join(" = ")}.`;
}
