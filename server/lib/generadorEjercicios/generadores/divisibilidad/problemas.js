import { reuneApartados } from "../../ejercicio.js";
import { mcd, mcm } from "./aritmetica.js";
import { parejaInteresante } from "./numeros.js";

// DIVISIBILIDAD, OBJETIVO 6: PROBLEMAS DE M.C.D. Y M.C.M. (concepto 8).
//
// SON PLANTILLAS ESCRITAS A MANO, NO TEXTO GENERADO, como las situaciones
// de los enteros (reconocer.js): cada contexto lleva escrito qué se calcula,
// así que la solución es segura. La IA no escribe ni un enunciado.
//
// Lo difícil de estos problemas no es la cuenta, es DECIDIR CUÁL DE LAS DOS
// hace falta. Por eso:
//   - hay contextos de las dos clases con la misma forma de frase ("dos
//     cosas, dos números"), para que no se decida por el decorado;
//   - la batería difícil las mezcla, y ahí la respuesta-trampa del error 5
//     (hacer la otra) es la que más dice de un alumno;
//   - la explicación del ejemplo dice POR QUÉ es esa y no la otra
//     ("coincidir otra vez" → un múltiplo de los dos; "trozos iguales lo más
//     grandes posible" → un divisor de los dos).

// LOS CONTEXTOS SE REPARTEN ENTRE LAS BATERÍAS: los que llevan `mezclados`
// son solo de la batería mezclada y los demás solo de las otras dos. Las
// tres baterías se generan cada una por su lado y pueden salir en la misma
// hoja; sin este reparto, la hoja traía el problema de las parcelas dos
// veces con otros números (visto al imprimirla). Cuatro por clase para las
// puras (hasta tres apartados más el ejemplo) y tres para la mezclada.
//
// `porque` termina justo antes de la cuenta ("…; el primero es"): la
// explicación sigue con "m.c.m.(12, 18) = 36", así que dice qué se busca y
// por qué esa cuenta, sin repetir "el m.c.m." dos veces.
const MCM = [
  {
    id: "autobuses", unidad: "minutos",
    frase: (a, b) => `Dos autobuses salen a la vez de la misma parada: uno pasa cada ${a} minutos y el otro cada ${b}. ¿Dentro de cuántos minutos vuelven a coincidir en la parada?`,
    porque: (a, b) => `Vuelven a coincidir en un tiempo que es múltiplo de ${a} y de ${b} a la vez; el primero es`,
  },
  {
    id: "faros", unidad: "segundos",
    frase: (a, b) => `Un faro se enciende cada ${a} segundos y otro cada ${b}. Si se acaban de encender a la vez, ¿cuántos segundos pasarán hasta que vuelvan a encenderse juntos?`,
    porque: (a, b) => `Se encienden juntos en un momento que es múltiplo de ${a} y de ${b}; el primero es`,
  },
  {
    id: "bolsas", unidad: "caramelos",
    frase: (a, b) => `¿Cuál es el menor número de caramelos que se puede repartir en bolsas de ${a} y también en bolsas de ${b}, sin que sobre ninguno?`,
    porque: (a, b) => `El número de caramelos tiene que ser múltiplo de ${a} y de ${b}; el menor es`,
  },
  {
    id: "vueltas", mezclados: true, unidad: "minutos",
    frase: (a, b) => `Dos corredores salen juntos de la meta de un circuito. Uno tarda ${a} minutos en dar una vuelta y el otro ${b}. ¿Cuántos minutos pasarán hasta que vuelvan a pasar juntos por la meta?`,
    porque: (a, b) => `Pasan juntos por la meta en un tiempo que es múltiplo de ${a} y de ${b}; el primero es`,
  },
  {
    id: "alarmas", unidad: "minutos",
    frase: (a, b) => `El móvil de Nerea tiene dos avisos: uno suena cada ${a} minutos y el otro cada ${b}. Acaban de sonar a la vez. ¿Cuántos minutos faltan para que vuelvan a sonar juntos?`,
    porque: (a, b) => `Suenan juntos en un tiempo que es múltiplo de ${a} y de ${b}; el primero es`,
  },
  {
    id: "pilas", mezclados: true, unidad: "cm",
    frase: (a, b) => `Hugo apila cajas de ${a} cm de alto y Sara, a su lado, cajas de ${b} cm. ¿A qué altura, la más baja posible, estarán las dos pilas igual de altas?`,
    porque: (a, b) => `Una pila de cajas de ${a} cm siempre mide un múltiplo de ${a}, y la otra un múltiplo de ${b}; la primera altura común es`,
  },
  {
    id: "turnos", mezclados: true, unidad: "días",
    frase: (a, b) => `En un hospital, Luis tiene guardia cada ${a} días y Marta cada ${b}. Hoy coinciden. ¿Dentro de cuántos días volverán a coincidir de guardia?`,
    porque: (a, b) => `Coinciden en un número de días que es múltiplo de ${a} y de ${b}; el primero es`,
  },
];

