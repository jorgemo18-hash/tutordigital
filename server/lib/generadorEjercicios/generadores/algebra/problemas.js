import { reuneApartados } from "../../ejercicio.js";

// ÁLGEBRA, OBJETIVO 6: PROBLEMAS QUE SE RESUELVEN CON UNA ECUACIÓN
// (concepto 8). Saber D.2: «Modelización de situaciones de la vida
// cotidiana usando … el lenguaje algebraico».
//
// PLANTILLAS ESCRITAS A MANO, como en los otros temas: la IA no escribe ni
// un enunciado. Se elige primero la solución y de ella salen los datos, así
// que la ecuación siempre tiene solución entera y con sentido (nadie tiene
// −3 años ni 7,5 cromos).
//
// La explicación del ejemplo dice qué es la x, escribe la ecuación y la
// resuelve: plantear es lo que se aprende aquí, la cuenta ya se sabe hacer.
//
// Dos baterías con contextos distintos: la de números (una incógnita
// directa) y la de repartos (dos cantidades relacionadas, donde hay que
// decidir qué es la x y contestar las DOS; la solución dice de quién es
// cada número, porque "9 y 18" no contesta "¿cuántos años tiene cada uno?").

const MENOS = "−";

const NUMEROS = [
  {
    id: "suma",
    crea: (azar) => {
      const x = azar.entero(4, 40); const a = azar.entero(3, 25);
      return {
        enunciado: `Si a un número le sumas ${a}, obtienes ${x + a}. ¿Qué número es?`,
        solucion: x, unidad: "",
        razon: `x + ${a} = ${x + a}; x = ${x + a} ${MENOS} ${a} = ${x}.`,
      };
    },
  },
  {
    id: "triple",
    crea: (azar) => {
      const x = azar.entero(2, 15); const k = azar.entero(2, 5);
      // Lo que se resta, menor que kx: "el doble de un número menos 11 es
      // −7" es un enunciado que ningún libro de 1.º escribe.
      const a = azar.entero(1, Math.min(12, k * x - 1));
      const nombre = { 2: "El doble", 3: "El triple", 4: "El cuádruple", 5: "El quíntuple" }[k];
      return {
        enunciado: `${nombre} de un número menos ${a} es ${k * x - a}. ¿Qué número es?`,
        solucion: x, unidad: "",
        razon: `${k}x ${MENOS} ${a} = ${k * x - a}; ${k}x = ${k * x - a} + ${a} = ${k * x}; x = ${k * x} : ${k} = ${x}.`,
      };
    },
  },
  {
    id: "cuadernos",
    crea: (azar) => {
      const x = azar.entero(2, 6); const n = azar.entero(2, 5); const extra = azar.entero(1, 4);
      const total = n * x + extra;
      return {
        enunciado: `Por ${n} cuadernos iguales y un bolígrafo de ${extra} € he pagado ${total} €. ¿Cuánto cuesta cada cuaderno?`,
        solucion: x, unidad: "€",
        razon: `x = lo que cuesta un cuaderno. ${n}x + ${extra} = ${total}; ${n}x = ${total - extra}; x = ${x}.`,
      };
    },
  },
  {
    id: "mitad",
    crea: (azar) => {
      const x = 2 * azar.entero(3, 20); const a = azar.entero(2, 15);
      return {
        enunciado: `La mitad de un número más ${a} es ${x / 2 + a}. ¿Qué número es?`,
        solucion: x, unidad: "",
        razon: `x/2 + ${a} = ${x / 2 + a}; x/2 = ${x / 2}; x = ${x / 2} · 2 = ${x}.`,
      };
    },
  },
];

