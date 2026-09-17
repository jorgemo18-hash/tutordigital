import { pot, neg } from "../expresion.js";
import { apartadoDeExpresion, reuneApartados } from "../ejercicio.js";

// GENERADORES DE POTENCIAS DE BASE ENTERA (segunda mitad del objetivo 5,
// concepto 11 del catálogo).
//
// Separado de `producto.js` aunque comparta objetivo: el concepto es otro (la
// paridad del exponente, no la regla de los signos) y las restricciones no se
// parecen en nada.
//
// LO QUE NO SE PUEDE CALCULAR A MANO NO ENTRA. En 1.º ESO no hay calculadora
// (confirmado por Jorge), así que una potencia o es pequeña o se resuelve por
// una regla sin calcular nada. `(-9)^4` da 6561, es un entero perfectamente
// válido para el evaluador, y sin embargo como ejercicio no mide potencias de
// enteros: mide paciencia multiplicando. De ahí la tabla de abajo.
//
// El caso que sí lleva exponente enorme es `(-1)^2375`, y lleva exponente
// enorme A PROPÓSITO: es imposible hacerlo multiplicando, así que el alumno
// que lo resuelve es el que ha entendido la regla de paridad. El catálogo lo
// pone por eso.

// Hasta dónde puede llegar la base para cada exponente, para que la potencia
// siga saliendo de cabeza.
const BASE_MAXIMA = { 2: 12, 3: 5, 4: 3 };
const EXPONENTES = [2, 3, 4];

// Un exponente "grande" de verdad: de tres o cuatro cifras, como el del
// catálogo. Con base ±1 la paridad lo resuelve entero.
function exponenteGrande(azar) {
  return azar.entero(101, 2999);
}

