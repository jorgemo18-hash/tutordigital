import { reuneApartados } from "../../ejercicio.js";
import { escribe, expresion, expresionL } from "./escritura.js";

// FUNCIONES, OBJETIVO 3: LEER GRÁFICAS (concepto 4). Saber D.5:
// «Estrategias de deducción de la información relevante de una función
// mediante el uso de diferentes representaciones».
//
// UNA HISTORIA POR GRÁFICA, escrita a mano (una excursión en bici, el agua
// de un depósito, la temperatura de un horno…): la gráfica es una
// poligonal con los vértices en cruces de la cuadrícula, para que los
// valores se lean sin estimar. Tres preguntas por gráfica: un valor, un
// tramo constante y cuándo crece más deprisa o cuándo vuelve.
//
// Los datos salen de la historia: primero los tramos, después la gráfica.

// Una poligonal de tramos [duración, cambio] desde (0, inicio).
function poligonal(inicio, tramos) {
  const puntos = [[0, inicio]];
  for (const [dt, dy] of tramos) {
    const [x, y] = puntos[puntos.length - 1];
    puntos.push([x + dt, y + dy]);
  }
  return puntos;
}

const HISTORIAS = [
  {
    id: "bici",
    crea: (azar) => {
      // Ida con parada y vuelta: km de 10 en 10, horas de 1 en 1.
      const ida1 = 10 * azar.entero(2, 3);
      const ida2 = 10 * azar.entero(1, 2);
      const parada = azar.entero(1, 2);
      const tramos = [[azar.entero(1, 2), ida1], [parada, 0], [1, ida2], [azar.entero(1, 2), -(ida1 + ida2)]];
      const p = poligonal(0, tramos);
      const tPregunta = p[1][0];
      return {
        nombres: { x: "Horas", y: "Km" },
        pasoY: 10,
        puntos: p,
        frase: `La gráfica es una excursión en bici. ¿A cuántos km de casa estaba a las ${tPregunta} h? ¿Cuántas horas estuvo parada? ¿Cuántos km recorrió en total?`,
        solucion: [`${p[1][1]} km`, `${parada} h`, `${2 * (ida1 + ida2)} km`],
        huecos: "___ km, ___ h, ___ km",
        razon: `A las ${tPregunta} h la gráfica está a ${p[1][1]} km. Parada: el tramo horizontal, de ${p[1][0]} a ${p[2][0]} h. En total, ida y vuelta: ${ida1 + ida2} + ${ida1 + ida2} = ${2 * (ida1 + ida2)} km.`,
      };
    },
  },
  {
    id: "deposito",
    crea: (azar) => {
      // Litros de 20 en 20, minutos de 1 en 1: se llena, se mantiene, se vacía.
      const llena = 20 * azar.entero(3, 4);
      const t1 = azar.entero(2, 3);
      const quieto = azar.entero(1, 2);
      const t3 = azar.entero(1, 2);
      const p = poligonal(0, [[t1, llena], [quieto, 0], [t3, -llena]]);
      return {
        nombres: { x: "Minutos", y: "Litros" },
        pasoY: 20,
        puntos: p,
        frase: `Un depósito se llena, se deja un rato y se vacía. ¿Cuántos litros llega a tener? ¿Cuántos minutos está lleno? ¿Tarda más en llenarse o en vaciarse?`,
        solucion: [`${llena} L`, `${quieto} min`, t1 > t3 ? "en llenarse" : "en vaciarse"],
        huecos: "___ L, ___ min, ___",
        razon: `El punto más alto, ${llena} L. Lleno: el tramo horizontal, ${quieto} min. Llenarse, ${t1} min; vaciarse, ${t3} min: tarda más ${t1 > t3 ? "en llenarse" : "en vaciarse"}.`,
        distintos: t1 !== t3,
      };
    },
  },
  {
    id: "temperatura",
    crea: (azar) => {
      // Grados de 20 en 20: un horno que se calienta, se mantiene y se enfría.
      const inicial = 20;
      const sube = 20 * azar.entero(3, 5);
      const t1 = azar.entero(2, 4);
      const t2 = azar.entero(2, 3);
      const baja = 20 * azar.entero(2, 3);
      const p = poligonal(inicial, [[t1, sube], [t2, 0], [2, -baja]]);
      return {
        nombres: { x: "Minutos", y: "°C" },
        pasoY: 20,
        puntos: p,
        frase: `La gráfica es la temperatura de un horno. ¿A qué temperatura estaba al encenderlo? ¿Qué temperatura máxima alcanza? ¿Cuántos minutos se mantiene?`,
        solucion: [`${inicial} °C`, `${inicial + sube} °C`, `${t2} min`],
        huecos: "___ °C, ___ °C, ___ min",
        razon: `Al encenderlo, en el minuto 0: ${inicial} °C. Lo más alto: ${inicial + sube} °C. Se mantiene en el tramo horizontal: ${t2} min.`,
      };
    },
  },
  {
    id: "paseo",
    crea: (azar) => {
      // Metros de 200 en 200, minutos de 5 en 5: sale, se para en un banco y vuelve.
      const ida = 200 * azar.entero(3, 4);
      const p = poligonal(0, [[azar.elige([10, 15]), ida], [5, 0], [azar.elige([10, 15, 20]), -ida]]);
      return {
        nombres: { x: "Minutos", y: "Metros" },
        pasoX: 5,
        pasoY: 200,
        puntos: p,
        frase: `Marta sale de casa a pasear, se sienta en un banco y vuelve. ¿A cuántos metros de casa está el banco? ¿Cuántos minutos está sentada? ¿A qué minuto vuelve a casa?`,
        solucion: [`${ida} m`, "5 min", `${p[3][0]} min`],
        huecos: "___ m, ___ min, ___ min",
        razon: `El tramo horizontal está a ${ida} m y dura de ${p[1][0]} a ${p[2][0]} min: 5 min. Vuelve a casa (0 m) en el minuto ${p[3][0]}.`,
      };
    },
  },
];

