import { reuneApartados } from "../../ejercicio.js";
import { tablaDeFilas, HUECO_TABLA, coma } from "./escritura.js";
import { reparto } from "./calculos.js";

// ESTADÍSTICA, OBJETIVO 2: GRÁFICOS (concepto 3). Saber E.1: «Análisis e
// interpretación de tablas y gráficos estadísticos…».
//
// Las barras las dibuja la hoja (assets/shared/hoja/js/figuras/graficos.js),
// con cuadrícula: cada valor cae en una línea y se lee sin estimar.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   3 dar como moda la frecuencia más alta (la altura de la barra) en vez
//     del valor (la categoría);
//   4 tomar el porcentaje por el ángulo del sector (olvidar que el círculo
//     entero son 360°, no 100).

const ENCUESTAS = [
  { id: "deporte", pregunta: "Deporte favorito", categorias: ["Fútbol", "Baloncesto", "Tenis", "Natación", "Pádel"] },
  { id: "fruta", pregunta: "Fruta favorita", categorias: ["Manzana", "Plátano", "Fresa", "Naranja", "Kiwi"] },
  { id: "mascota", pregunta: "Mascota que tienen", categorias: ["Perro", "Gato", "Peces", "Pájaro", "Ninguna"] },
  { id: "transporte", pregunta: "Cómo vienen al instituto", categorias: ["Andando", "Autobús", "Coche", "Bici"] },
  { id: "musica", pregunta: "Música preferida", categorias: ["Pop", "Rap", "Rock", "Reguetón", "Clásica"] },
];

// ── "Lee el diagrama de barras" (dificultad 1) ──────────────────────────
// Tres preguntas: el valor de una barra, el total y la moda.
export function leeDiagramaBarras(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(ENCUESTAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const e = plan[i % plan.length];
    i += 1;
    const k = Math.min(e.categorias.length, azar.entero(4, 5));
    const categorias = e.categorias.slice(0, k);
    const paso = azar.elige([1, 2]);
    const valores = categorias.map(() => paso * azar.entero(1, paso === 1 ? 9 : 7));
    const max = Math.max(...valores);
    if (valores.filter((v) => v === max).length !== 1) return null;
    const moda = categorias[valores.indexOf(max)];
    const j = azar.elige(categorias.map((_, x) => x).filter((x) => valores[x] !== max));
    const total = valores.reduce((s, v) => s + v, 0);
    const frase = `${e.pregunta} de los alumnos de una clase. ¿Cuántos eligieron ${categorias[j].toLowerCase()}? ¿Cuántos alumnos hay en total? ¿Cuál es la moda?`;
    return {
      latex: `${frase} ___, ___, ___`,
      latexResuelto: `${frase} ${valores[j]}, ${total}, ${moda.toLowerCase()}`,
      texto: `${frase} → ___, ___, ___`,
      solucion: [String(valores[j]), String(total), moda.toLowerCase()],
      modaComoFrecuencia: [String(valores[j]), String(total), String(max)],
      contexto: e.id,
      figura: { tipo: "barras", categorias, valores, paso, nombreY: "Alumnos", descripcion: "Diagrama de barras" },
      razon: `La barra de ${categorias[j].toLowerCase()} llega a ${valores[j]}. El total es la suma de todas las barras: ${valores.join(" + ")} = ${total}. La moda es la categoría de la barra más alta (${moda.toLowerCase()}), no su altura (${max}).`,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "lee_diagrama_barras",
    arquetipo: "Lee la información de un diagrama de barras",
    enunciado: "Mira el diagrama de barras y contesta:",
    tipo: "problema",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

const REPARTOS = [
  { id: "desayuno", frase: "Lo que desayunan", categorias: ["Leche", "Zumo", "Cacao", "Nada"] },
  { id: "vacaciones", frase: "Dónde pasaron las vacaciones", categorias: ["Playa", "Montaña", "Pueblo", "Ciudad"] },
  { id: "extraescolar", frase: "La actividad extraescolar de", categorias: ["Deporte", "Música", "Idiomas", "Ninguna"] },
  { id: "recreo", frase: "Lo que hacen en el recreo", categorias: ["Jugar", "Hablar", "Leer"] },
];

// ── "Calcula los ángulos del diagrama de sectores" (dificultad 2) ───────
// 20 o 40 personas: el ángulo de cada una (18° o 9°) es entero. El error 4
// (el porcentaje como ángulo) da 5 % o 2,5 % por persona.
export function angulosDeSectores(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(REPARTOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const r = plan[i];
    i += 1;
    if (!r) return null;
    const n = azar.elige([20, 40]);
    const f = reparto(azar, n, r.categorias.length);
    if (!f) return null;
    const angulos = f.map((x) => (x * 360) / n);
    const pct = f.map((x) => (x * 100) / n);
    const vacia = tablaDeFilas([["", r.categorias], ["Personas", f], ["Ángulo", r.categorias.map(() => HUECO_TABLA)]]);
    const llena = tablaDeFilas([["", r.categorias], ["Personas", f], ["Ángulo", angulos.map((a) => `${a}^\\circ`)]]);
    const frase = `${r.frase} ${n} personas.`;
    return {
      latex: `${frase} $${vacia}$`,
      latexResuelto: `${frase} $${llena}$`,
      texto: `${frase} ${r.categorias.map((c, j) => `${c}: ${f[j]}`).join(", ")} → ángulos ___`,
      solucion: angulos.map((a) => `${a}°`),
      porcentajeComoAngulo: pct.map((p) => `${coma(p)}°`),
      contexto: r.id,
      razon: `El círculo entero son 360° para ${n} personas: cada persona son 360 : ${n} = ${360 / n}°. ${r.categorias[0]}: ${f[0]} · ${360 / n} = ${angulos[0]}°. Comprobación: los ángulos suman 360°.`,
    };
  }, { cuantos, clave: (a) => a.contexto });

  return {
    clave: "angulos_de_sectores",
    arquetipo: "Calcula los ángulos de un diagrama de sectores",
    enunciado: "Calcula el ángulo de cada sector para hacer el diagrama de sectores:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