// "Calcula potencias de base entera" (dificultad 2).
// Instrucción: de 5 a 8 apartados, incluyendo SIEMPRE al menos una base
// negativa con exponente par, otra con impar, y alguna potencia de -1 y de +1
// con exponente grande, "que es donde se ve si ha entendido la regla o la
// está calculando".
//
// Esos cuatro casos son obligatorios, así que se colocan primero y el resto
// se sortea. Si se sortearan todos, una tanda de cinco apartados se quedaría
// sin el caso impar la mitad de las veces, y la batería dejaría de distinguir
// lo único que pretende distinguir.
export function potenciasDeBaseEntera(azar, { cuantos = 6 } = {}) {
  const obligatorios = [
    () => baseNegativaConParidad(azar, "par"),
    () => baseNegativaConParidad(azar, "impar"),
    () => pot(-1, exponenteGrande(azar)),
    () => pot(1, exponenteGrande(azar)),
  ];
  const pendientes = azar.mezcla(obligatorios);
  let i = 0;
  // EN LOS HUECOS LIBRES, BASE NEGATIVA CASI SIEMPRE, y esto salió de mirar
  // la primera tanda: los dos apartados libres habían salido `2^2` y `3^3`.
  // Son potencias correctas y no practican nada de este tema; el alumno las
  // hizo en primaria. Se deja UNA base positiva como contraste, para que no
  // se pueda contestar "negativo" por patrón sin mirar el exponente, pero no
  // la mitad de la batería.
  let positivasPuestas = 0;

  const { apartados } = reuneApartados(() => {
    let arbol;
    if (i < pendientes.length) {
      arbol = pendientes[i]();
    } else {
      const puedePositiva = positivasPuestas < 1;
      const positiva = puedePositiva && azar.suerte(0.4);
      if (positiva) positivasPuestas += 1;
      arbol = unaPotenciaCualquiera(azar, positiva ? 1 : -1);
    }
    i += 1;
    // `parentesisSiempre` no hace falta: la base negativa de una potencia va
    // entre paréntesis SIEMPRE y eso lo decide el renderizador, porque sin
    // ellos la expresión significaría otra cosa.
    return apartadoDeExpresion(arbol, {}).apartado;
  }, { cuantos, clave: claveSinSigno });

  return {
    clave: "potencias_base_entera",
    arquetipo: "Calcula potencias de base entera",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// DOS POTENCIAS NO SE DIFERENCIAN SOLO POR EL SIGNO DE LA BASE, y esto salió
// de mirar una tanda: en la misma hoja aparecían `(-2)^4 = ___` y
// `2^4 = ___`. Para el descarte por texto son distintas; para el alumno son
// el mismo apartado dos veces con la misma respuesta, y encima parece un
// descuido del que hizo la hoja. La pareja `(-3)^2` / `-3^2` sí tiene sentido
// —pero con el menos FUERA, y esa es otra batería (`paresConYSinParentesis`).
function claveSinSigno(apartado) {
  const a = apartado.arbol;
  if (a?.tipo === "op" && a.simbolo === "^" && a.izq.tipo === "num" && a.der.tipo === "num") {
    return `${Math.abs(a.izq.valor)}^${a.der.valor}`;
  }
  return apartado.texto;
}

function baseNegativaConParidad(azar, paridad) {
  const posibles = EXPONENTES.filter((e) => (e % 2 === 0) === (paridad === "par"));
  const exponente = azar.elige(posibles);
  // Desde 2: `(-1)^3` no ejercita la base, ejercita la paridad, y para eso ya
  // están los apartados de exponente grande.
  const base = -azar.entero(2, BASE_MAXIMA[exponente]);
  return pot(base, exponente);
}

function unaPotenciaCualquiera(azar, signo) {
  const exponente = azar.elige(EXPONENTES);
  const base = signo * azar.entero(2, BASE_MAXIMA[exponente]);
  return pot(base, exponente);
}

// "Distingue (-3)^2 de -3^2, justificando" (dificultad 3).
// Instrucción: dos o tres PAREJAS de expresiones que solo se diferencian en
// el paréntesis, pidiendo el resultado de cada una y por qué son distintas.
//
// TRES DECISIONES QUE MERECEN EXPLICACIÓN:
//
// 1. Cada miembro de la pareja es su propio apartado, no un apartado doble.
//    Con `columnas: 2` la hoja los coloca uno al lado del otro, que es la
//    única forma en la que la pareja enseña algo: los mismos números, el
//    mismo exponente, y lo único distinto a la vista. De paso cada apartado
//    conserva UNA solución numérica, como todos los demás del sistema.
//
// 2. La pareja se imprime en el orden `(-3)^2` y luego `-3^2`. No se sortea:
//    el primero es el que el alumno espera y el segundo es el que le
//    sorprende, y ese orden es el que provoca la pregunta.
//
// 3. LA JUSTIFICACIÓN NO SE CORRIGE AUTOMÁTICAMENTE, y conviene decirlo aquí
//    en vez de descubrirlo después: las soluciones de esta batería son los
//    dos números, y el "por qué" lo lee una persona. Es el único arquetipo de
//    este archivo que no se corrige del todo solo, y es también el que más
//    dice del alumno.
export function paresConYSinParentesis(azar, { pares = 2 } = {}) {
  const apartados = [];
  const basesUsadas = new Set();
  for (let intento = 0; intento < 20 && apartados.length < pares * 2; intento += 1) {
    // SIEMPRE EXPONENTE 2, y lo decide la propia instrucción del arquetipo:
    // "es razonamiento, no cálculo". Con exponente 4 la pareja sigue siendo
    // correcta —`(-3)^4 = 81` y `-3^4 = -81`— pero añade una multiplicación
    // de cuatro factores a un ejercicio cuya dificultad tenía que ser
    // entender dónde está el menos. Es el ejemplo del catálogo, además.
    const exponente = 2;
    const base = azar.entero(2, BASE_MAXIMA[exponente]);
    // Solo exponente PAR. Con impar las dos expresiones dan el mismo número
    // (`(-2)^3 = -8` y `-2^3 = -8`) y la pareja demostraría lo contrario de
    // lo que pretende: que el paréntesis no importa.
    if (basesUsadas.has(`${base}^${exponente}`)) continue;
    const conParentesis = apartadoDeExpresion(pot(-base, exponente), {}).apartado;
    const sinParentesis = apartadoDeExpresion(neg(pot(base, exponente)), {}).apartado;
    if (!conParentesis || !sinParentesis) continue;
    // La comprobación que da sentido al par, con el evaluador y no a ojo.
    if (conParentesis.solucion === sinParentesis.solucion) continue;
    basesUsadas.add(`${base}^${exponente}`);
    apartados.push(conParentesis, sinParentesis);
  }

  return {
    clave: "pares_con_y_sin_parentesis",
    arquetipo: "Distingue (-3)^2 de -3^2, justificando",
    enunciado: "Calcula cada una y explica por qué las dos de cada fila no dan lo mismo:",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 2,
    lineas: 2,
    apartados,
  };
}
