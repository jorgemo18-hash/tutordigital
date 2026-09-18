import { por, entre } from "../expresion.js";
import { apartadoDeExpresion, reuneApartados } from "../ejercicio.js";
import { conHueco, hayAlgunNegativo } from "./hueco.js";

// GENERADORES DE PRODUCTO Y COCIENTE DE ENTEROS (objetivo 5 de Números
// enteros, concepto 10 del catálogo: la regla de los signos).
//
// Las potencias, que son el otro medio objetivo 5, están en `potencias.js`:
// comparten el objetivo pero no el concepto ni las restricciones, y juntarlas
// aquí solo haría un archivo más largo.
//
// El hilo común de las cuatro baterías: LO QUE SE PRACTICA ES EL SIGNO, NO LA
// ARITMÉTICA. Lo dice el propio arquetipo del catálogo ("productos de la
// tabla de multiplicar, sin números grandes"), y tiene una consecuencia
// directa en el código: los factores salen del 2 al 10, no de un rango
// grande. Un producto como `-37 · 24` no añade dificultad de este tema, añade
// dificultad de multiplicar, y el alumno que falla ahí falla por otra cosa.

// Las cuatro combinaciones de signos. Igual que en la resta, LAS CUATRO
// SALEN siempre: es la instrucción del arquetipo y es lo que hace que la
// batería diagnostique en vez de rellenar.
const CASOS_SIGNO = [
  [1, 1],   // (+) · (+)
  [1, -1],  // (+) · (-)
  [-1, 1],  // (-) · (+)
  [-1, -1], // (-) · (-)
];

// Los tres casos que llevan algún negativo. Los usa el sorteo posterior.
const CASOS_CON_NEGATIVO = CASOS_SIGNO.filter(([a, b]) => a < 0 || b < 0);

// Reparte los cuatro casos obligatorios y luego sortea. Los dos generadores
// de dos operandos hacen exactamente lo mismo con esto, así que se comparte.
//
// DESPUÉS DE LOS CUATRO OBLIGATORIOS, EL SORTEO NO REPITE (+)·(+), y esto
// salió de mirar una hoja de refuerzo impresa: la batería de multiplicar tenía
// NUEVE apartados y cinco eran de dos positivos —`8 · 8`, `9 · 10`, `6 · 6`,
// `2 · 8`, `2 · 7`—, o sea media batería de tabla de multiplicar de primaria.
//
// El motivo es de aritmética simple: con `cuantos` grande, los cuatro
// obligatorios ocupan los primeros puestos y el resto se sortea entre los
// cuatro casos, así que uno de cada cuatro sale sin negativos y se acumulan.
// El caso (+)·(+) ya está cubierto por el reparto obligatorio; repetirlo no
// añade ni un signo que aplicar.
function repartidorDeSignos(azar) {
  const obligatorios = azar.mezcla(CASOS_SIGNO);
  let i = 0;
  return () => {
    const caso = i < obligatorios.length
      ? obligatorios[i]
      : azar.elige(CASOS_CON_NEGATIVO);
    i += 1;
    return caso;
  };
}

