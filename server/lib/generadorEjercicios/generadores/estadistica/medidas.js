import { reuneApartados } from "../../ejercicio.js";
import { coma, exacto, tablaDeFilas, lista } from "./escritura.js";
import { suma, ordena, mediana, medianaSinOrdenar, modaUnica } from "./calculos.js";

// ESTADÍSTICA, OBJETIVO 3: MEDIDAS (conceptos 4 y 5). Saber E.1: «Medidas
// de localización: interpretación y cálculo…» y «Comparación de dos
// conjuntos de datos atendiendo a las medidas de localización y
// dispersión».
//
// En 1.º no hay calculadora en estas hojas: las medias salen exactas (de
// una tabla, como mucho con un decimal) y las listas son cortas.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   3 dar como moda cuántas veces sale (la frecuencia) en vez del valor;
//   5 buscar la mediana sin ordenar los datos (el del medio de la lista tal
//     como viene);
//   6 hacer la media de una tabla sin las frecuencias (los valores distintos
//     entre cuántos son);
//   7 decir que es más regular el de MAYOR rango.

const LISTAS = [
  { id: "notas", frase: "Notas de un alumno en los exámenes del trimestre", de: 3, a: 10 },
  { id: "goles", frase: "Goles de un equipo en sus últimos partidos", de: 0, a: 6 },
  { id: "temperaturas", frase: "Temperaturas máximas (°C) de una semana", de: 12, a: 24 },
  { id: "puntos", frase: "Puntos de una jugadora de baloncesto en cada partido", de: 4, a: 18 },
  { id: "horas", frase: "Horas que ha dormido Lucía cada noche", de: 6, a: 10 },
];

