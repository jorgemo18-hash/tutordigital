import { suma, resta, cadena, neg } from "../expresion.js";
import { apartadoDeExpresion, reuneApartados } from "../ejercicio.js";

// GENERADORES DE SUMA Y RESTA DE ENTEROS (objetivos 3 y 4 de Números
// enteros, conceptos 7, 8 y 9 del catálogo).
//
// Cada generador de este archivo corresponde a un arquetipo ya sembrado en
// `contenido_arquetipos`, y **cumple sus instrucciones por construcción**.
// Eso es lo que justifica que aquí no intervenga ningún modelo: las
// instrucciones de esos arquetipos son restricciones exactas —"cubre los
// cuatro casos de signos", "reparte a mitades cuál tiene mayor valor
// absoluto", "varía la posición del hueco"— y una restricción exacta se
// cumple con código o se aproxima con un modelo. No hay una tercera opción.
//
// Lo que un modelo sí hará, y no está aquí, es la prosa: los problemas con
// enunciado (termómetro, ascensor, deuda) y el ejemplo resuelto de la
// cabecera.

// ── Objetivo 3: sumar y restar ────────────────────────────────────────────

// "Suma dos enteros del mismo signo" (dificultad 1).
// Instrucción del catálogo: de 6 a 9 apartados, MEZCLANDO las dos escrituras
// (con paréntesis explícito y sin él). Las dos se leen igual de bien y el
// alumno tiene que reconocer ambas: `-6 + (-1)` y `-4 - 6`.
export function sumaMismoSigno(azar, { cuantos = 8, tope = 60 } = {}) {
  // CASI TODOS NEGATIVOS, y esto salió de mirar la primera tanda generada:
  // con el signo sorteado a partes iguales, la mitad de la batería eran
  // sumas como `84 + 42`, que un alumno de 1.º ESO hizo en primaria. No
  // practican nada de este tema. El contenido está en `-6 + (-1)` y en
  // `-4 - 6`. Se deja un positivo o dos para que no se conteste todo con
  // signo negativo por patrón, pero no la mitad.
  let positivosPuestos = 0;
  const { apartados } = reuneApartados(() => {
    const puedePositivo = positivosPuestos < Math.max(1, Math.floor(cuantos / 5));
    const signo = puedePositivo && azar.suerte(0.3) ? 1 : -1;
    if (signo > 0) positivosPuestos += 1;
    const a = signo * azar.entero(2, tope);
    const b = signo * azar.entero(2, tope);
    // La mitad de las veces se escribe como resta de un positivo, que es
    // la otra forma de la misma operación cuando los dos son negativos.
    const comoResta = signo < 0 && azar.suerte(0.5);
    const arbol = comoResta ? resta(a, Math.abs(b)) : suma(a, b);
    return apartadoDeExpresion(arbol, { tope: tope * 2 }).apartado;
  }, { cuantos });

  return {
    clave: "suma_mismo_signo",
    arquetipo: "Suma dos enteros del mismo signo",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// "Suma dos enteros de distinto signo" (dificultad 1).
// Instrucción: reparte A MITADES cuál de los dos tiene mayor valor absoluto,
// "para que el signo del resultado no sea siempre el mismo". Es el detalle
// que impide que el alumno acierte por patrón sin mirar los números.
export function sumaDistintoSigno(azar, { cuantos = 8, tope = 99 } = {}) {
  let mandaElNegativo = azar.suerte(0.5);
  const { apartados } = reuneApartados(() => {
    // Se alterna en vez de sortear: con 8 apartados, sortear deja a veces
    // 7 de un lado, que es justo lo que la instrucción quiere evitar.
    mandaElNegativo = !mandaElNegativo;
    const grande = azar.entero(10, tope);
    const pequeno = azar.entero(2, grande - 1);
    const [pos, neg2] = mandaElNegativo ? [pequeno, -grande] : [grande, -pequeno];
    // Y también se alterna el orden de los sumandos, para que el negativo
    // no esté siempre en el mismo sitio.
    const arbol = azar.suerte(0.5) ? suma(neg2, pos) : suma(pos, neg2);
    return apartadoDeExpresion(arbol, { tope: tope * 2 }).apartado;
  }, { cuantos });

  return {
    clave: "suma_distinto_signo",
    arquetipo: "Suma dos enteros de distinto signo",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// Los cuatro casos de signos de una resta. El orden se mezcla, pero LOS
// CUATRO SALEN: es la instrucción del arquetipo y es lo que convierte la
// batería en un diagnóstico en vez de en relleno.
const CASOS_RESTA = [
  [1, 1],   // (+) - (+)
  [1, -1],  // (+) - (-)
  [-1, 1],  // (-) - (+)
  [-1, -1], // (-) - (-)
];

// "Resta dos enteros escritos con paréntesis" (dificultad 1).
// Instrucción: de 6 a 8 apartados cubriendo los cuatro casos de signos. "Es
// la batería que aísla el error de no ver el signo del número."
//
// Se imprime con `parentesisSiempre`, que es como lo escribe el catálogo
// (`(-19) - (-21)`, `(+40) - (-15)`): en esta batería lo que se practica es
// precisamente separar el signo del número del signo de la operación.
export function restaConParentesis(azar, { cuantos = 8, tope = 50 } = {}) {
  // Primero uno de cada caso, y el resto al azar. Así los cuatro están
  // garantizados aunque `cuantos` sea 4, y con 8 no se repite ninguno.
  const obligatorios = azar.mezcla(CASOS_RESTA);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const [sa, sb] = i < obligatorios.length ? obligatorios[i] : azar.elige(CASOS_RESTA);
    i += 1;
    const a = sa * azar.entero(2, tope);
    const b = sb * azar.entero(2, tope);
    return apartadoDeExpresion(resta(a, b), { tope: tope * 2, parentesisSiempre: true }).apartado;
  }, { cuantos });

  return {
    clave: "resta_con_parentesis",
    arquetipo: "Resta dos enteros escritos con paréntesis",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// "Halla el término que falta" (dificultad 2).
// Instrucción: de 4 a 6 igualdades con un hueco en uno de los sumandos, y
// VARIANDO la posición del hueco. Cubre el saber A.3, "relaciones inversas
// entre las operaciones", que el currículo pide expresamente.
//
// El hueco NO es una expresión: es un enunciado con un espacio. Así que aquí
// el apartado se compone a mano, pero la SOLUCIÓN se calcula con el árbol
// completo — nunca a ojo.
export function terminoQueFalta(azar, { cuantos = 5, tope = 30 } = {}) {
  let huecoDetras = azar.suerte(0.5);
  const { apartados } = reuneApartados(() => {
    huecoDetras = !huecoDetras;
    const a = azar.signo() * azar.entero(2, tope);
    const b = azar.signo() * azar.entero(2, tope);
    const operador = azar.suerte(0.5) ? "+" : "-";
    const completa = operador === "+" ? suma(a, b) : resta(a, b);
    const { apartado } = apartadoDeExpresion(completa, { tope: tope * 2 });
    if (!apartado) return null;
    const total = apartado.solucion;

    // Se tapa uno de los dos términos. La solución es el término tapado, y
    // se lee del árbol que ya se ha resuelto: no se recalcula aparte.
    const visible = huecoDetras ? a : b;
    const oculto = huecoDetras ? b : a;
    // EL HUECO VA FUERA DEL LaTeX, y no es una cuestión de estilo.
    //
    // La plantilla convierte `___` en un `<span>` subrayado ANTES de que
    // KaTeX recorra la hoja (ver hoja/js/huecos.js y formulasDeLaHoja.js), y
    // KaTeX no empareja un `$` de apertura con uno de cierre que estén en
    // lados distintos de un elemento. Si el hueco quedara DENTRO de la
    // fórmula, el `$` se partiría en dos mitades desparejadas y el apartado
    // saldría impreso en crudo, con los dólares a la vista.
    //
    // Así que cada par `$...$` se cierra por su cuenta y el hueco va en
    // medio: `$-20+$ ___ $=-36$`. Es exactamente lo que hace la hoja de
    // muestra (`"$|{-15}| =$ ___"`).
    // La posición decide los paréntesis, igual que en el renderizador de
    // expresiones: a la IZQUIERDA un negativo va desnudo (`-20 + ___`), y a
    // la DERECHA va envuelto (`___ - (-11)`), porque `___ - -11` no es
    // notación de libro. El texto plano y el LaTeX dicen lo mismo a
    // propósito: si divergieran, un test que lee el texto daría por bueno un
    // folio que se imprime distinto.
    const visibleLatex = huecoDetras ? String(visible) : enLatex(visible);
    const visibleTexto = visibleLatex;
    // EL `\\;` ES AIRE, y también salió de mirar el folio: sin él se imprimía
    // `8+______ = 25`, con el signo pegado al subrayado. KaTeX cierra su caja
    // justo detrás del `+` y el hueco empieza pegado.
    const latex = huecoDetras
      ? `$${visibleLatex}${signoDe(operador)}\\;$ ___ $=${total}$`
      : `___ $\\;${signoDe(operador)}${visibleLatex}=${total}$`;
    const izqTexto = huecoDetras
      ? `${visibleTexto} ${operador} ___`
      : `___ ${operador} ${visibleTexto}`;
    return {
      latex,
      texto: `${izqTexto} = ${total}`,
      arbol: completa,
      solucion: oculto,
    };
  }, { cuantos });

  return {
    clave: "termino_que_falta",
    arquetipo: "Halla el término que falta",
    enunciado: "Completa con el número que falta:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// "Cadena de sumas y restas sin paréntesis" (dificultad 2).
// Instrucción: de 4 a 7 términos, sin paréntesis, resultado siempre entero
// de una o dos cifras, y de 3 a 4 apartados.
export function cadenaSumasRestas(azar, { cuantos = 4, terminos = null, tope = 30 } = {}) {
  const { apartados } = reuneApartados(() => {
    const n = terminos || azar.entero(4, 7);
    const piezas = [azar.signo() * azar.entero(1, 9)];
    for (let k = 1; k < n; k += 1) {
      piezas.push(azar.suerte(0.5) ? "+" : "-", azar.entero(1, 9));
    }
    // TIENE QUE LLEVAR LAS DOS OPERACIONES, y esto salió de mirar el folio
    // impreso: el primer apartado era `-1 + 8 + 8 + 1`, una cadena de solo
    // sumas. El arquetipo se llama "cadena de sumas Y RESTAS" y lo que
    // ejercita es alternar; con un solo signo no ejercita nada y encima
    // parece un descuido.
    const operadores = piezas.filter((x) => typeof x === "string");
    if (!operadores.includes("+") || !operadores.includes("-")) return null;
    // El tope aquí es el de la instrucción: "resultado de una o dos cifras".
    return apartadoDeExpresion(cadena(piezas), { tope }).apartado;
  }, { cuantos });

  return {
    clave: "cadena_sumas_restas",
    arquetipo: "Cadena de sumas y restas sin paréntesis",
    enunciado: "Calcula, operando de izquierda a derecha:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    lineas: 2,
    apartados,
  };
}

// ── Objetivo 4: quitar paréntesis y signos ────────────────────────────────

// "Elimina los paréntesis y calcula" (dificultad 2).
// Instrucción: UN SOLO nivel de paréntesis, de 3 a 4 apartados, y al menos
// dos con un signo menos delante del paréntesis — que es lo que se está
// practicando. Sin esa condición, la mitad de la batería no ejercita nada.
export function eliminaParentesis(azar, { cuantos = 4, tope = 40 } = {}) {
  let conMenosDelante = false;
  let hechosConMenos = 0;
  const { apartados } = reuneApartados(() => {
    // Se fuerza el menos delante hasta tener dos; después, al azar.
    conMenosDelante = hechosConMenos < 2 ? true : azar.suerte(0.5);
    const dentroA = azar.signo() * azar.entero(1, 12);
    const dentroB = azar.entero(1, 12);
    const grupo = azar.suerte(0.5) ? resta(dentroA, dentroB) : suma(dentroA, dentroB);
    const fuera = azar.signo() * azar.entero(1, 12);

    // Dos formas del mismo tipo de ejercicio: `-7 - (8 - 10)` y
    // `-(-3 + 10) + 7`. La segunda usa el menos unario, que es el caso que
    // de verdad cuesta.
    const arbol = conMenosDelante
      ? (azar.suerte(0.5) ? resta(fuera, grupo) : suma(neg(grupo), fuera))
      : suma(fuera, grupo);

    const { apartado } = apartadoDeExpresion(arbol, { tope });
    if (apartado && conMenosDelante) hechosConMenos += 1;
    return apartado;
  }, { cuantos });

  return {
    clave: "elimina_parentesis",
    arquetipo: "Elimina los paréntesis y calcula",
    enunciado: "Quita los paréntesis y calcula:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    lineas: 2,
    apartados,
  };
}

// ── Auxiliares de impresión de los huecos ─────────────────────────────────

function signoDe(operador) {
  return operador === "+" ? "+" : "-";
}

// Un negativo a la derecha de un operador se envuelve; un positivo, no.
function enLatex(n) {
  return n < 0 ? `(${n})` : String(n);
}