// "Multiplica dos enteros" (dificultad 1).
// Instrucción: de 6 a 8 apartados cubriendo las cuatro combinaciones de
// signos, con productos de la tabla de multiplicar.
//
// Se imprime con `parentesisSiempre`, como el catálogo: `(-3) · 5`. En esta
// batería el signo del número tiene que verse separado del de la operación.
export function multiplicaDosEnteros(azar, { cuantos = 8, tope = 10 } = {}) {
  const siguienteCaso = repartidorDeSignos(azar);
  const { apartados } = reuneApartados(() => {
    const [sa, sb] = siguienteCaso();
    // Desde 2: el 0 y el 1 no ejercitan la regla de los signos (`0 · -7` y
    // `1 · -7` se contestan sin pensar en el signo) y además `(-1) · 8`
    // invita a confundir el factor con el opuesto.
    const a = sa * azar.entero(2, tope);
    const b = sb * azar.entero(2, tope);
    return apartadoDeExpresion(por(a, b), { tope: tope * tope, parentesisSiempre: true }).apartado;
  }, { cuantos });

  return {
    clave: "multiplica_dos_enteros",
    arquetipo: "Multiplica dos enteros",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// "Divide dos enteros" (dificultad 1).
// Instrucción: de 6 a 8 apartados con las cuatro combinaciones de signos, y
// la división SIEMPRE exacta.
//
// LA EXACTITUD NO SE COMPRUEBA, SE CONSTRUYE. Sortear dividendo y divisor y
// descartar los que no dividen funcionaría, pero tira más del 80 % de los
// candidatos y con `tope` pequeño se queda sin apartados. Aquí se sortean el
// COCIENTE y el divisor, y el dividendo se calcula: sale exacta por
// construcción, sin un solo descarte.
export function divideDosEnteros(azar, { cuantos = 8, tope = 10 } = {}) {
  const siguienteCaso = repartidorDeSignos(azar);
  const { apartados } = reuneApartados(() => {
    const [sa, sb] = siguienteCaso();
    const cociente = azar.entero(2, tope);
    const divisor = azar.entero(2, tope);
    // El signo se aplica al DIVIDENDO y al DIVISOR, que es lo que el alumno
    // ve. El del cociente sale de la regla, que es justo lo que se practica.
    const dividendo = sa * cociente * divisor;
    return apartadoDeExpresion(entre(dividendo, sb * divisor), {
      tope: tope * tope,
      parentesisSiempre: true,
    }).apartado;
  }, { cuantos });

  return {
    clave: "divide_dos_enteros",
    arquetipo: "Divide dos enteros",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// "Cadena de productos y cocientes donde importa el orden" (dificultad 2).
// Instrucción: de 3 a 4 apartados con tres o cuatro factores, "incluyendo
// alguno donde el paréntesis cambia el resultado respecto a operar de
// izquierda a derecha".
//
// ESA INSTRUCCIÓN SE CUMPLE CON UNA PAREJA, no con un apartado. El ejemplo
// del catálogo ya lo dice: `-18 : (-3) · (-2)` y `-18 : [(-3) · (-2)]`, los
// mismos tres números dos veces. Puesto así, el alumno no puede atribuir la
// diferencia a los números: solo queda el paréntesis. Un apartado suelto con
// paréntesis no enseña eso, porque no hay nada con lo que compararlo.
//
// Y la pareja se construye para que los dos resultados sean DISTINTOS de
// verdad, comprobándolo con el evaluador. Si coincidieran, el apartado diría
// justo lo contrario de lo que pretende.
export function cadenaProductosCocientes(azar, { cuantos = 4, tope = 300 } = {}) {
  const apartados = [];
  const pareja = parejaQueCambia(azar, tope);
  if (pareja) apartados.push(...pareja);

  const { apartados: sueltos } = reuneApartados(
    () => unaCadena(azar, tope),
    { cuantos: Math.max(0, cuantos - apartados.length) },
  );
  apartados.push(...sueltos);

  return {
    clave: "cadena_productos_cocientes",
    arquetipo: "Cadena de productos y cocientes donde importa el orden",
    enunciado: "Calcula, respetando el orden de las operaciones:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    lineas: 2,
    apartados,
  };
}

// `a : b · c` frente a `a : (b · c)`.
//
// Se sortean el divisor `b`, el factor `c` y el cociente final `k`, y el
// dividendo se calcula como `a = b · c · k`: así las dos versiones son
// exactas por construcción. La agrupada vale `k` y la plana vale `k · c²`,
// que solo coinciden si `|c| = 1` — de ahí que `c` empiece en 2.
function parejaQueCambia(azar, tope) {
  // Al menos uno de los tres negativo, por el mismo motivo que en la cadena
  // suelta: `60 : 2 · 6` frente a `60 : (2 · 6)` demuestra perfectamente que
  // el paréntesis cambia el resultado, y no ejercita ni un signo. Si los tres
  // signos salen positivos se le da la vuelta a uno.
  const signos = [azar.signo(), azar.signo(), azar.signo()];
  if (signos.every((s) => s > 0)) signos[azar.entero(0, 2)] = -1;
  const b = signos[0] * azar.entero(2, 6);
  const c = signos[1] * azar.entero(2, 6);
  const k = signos[2] * azar.entero(2, 6);
  const a = b * c * k;

  const arbolPlano = por(entre(a, b), c);
  const arbolAgrupado = entre(a, por(b, c));
  const estilo = { tope, parentesisSiempre: true };
  const uno = apartadoDeExpresion(arbolPlano, estilo).apartado;
  const otro = apartadoDeExpresion(arbolAgrupado, estilo).apartado;
  if (!uno || !otro) return null;
  // La comprobación que da sentido al par. Con `|c| >= 2` no debería fallar
  // nunca, pero si algún día se toca el rango, esto lo dice en vez de
  // imprimir una pareja que no demuestra nada.
  if (uno.solucion === otro.solucion) return null;
  return [uno, otro];
}

// Una cadena suelta de tres o cuatro factores, plana. Se construye desde el
// resultado hacia atrás para que todas las divisiones sean exactas.
function unaCadena(azar, tope) {
  const n = azar.entero(3, 4);
  let arbol = azar.signo() * azar.entero(2, 9);
  let valor = arbol;
  for (let i = 1; i < n; i += 1) {
    if (azar.suerte(0.5)) {
      const factor = azar.signo() * azar.entero(2, 6);
      arbol = por(arbol, factor);
      valor *= factor;
    } else {
      // Solo se divide por un divisor del valor actual: la exactitud otra
      // vez por construcción, no por descarte.
      const divisores = divisoresDe(Math.abs(valor)).filter((d) => d >= 2 && d <= 9);
      if (!divisores.length) return null;
      const divisor = azar.signo() * azar.elige(divisores);
      arbol = entre(arbol, divisor);
      valor /= divisor;
    }
  }
  // AL MENOS UN NEGATIVO, y esto salió del folio: la cadena suelta que
  // imprimió fue `2 · 3 : 3 · 5`. Es una cadena correcta y no tiene nada de
  // este tema — ni un signo que aplicar. El arquetipo la pone para que el
  // ORDEN importe, pero en una hoja de enteros el orden se practica con
  // enteros.
  if (!llevaNegativo(arbol)) return null;
  return apartadoDeExpresion(arbol, { tope, parentesisSiempre: true }).apartado;
}

// Recorre el árbol buscando un número negativo. Se mira el ÁRBOL y no el
// texto porque en el texto el guion del operador y el signo del número son el
// mismo carácter.
function llevaNegativo(nodo) {
  if (nodo.tipo === "num") return nodo.valor < 0;
  if (nodo.tipo === "neg") return true;
  return llevaNegativo(nodo.izq) || llevaNegativo(nodo.der);
}

function divisoresDe(n) {
  const salida = [];
  for (let d = 2; d <= 9 && d <= n; d += 1) if (n % d === 0) salida.push(d);
  return salida;
}

// "Halla el factor que falta" (dificultad 2).
// Instrucción: de 4 a 6 igualdades con un hueco en un factor o en el divisor.
// Cubre "relaciones inversas entre las operaciones" (saber A.3) por el lado
// del producto, igual que `terminoQueFalta` lo cubre por el de la suma.
//
// El hueco en el DIVISOR no es lo mismo que en un factor y por eso salen los
// dos: `-36 : ___ = 9` obliga a pensar al revés dos veces (qué número, y con
// qué signo), y es donde se ve si el alumno ha entendido la regla o si la
// aplica solo en la dirección en la que la ha visto escrita.
export function factorQueFalta(azar, { cuantos = 5, tope = 10 } = {}) {
  let huecoDetras = azar.suerte(0.5);
  let dividiendo = azar.suerte(0.5);
  // LOS SIGNOS SE REPARTEN, NO SE SORTEAN, por el mismo motivo que en las dos
  // baterías de arriba, y aquí lo descubrí mirando una tanda: con los signos
  // al azar salieron `7 · ___ = 70`, `6 · ___ = 36` y `___ : 8 = 2` en la
  // misma hoja — tres de cinco apartados sin un solo número negativo. Eso no
  // es una batería de enteros, es una de cálculo mental de primaria. El
  // ejemplo del catálogo (`___ · (-4) = 12`) dice exactamente lo contrario.
  const siguienteCaso = repartidorDeSignos(azar);
  const { apartados } = reuneApartados(() => {
    huecoDetras = !huecoDetras;
    dividiendo = !dividiendo;
    const [sa, sb] = siguienteCaso();
    const a = sa * azar.entero(2, tope);
    const b = sb * azar.entero(2, tope);
    // Dividiendo, el "primer operando" que se imprime es el producto: así el
    // hueco puede caer en el divisor (`-36 : ___ = 9`) o en el dividendo
    // (`___ : (-4) = 9`) sin que la división deje de ser exacta.
    const completa = dividiendo ? entre(a * b, b) : por(a, b);
    const { apartado } = apartadoDeExpresion(completa, { tope: tope * tope });
    if (!apartado) return null;
    const conHuecoPuesto = conHueco({
      izq: dividiendo ? a * b : a,
      der: b,
      operador: dividiendo ? ":" : "·",
      total: apartado.solucion,
      huecoDetras,
      arbol: completa,
    });
    // EL REPARTO DE SIGNOS NO BASTA AQUÍ, y esto es lo que lo distingue de
    // las dos baterías de arriba: el hueco TAPA uno de los dos operandos, así
    // que un apartado del caso (-)·(-) puede acabar imprimiéndose todo
    // positivo si el negativo es justo el que se oculta. Salieron dos así en
    // la misma tanda (`18 : ___ = 9`, `___ · 4 = 36`). Se descarta y se
    // vuelve a intentar.
    if (!hayAlgunNegativo(conHuecoPuesto)) return null;
    return conHuecoPuesto;
  }, { cuantos });

  return {
    clave: "factor_que_falta",
    arquetipo: "Halla el factor que falta",
    enunciado: "Completa con el número que falta:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}