// ── "Calcula la media, la mediana y la moda" (dificultad 1) ─────────────
export function mediaMedianaModa(azar, { cuantos = 3 } = {}) {
  const plan = azar.mezcla(LISTAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const l = plan[i % plan.length];
    i += 1;
    const n = azar.entero(5, 8);
    const datos = Array.from({ length: n }, () => azar.entero(l.de, l.a));
    if (suma(datos) % n) return null;
    const m = modaUnica(datos);
    if (!m) return null;
    const media = suma(datos) / n;
    const med = mediana(datos);
    // Que el error 5 se vea: la lista no puede venir ya ordenada, y la del
    // medio sin ordenar tiene que dar otra cosa.
    if (medianaSinOrdenar(datos) === med) return null;
    // Y que no salgan las tres iguales: no se distinguiría cuál sabe.
    if (new Set([media, med, m.moda]).size < 2) return null;
    const frase = `${l.frase}: ${lista(datos)}.`;
    const o = ordena(datos);
    return {
      latex: `${frase} Media: ___ Mediana: ___ Moda: ___`,
      latexResuelto: `${frase} Media: ${coma(media)}. Mediana: ${coma(med)}. Moda: ${m.moda}`,
      texto: `${frase} → media ___, mediana ___, moda ___`,
      solucion: [coma(media), coma(med), String(m.moda)],
      datos,
      sinOrdenar: [coma(media), coma(medianaSinOrdenar(datos)), String(m.moda)],
      modaComoFrecuencia: [coma(media), coma(med), String(m.veces)],
      razon: `Media: ${datos.join(" + ")} = ${suma(datos)}; ${suma(datos)} : ${n} = ${coma(media)}. Mediana: se ORDENAN (${o.join(", ")}) y se toma ${n % 2 ? "el del medio" : "la media de los dos del medio"}: ${coma(med)}. Moda: el que más se repite, ${m.moda} (sale ${m.veces} veces).`,
    };
  }, { cuantos, intentos: 400, clave: (a) => a.texto });

  return {
    clave: "media_mediana_moda",
    arquetipo: "Calcula la media, la mediana y la moda",
    enunciado: "Calcula la media, la mediana y la moda:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

const TABLAS = [
  { id: "hermanos", frase: "Número de hermanos de los alumnos de una clase", valores: [0, 1, 2, 3] },
  { id: "goles", frase: "Goles por partido de un equipo en la liga", valores: [0, 1, 2, 3, 4] },
  { id: "notas", frase: "Notas de un examen de una clase", valores: [4, 5, 6, 7, 8] },
  { id: "pie", frase: "Número de pie de un grupo de amigos", valores: [37, 38, 39, 40] },
];

// ── "Calcula la media de una tabla de frecuencias" (dificultad 2) ───────
export function mediaDeTabla(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(TABLAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const t = plan[i % plan.length];
    i += 1;
    const f = t.valores.map(() => azar.entero(1, 7));
    const n = suma(f);
    const sxf = suma(t.valores.map((x, j) => x * f[j]));
    // Una cifra decimal como mucho: sin calculadora.
    if (!exacto(sxf, n, 1)) return null;
    const media = sxf / n;
    const k = t.valores.length;
    const sinFrecuencias = exacto(suma(t.valores), k, 1) ? coma(suma(t.valores) / k) : null;
    if (sinFrecuencias === coma(media)) return null;
    const tabla = tablaDeFilas([["Valor", t.valores], ["Frecuencia", f]]);
    return {
      latex: `${t.frase}: $${tabla}$ Media: ___`,
      latexResuelto: `${t.frase}: $${tabla}$ Media: ${coma(media)}`,
      texto: `${t.frase}: ${t.valores.map((x, j) => `${x} (${f[j]} veces)`).join(", ")} → media ___`,
      solucion: coma(media),
      sinFrecuencias,
      contexto: t.id,
      razon: `Cada valor por las veces que sale: ${t.valores.map((x, j) => `${x} · ${f[j]}`).join(" + ")} = ${sxf}. Entre el total de datos, ${f.join(" + ")} = ${n}: ${sxf} : ${n} = ${coma(media)}.`,
    };
  }, { cuantos, intentos: 400, clave: (a) => a.contexto });

  return {
    clave: "media_de_tabla",
    arquetipo: "Calcula la media de una tabla de frecuencias",
    enunciado: "Calcula la media:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

const PAREJAS = [
  { id: "baloncesto", frase: (a, b) => `Puntos de ${a} y de ${b} en los últimos cinco partidos.`, nombres: [["Ana", "Luis"], ["Marta", "Hugo"]], de: 4, a: 26 },
  { id: "atletismo", frase: (a, b) => `Segundos que tardan ${a} y ${b} en correr 100 m en cinco carreras.`, nombres: [["Irene", "Pablo"], ["Sara", "Mario"]], de: 13, a: 21 },
  { id: "notas", frase: (a, b) => `Notas de ${a} y de ${b} en cinco exámenes.`, nombres: [["Lucía", "Daniel"], ["Carla", "Álex"]], de: 2, a: 10 },
];

// Cinco datos de media `media` con rango `rango` (el primero y el último
// fijan el rango; los tres de dentro cuadran la suma).
function cincoDatos(azar, media, rango, de, a) {
  const min = media - azar.entero(1, rango - 1);
  const max = min + rango;
  if (min < de || max > a) return null;
  const resto = 5 * media - min - max;
  for (let intento = 0; intento < 30; intento += 1) {
    const x = azar.entero(min, max);
    const y = azar.entero(min, max);
    const z = resto - x - y;
    if (z >= min && z <= max) return azar.mezcla([min, max, x, y, z]);
  }
  return null;
}

// ── "Compara dos conjuntos de datos" (dificultad 3) ─────────────────────
// La misma media y distinto rango: la media no decide, decide el rango.
export function comparaConjuntos(azar, { cuantos = 2 } = {}) {
  const plan = azar.mezcla(PAREJAS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const p = plan[i % plan.length];
    i += 1;
    const [a, b] = azar.elige(p.nombres);
    const media = azar.entero(p.de + 3, p.a - 3);
    const r1 = azar.entero(2, 4);
    const r2 = r1 + azar.entero(4, 8);
    const [rA, rB] = azar.suerte() ? [r1, r2] : [r2, r1];
    const A = cincoDatos(azar, media, rA, p.de, p.a);
    const B = cincoDatos(azar, media, rB, p.de, p.a);
    if (!A || !B) return null;
    // En atletismo, más regular sigue siendo el de menos rango; mejor
    // marca no se pregunta.
    const regular = rA < rB ? a : b;
    const otro = regular === a ? b : a;
    const frase = `${p.frase(a, b)} ${a}: ${lista(A)}. ${b}: ${lista(B)}. Calcula la media y el rango de cada uno. ¿Quién es más regular?`;
    return {
      latex: `${frase} Medias: ___, ___ Rangos: ___, ___ Más regular: ___`,
      latexResuelto: `${frase} Medias: ${media}, ${media}. Rangos: ${rA}, ${rB}. Más regular: ${regular}`,
      texto: `${frase} → medias ___, ___; rangos ___, ___; ___`,
      solucion: [String(media), String(media), String(rA), String(rB), regular],
      alReves: [String(media), String(media), String(rA), String(rB), otro],
      contexto: `${p.id}-${a}`,
      razon: `Las dos medias son ${media} (${A.join(" + ")} = ${5 * media}; ${5 * media} : 5 = ${media}), así que la media no decide. Rango = mayor − menor: ${a}, ${Math.max(...A)} − ${Math.min(...A)} = ${rA}; ${b}, ${Math.max(...B)} − ${Math.min(...B)} = ${rB}. Menos rango, datos más juntos: más regular, ${regular}.`,
    };
  }, { cuantos, intentos: 400, clave: (x) => x.contexto });

  return {
    clave: "compara_conjuntos",
    arquetipo: "Compara dos conjuntos de datos con la media y el rango",
    enunciado: "Resuelve:",
    tipo: "problema",
    dificultad: 3,
    columnas: 1,
    apartados,
  };
}
