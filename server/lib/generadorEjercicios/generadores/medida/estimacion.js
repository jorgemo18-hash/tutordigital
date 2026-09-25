import { reuneApartados } from "../../ejercicio.js";

// MEDIDA, OBJETIVO 1: MAGNITUDES, UNIDADES Y ESTIMACIÓN (conceptos 1 y 5).
// Saberes B.1 «Estrategias de elección de las unidades…» y B.3
// «Formulación de conjeturas sobre medidas… basadas en estimaciones».
//
// OBJETOS ESCRITOS A MANO con su medida real aproximada: la IA no inventa
// cuánto mide una puerta. En "elige la unidad" las opciones están a
// escalones de distancia (mm, cm, m, km), de modo que solo una es
// razonable; en "estima", las opciones se separan por 10, que es la
// diferencia que el alumno tiene que saber ver.

const OBJETOS = [
  { que: "la longitud de un bolígrafo", magnitud: "longitud", unidad: "cm", valor: 14, opciones: ["mm", "cm", "m", "km"] },
  { que: "la distancia entre Zaragoza y Huesca", magnitud: "longitud", unidad: "km", valor: 70, opciones: ["cm", "m", "km"] },
  { que: "la altura de una puerta", magnitud: "longitud", unidad: "m", valor: 2, opciones: ["mm", "cm", "m", "km"], estimaEn: "m" },
  { que: "el grosor de una moneda", magnitud: "longitud", unidad: "mm", valor: 2, opciones: ["mm", "m", "km"] },
  { que: "el largo de un campo de fútbol", magnitud: "longitud", unidad: "m", valor: 100, opciones: ["cm", "m", "km"] },
  { que: "la masa de una sandía", magnitud: "masa", unidad: "kg", valor: 5, opciones: ["mg", "g", "kg"] },
  { que: "la masa de un folio", magnitud: "masa", unidad: "g", valor: 5, opciones: ["mg", "g", "kg"] },
  { que: "la masa de un coche", magnitud: "masa", unidad: "kg", valor: 1200, opciones: ["g", "kg"], sinEstimar: true },
  { que: "el agua de una bañera", magnitud: "capacidad", unidad: "L", valor: 150, opciones: ["mL", "L"] },
  { que: "el jarabe de una cucharadita", magnitud: "capacidad", unidad: "mL", valor: 5, opciones: ["mL", "L"] },
  { que: "la leche de un vaso", magnitud: "capacidad", unidad: "mL", valor: 250, opciones: ["mL", "L", "kL"] },
  { que: "la superficie de un aula", magnitud: "superficie", unidad: "m²", valor: 50, opciones: ["cm²", "m²", "km²"] },
  { que: "la superficie de un sello", magnitud: "superficie", unidad: "cm²", valor: 6, opciones: ["cm²", "m²", "km²"] },
];

// ── "Elige la unidad" (dificultad 1) ────────────────────────────────────
export function unidadAdecuada(azar, { cuantos = 6 } = {}) {
  const plan = azar.mezcla(OBJETOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const o = plan[i];
    i += 1;
    if (!o) return null;
    const frase = `Para medir ${o.que}: ${o.opciones.join(", ")}`;
    return {
      latex: `${frase} → ___`,
      latexResuelto: `${frase} → ${o.unidad}`,
      texto: `${frase} → ___`,
      solucion: o.unidad,
      que: o.que,
      razon: `Es ${o.magnitud}, y mide más o menos ${o.valor} ${o.unidad}: con esa unidad sale un número manejable.`,
    };
  }, { cuantos, clave: (a) => a.que });

  return {
    clave: "unidad_adecuada",
    arquetipo: "Elige la unidad adecuada para medir",
    enunciado: "Elige la unidad más adecuada:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Estima la medida" (dificultad 1) ───────────────────────────────────
// De 4 a 6: tres medidas en la misma unidad separadas por 10 (2 m, 20 m,
// 0,2 m), en orden sorteado; solo una es la razonable.
export function estimaMedida(azar, { cuantos = 4 } = {}) {
  const plan = azar.mezcla(OBJETOS.filter((o) => !o.sinEstimar));
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const o = plan[i];
    i += 1;
    if (!o) return null;
    const conComa = (x) => String(Number(x.toFixed(3))).replace(".", ",");
    const opciones = azar.mezcla([o.valor, o.valor * 10, o.valor / 10]).map((v) => `${conComa(v)} ${o.unidad}`);
    const bien = `${conComa(o.valor)} ${o.unidad}`;
    const frase = `${o.que.charAt(0).toUpperCase()}${o.que.slice(1)}: ${opciones.join(" / ")}`;
    return {
      latex: `${frase} → ___`,
      latexResuelto: `${frase} → ${bien}`,
      texto: `${frase} → ___`,
      solucion: bien,
      que: o.que,
      razon: `Comparando con algo conocido: ${o.que} es del orden de ${bien}. Las otras son diez veces más o diez veces menos.`,
    };
  }, { cuantos, clave: (a) => a.que });

  return {
    clave: "estima_medida",
    arquetipo: "Estima la medida razonable de un objeto",
    enunciado: "¿Cuál es la medida más razonable?",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}