const MCD = [
  {
    id: "cuerdas", unidad: "cm",
    frase: (a, b) => `Tenemos dos cuerdas de ${a} cm y de ${b} cm. Queremos cortarlas en trozos iguales, lo más largos posible, sin que sobre nada. ¿Cuánto medirá cada trozo?`,
    porque: (a, b) => `Cada trozo tiene que caber un número exacto de veces en ${a} y en ${b} (un divisor de los dos); el más largo es`,
  },
  {
    id: "bandejas", unidad: "piezas",
    frase: (a, b) => `En una pastelería hay ${a} magdalenas y ${b} cruasanes. Se quieren colocar en bandejas iguales, sin mezclar, con el mayor número posible de piezas en cada una. ¿Cuántas piezas llevará cada bandeja?`,
    porque: (a, b) => `Las piezas de una bandeja tienen que dividir a ${a} y a ${b} sin que sobre ninguna; el mayor número es`,
  },
  {
    id: "losetas", unidad: "dm",
    frase: (a, b) => `Se quiere cubrir un suelo rectangular de ${a} dm por ${b} dm con losetas cuadradas iguales, lo más grandes posible y sin cortar ninguna. ¿Cuánto medirá el lado de cada loseta?`,
    porque: (a, b) => `El lado de la loseta tiene que caber un número exacto de veces en ${a} y en ${b}; el mayor es`,
  },
  {
    id: "grupos", mezclados: true, unidad: "alumnos",
    frase: (a, b) => `En una excursión van ${a} alumnos de 1.º y ${b} de 2.º. Se quieren hacer grupos del mismo tamaño, sin mezclar cursos y lo más grandes posible. ¿Cuántos alumnos tendrá cada grupo?`,
    porque: (a, b) => `El tamaño del grupo tiene que dividir a ${a} y a ${b}; el mayor es`,
  },
  {
    id: "lotes", unidad: "lotes",
    frase: (a, b) => `Para una rifa hay ${a} bolígrafos y ${b} cuadernos. Se quieren hacer lotes iguales, con los mismos bolígrafos y los mismos cuadernos en cada uno y sin que sobre nada. ¿Cuántos lotes, como mucho, se pueden hacer?`,
    porque: (a, b) => `El número de lotes tiene que dividir a ${a} y a ${b} para repartirlos sin que sobre nada; el mayor es`,
  },
  {
    id: "parcelas", mezclados: true, unidad: "m",
    frase: (a, b) => `Un huerto rectangular de ${a} m por ${b} m se quiere dividir en parcelas cuadradas iguales, lo más grandes posible. ¿Cuánto medirá el lado de cada parcela?`,
    porque: (a, b) => `El lado de la parcela tiene que caber un número exacto de veces en ${a} y en ${b}; el mayor es`,
  },
  {
    id: "collares", mezclados: true, unidad: "collares",
    frase: (a, b) => `Con ${a} cuentas rojas y ${b} azules se quieren hacer collares iguales, cada uno con las mismas cuentas de cada color, usándolas todas. ¿Cuántos collares, como mucho, se pueden hacer?`,
    porque: (a, b) => `El número de collares tiene que dividir a ${a} y a ${b} para repartir todas las cuentas; el mayor es`,
  },
];

