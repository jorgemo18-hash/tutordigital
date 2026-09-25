import { reuneApartados } from "../../ejercicio.js";
import { poligonoConCotas } from "./figuras.js";

// GEOMETRÍA, OBJETIVO 6: FIGURAS COMPUESTAS Y PROBLEMAS DE ÁREAS (concepto
// 7). Saberes C.4 «Modelización geométrica: relaciones numéricas y
// algebraicas en la resolución de problemas» y B.2 «Representaciones planas
// de objetos en la visualización y resolución de problemas de áreas».
//
// EL ERROR QUE TIENE QUE PODER PROVOCAR la figura compuesta es el 8:
// multiplicar las dos medidas de fuera, como si fuera el rectángulo que la
// contiene (el trozo que falta se cuenta).

// ── "Área de la figura compuesta" (dificultad 3) ────────────────────────
// De 2 a 3 figuras en L: un rectángulo grande al que le falta una esquina.
// Todas las medidas necesarias van en la figura; la que falta se deduce.
export function figuraCompuesta(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => {
    const B = azar.entero(6, 12);
    const H = azar.entero(5, 10);
    const b = azar.entero(2, B - 2);
    const h = azar.entero(2, H - 2);
    // La L: le falta el rectángulo b × h de arriba a la derecha.
    const v = [[0, 0], [B, 0], [B, H - h], [B - b, H - h], [B - b, H], [0, H]];
    const A = B * H - b * h;
    // Cotas: abajo B, derecha H − h, el escalón b, y la izquierda H.
    return {
      latex: "Área = ___ cm²",
      latexResuelto: `Área = ${A} cm²`,
      texto: `L ${B} × ${H} sin ${b} × ${h} → A = ___`,
      solucion: String(A),
      exterior: String(B * H),
      figura: poligonoConCotas(v, [[0, `${B} cm`], [1, `${H - h} cm`], [2, `${b} cm`], [5, `${H} cm`]]),
      razon: `Se parte en dos rectángulos: el de abajo, ${B} · ${H - h} = ${B * (H - h)}, y el de arriba a la izquierda, ${B - b} · ${h} = ${(B - b) * h}. `
        + `Total, ${A} cm². (O el grande menos el hueco: ${B} · ${H} − ${b} · ${h} = ${A}.)`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "figura_compuesta",
    arquetipo: "Calcula el área de una figura compuesta de rectángulos",
    enunciado: "Calcula el área (descompón la figura en rectángulos):",
    tipo: "ejercicio",
    dificultad: 3,
    columnas: 2,
    apartados,
  };
}

const PROBLEMAS = [
  {
    id: "baldosas",
    crea: (azar) => {
      const [l, a] = [azar.entero(3, 8), azar.entero(2, 6)];
      const lado = azar.elige([25, 50]);
      const porM = 100 / lado;
      const n = l * porM * a * porM;
      return {
        enunciado: `Una habitación rectangular mide ${l} m por ${a} m. ¿Cuántas baldosas cuadradas de ${lado} cm de lado hacen falta para el suelo?`,
        solucion: String(n),
        razon: `En cada metro caben ${porM} baldosas de ${lado} cm: ${l * porM} a lo largo y ${a * porM} a lo ancho, ${l * porM} · ${a * porM} = ${n}.`,
      };
    },
  },
  {
    id: "valla",
    crea: (azar) => {
      const [l, a] = [azar.entero(10, 40), azar.entero(8, 25)];
      const precio = azar.entero(3, 9);
      const P = 2 * (l + a);
      return {
        enunciado: `Un huerto rectangular mide ${l} m por ${a} m. Se valla todo alrededor a ${precio} € el metro. ¿Cuánto cuesta la valla?`,
        solucion: `${P * precio} €`,
        razon: `Alrededor es el perímetro: 2 · (${l} + ${a}) = ${P} m. ${P} · ${precio} = ${P * precio} €.`,
      };
    },
  },
  {
    id: "pintura",
    crea: (azar) => {
      const [l, h] = [azar.entero(4, 8), azar.elige([3, 2])];
      const rinde = azar.elige([6, 8, 10, 12]);
      const A = l * h;
      if (A % rinde !== 0) return null;
      return {
        enunciado: `Hay que pintar una pared de ${l} m de largo y ${h} m de alto. Un bote de pintura cubre ${rinde} m². ¿Cuántos botes hacen falta?`,
        solucion: String(A / rinde),
        razon: `La pared tiene ${l} · ${h} = ${A} m², y ${A} : ${rinde} = ${A / rinde} botes.`,
      };
    },
  },
  {
    id: "cesped",
    crea: (azar) => {
      const [l, a] = [azar.entero(8, 20), azar.entero(5, 12)];
      const [pl, pa] = [azar.entero(2, 4), azar.entero(2, 4)];
      const A = l * a - pl * pa;
      return {
        enunciado: `Un jardín rectangular de ${l} m por ${a} m tiene en medio una piscina de ${pl} m por ${pa} m. ¿Cuántos m² de césped hay?`,
        solucion: `${A} m²`,
        razon: `El jardín entero menos la piscina: ${l} · ${a} − ${pl} · ${pa} = ${l * a} − ${pl * pa} = ${A} m².`,
      };
    },
  },
  {
    id: "mantel",
    crea: (azar) => {
      const lado = azar.entero(80, 150);
      const P = 4 * lado;
      return {
        enunciado: `Un mantel cuadrado mide ${lado} cm de lado. ¿Cuántos cm de puntilla hacen falta para rodearlo?`,
        solucion: `${P} cm`,
        razon: `Rodearlo es el perímetro: 4 · ${lado} = ${P} cm.`,
      };
    },
  },
];

// ── "Problemas de perímetros y áreas" (dificultad 3) ────────────────────
// De 3 a 4, distintos: hay que decidir si la pregunta es de perímetro
// (vallar, rodear) o de área (pintar, embaldosar).
export function problemasDeAreas(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(PROBLEMAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const ctx = plan[i];
    if (!ctx) return null;
    const p = ctx.crea(azar);
    if (!p) return null;
    i += 1;
    return {
      latex: `${p.enunciado} ___`,
      latexResuelto: `${p.enunciado} ${p.solucion}.`,
      texto: `${p.enunciado} ___`,
      solucion: p.solucion,
      contexto: ctx.id,
      razon: p.razon,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "problemas_de_areas",
    arquetipo: "Resuelve problemas de perímetros y áreas",
    enunciado: "Resuelve (¿es perímetro o área?):",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