const REPARTOS = [
  {
    id: "consecutivos",
    crea: (azar) => {
      const x = azar.entero(5, 40);
      return {
        enunciado: `Tres números consecutivos suman ${3 * x + 3}. ¿Cuáles son?`,
        solucion: `${x}, ${x + 1} y ${x + 2}`, unidad: "",
        razon: `x, x + 1 y x + 2. x + x + 1 + x + 2 = ${3 * x + 3}; 3x + 3 = ${3 * x + 3}; 3x = ${3 * x}; x = ${x}.`,
      };
    },
  },
  {
    id: "edades",
    crea: (azar) => {
      const x = azar.entero(4, 20); const d = azar.entero(2, 12);
      return {
        enunciado: `Ana tiene ${d} años más que su hermano, y entre los dos suman ${2 * x + d}. ¿Cuántos años tiene cada uno?`,
        solucion: `el hermano, ${x} años; Ana, ${x + d}`, unidad: "",
        razon: `x = la edad del hermano; Ana, x + ${d}. x + x + ${d} = ${2 * x + d}; 2x = ${2 * x}; x = ${x}. Ana tiene ${x + d}.`,
      };
    },
  },
  {
    id: "rectangulo",
    crea: (azar) => {
      const x = azar.entero(2, 15);
      return {
        enunciado: `El largo de un rectángulo mide el doble que el ancho, y su perímetro es ${6 * x} cm. ¿Cuánto miden el ancho y el largo?`,
        solucion: `ancho, ${x} cm; largo, ${2 * x} cm`, unidad: "",
        razon: `x = el ancho; el largo, 2x. Perímetro: x + 2x + x + 2x = 6x = ${6 * x}; x = ${x}. Largo: ${2 * x} cm.`,
      };
    },
  },
  {
    id: "cromos",
    crea: (azar) => {
      const x = azar.entero(4, 30); const k = azar.entero(2, 4);
      const veces = { 2: "el doble", 3: "el triple", 4: "el cuádruple" }[k];
      return {
        enunciado: `Pablo tiene ${veces} de cromos que Marta, y entre los dos tienen ${(k + 1) * x}. ¿Cuántos tiene cada uno?`,
        solucion: `Marta, ${x}; Pablo, ${k * x}`, unidad: "",
        razon: `x = los cromos de Marta; Pablo, ${k}x. x + ${k}x = ${(k + 1) * x}; ${k + 1}x = ${(k + 1) * x}; x = ${x}. Pablo tiene ${k * x}.`,
      };
    },
  },
  {
    id: "hucha",
    crea: (azar) => {
      const x = azar.entero(3, 20); const inicial = azar.entero(5, 40); const semanas = azar.entero(3, 8);
      return {
        enunciado: `Leo tiene ${inicial} € en la hucha y cada semana mete la misma cantidad. Dentro de ${semanas} semanas tendrá ${inicial + semanas * x} €. ¿Cuánto mete cada semana?`,
        solucion: x, unidad: "€",
        razon: `x = lo que mete cada semana. ${inicial} + ${semanas}x = ${inicial + semanas * x}; ${semanas}x = ${semanas * x}; x = ${x}.`,
      };
    },
  },
];

// Tras "¿…?" la respuesta empieza en mayúscula: "El hermano, 19 años…".
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function bateria(azar, cuantos, contextos) {
  const plan = azar.mezcla(contextos);
  let i = 0;
  return reuneApartados(() => {
    const ctx = plan[i];
    i += 1;
    if (!ctx) return null;
    const p = ctx.crea(azar);
    const unidad = p.unidad ? ` ${p.unidad}` : "";
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${mayuscula(String(p.solucion))}${unidad}.`,
      texto: `${p.enunciado} ___`,
      solucion: p.solucion,
      contexto: ctx.id,
      razon: p.razon,
    };
  }, { cuantos, clave: (a) => a.contexto }).apartados;
}

// ── "Problemas de un número" (dificultad 2) ─────────────────────────────
export function problemasDeNumeros(azar, { cuantos = 2 } = {}) {
  return {
    clave: "problemas_ecuacion_numeros",
    arquetipo: "Resuelve problemas de un número con una ecuación",
    enunciado: "Plantea una ecuación y resuélvela:",
    tipo: "problema",
    dificultad: 2,
    columnas: 1,
    apartados: bateria(azar, cuantos, NUMEROS),
  };
}

// ── "Problemas de repartos y relaciones" (dificultad 3) ─────────────────
export function problemasDeRepartos(azar, { cuantos = 2 } = {}) {
  return {
    clave: "problemas_ecuacion_repartos",
    arquetipo: "Resuelve problemas de repartos y relaciones con una ecuación",
    enunciado: "Di qué es la x, plantea la ecuación y resuélvela:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados: bateria(azar, cuantos, REPARTOS),
  };
}