// Números de cada clase de problema: los de m.c.m. son periodos cortos (el
// resultado se cuenta en minutos o caramelos razonables); los de m.c.d. son
// cantidades más grandes con un divisor común que merezca la pena.
function numerosDe(azar, clase) {
  return clase === "mcm"
    ? parejaInteresante(azar, { desde: 4, hasta: 30, topeMcm: 180 })
    : parejaInteresante(azar, { desde: 20, hasta: 150, mcdMinimo: 6 });
}

function apartadoDe(azar, contexto, clase) {
  const p = numerosDe(azar, clase);
  if (!p) return null;
  const [a, b] = p;
  const solucion = clase === "mcm" ? mcm(a, b) : mcd(a, b);
  const nombre = clase === "mcm" ? "m.c.m." : "m.c.d.";
  const enunciado = contexto.frase(a, b);
  return {
    latex: `${enunciado} ___`,
    latexResuelto: `${enunciado} ${solucion} ${contexto.unidad}.`,
    texto: `${enunciado} ___`,
    solucion,
    // Lo que da la OTRA cuenta: la respuesta-trampa del error 5.
    otra: clase === "mcm" ? mcd(a, b) : mcm(a, b),
    contexto: contexto.id,
    razon: `${contexto.porque(a, b)} ${nombre}(${a}, ${b}) = ${solucion}. Solución: ${solucion} ${contexto.unidad}.`,
  };
}

function bateriaDeProblemas(azar, cuantos, plan) {
  let i = 0;
  return reuneApartados(() => {
    const paso = plan[i];
    i += 1;
    if (!paso) return null;
    return apartadoDe(azar, paso.contexto, paso.clase);
  // Un contexto por batería: dos problemas de autobuses son el mismo dos veces.
  }, { cuantos, clave: (a) => a.contexto }).apartados;
}

const deClase = (lista, clase) => lista.map((contexto) => ({ contexto, clase }));
const puros = (lista) => lista.filter((c) => !c.mezclados);
const deLaMezclada = (lista) => lista.filter((c) => c.mezclados);

// ── "Problemas de m.c.m." (dificultad 2) ─────────────────────────────────
export function problemasDeMcm(azar, { cuantos = 2 } = {}) {
  return {
    clave: "problemas_mcm",
    arquetipo: "Resuelve problemas de mínimo común múltiplo",
    enunciado: "Resuelve. En todos hace falta el m.c.m.:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados: bateriaDeProblemas(azar, cuantos, deClase(azar.mezcla(puros(MCM)), "mcm")),
  };
}

// ── "Problemas de m.c.d." (dificultad 2) ─────────────────────────────────
export function problemasDeMcd(azar, { cuantos = 2 } = {}) {
  return {
    clave: "problemas_mcd",
    arquetipo: "Resuelve problemas de máximo común divisor",
    enunciado: "Resuelve. En todos hace falta el m.c.d.:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados: bateriaDeProblemas(azar, cuantos, deClase(azar.mezcla(puros(MCD)), "mcd")),
  };
}

// ── "¿m.c.d. o m.c.m.? Decide y resuelve" (dificultad 3) ─────────────────
// Alternando las dos clases desde un comienzo sorteado, para que en una
// batería de dos haya siempre uno de cada.
export function problemasMezclados(azar, { cuantos = 2 } = {}) {
  const mcmPrimero = azar.suerte(0.5);
  const a = deClase(azar.mezcla(deLaMezclada(MCM)), "mcm");
  const b = deClase(azar.mezcla(deLaMezclada(MCD)), "mcd");
  const [x, y] = mcmPrimero ? [a, b] : [b, a];
  const plan = x.flatMap((paso, k) => [paso, y[k]]).filter(Boolean);
  return {
    clave: "problemas_mezclados",
    arquetipo: "Decide si hace falta el m.c.d. o el m.c.m. y resuelve",
    enunciado: "Decide si hace falta el m.c.d. o el m.c.m., y resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados: bateriaDeProblemas(azar, cuantos, plan),
  };
}