// ── "Lee la gráfica" (dificultad 2) ─────────────────────────────────────
// Dos gráficas, cada una con su historia y tres preguntas, en dos columnas.
export function leeGrafica(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(HISTORIAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const h = plan[i];
    if (!h) return null;
    const g = h.crea(azar);
    if (g.distintos === false) return null;
    i += 1;
    const pasoX = g.pasoX || 1;
    const xs = g.puntos.map((p) => p[0]);
    const ys = g.puntos.map((p) => p[1]);
    const xMax = Math.ceil(Math.max(...xs) / pasoX) * pasoX;
    // Siete cuadros de alto en todas las historias: así la actividad mide
    // lo mismo salga la que salga (la paginación lo necesita).
    const yMax = 7 * g.pasoY;
    if (Math.max(...ys) > yMax) return null;
    return {
      latex: `${g.frase} ${g.huecos}`,
      latexResuelto: `${g.frase} ${g.solucion.join(", ")}`,
      texto: `${g.frase} → ${g.huecos}`,
      solucion: g.solucion,
      contexto: h.id,
      figura: { tipo: "ejes", x: [0, xMax], y: [0, yMax], pasoX, pasoY: g.pasoY, rotulosCada: 1, nombres: g.nombres, lineas: [g.puntos], descripcion: "Gráfica de una situación" },
      razon: g.razon,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "lee_grafica",
    arquetipo: "Lee la información de una gráfica",
    enunciado: "Mira la gráfica y contesta:",
    tipo: "problema",
    dificultad: 2,
    columnas: 2,
    apartados,
  };
}

// ── "Escribe la expresión de la recta" (dificultad 2) ───────────────────
// De 2 a 3 rectas dibujadas con dos puntos marcados en cruces de la
// cuadrícula: de la gráfica a la expresión (la otra dirección de D.5).
export function graficaAExpresion(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = azar.elige([1, 2, 3, -1, -2]);
    const b = azar.entero(-3, 3);
    if (b === 0 && Math.abs(a) === 1) return null;
    // LA MISMA CUADRÍCULA SIEMPRE (x de −1 a 4, y de −4 a 4), para que la
    // altura de la actividad no dependa de la recta que salga. La recta se
    // dibuja de x = 0 hasta donde no se salga.
    const dentro = [0, 1, 2, 3].filter((x) => Math.abs(a * x + b) <= 4);
    if (dentro.length < 2 || dentro[1] !== 1) return null;
    const xFin = dentro[dentro.length - 1];
    const ys = [0, 1].map((x) => a * x + b);
    return {
      latex: "$y =$ ___",
      latexResuelto: `$y = ${expresionL(a, b)}$`,
      texto: `Recta por (0, ${escribe(b)}) y (1, ${escribe(a + b)}) → y = ___`,
      solucion: expresion(a, b),
      cambiada: expresion(b, a),
      figura: {
        tipo: "ejes", x: [-1, 4], y: [-4, 4],
        lineas: [[[0, b], [xFin, a * xFin + b]]],
        puntos: [{ x: 0, y: ys[0] }, { x: 1, y: ys[1] }],
        descripcion: "Una recta en unos ejes",
      },
      razon: `Corta al eje vertical en ${escribe(b)} (para x = 0): es lo que se suma. Cada paso a la derecha, ${a > 0 ? "sube" : "baja"} ${Math.abs(a)}: es lo que multiplica a x. y = ${expresion(a, b)}.`,
    };
  }, { cuantos, clave: (x) => x.solucion });

  return {
    clave: "grafica_a_expresion",
    arquetipo: "Escribe la expresión de una recta a partir de su gráfica",
    enunciado: "Escribe la expresión de cada recta:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados,
  };
}
