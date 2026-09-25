import { reuneApartados } from "../../ejercicio.js";
import { figuraDeAngulo, figuraDeTrianguloPorAngulos } from "./figuras.js";

// GEOMETRÍA, OBJETIVOS 1 Y 2: MEDIR, CLASIFICAR Y RELACIONAR ÁNGULOS
// (conceptos 1 y 2). Saber B.2: «Medición directa de ángulos y deducción
// de la medida a partir de las relaciones angulares».
//
// LOS ÁNGULOS PARA MEDIR VAN A ESCALA REAL (ver ./figuras.js): un ángulo
// de 40° mide 40° con el transportador del alumno.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   6 confundir complementario (suman 90°) y suplementario (suman 180°);
//   7 creer que los ángulos de un triángulo suman 360°.

const TIPO = (g) => (g < 90 ? "agudo" : g === 90 ? "recto" : g < 180 ? "obtuso" : "llano");

// ── "Mide el ángulo" (dificultad 1) ─────────────────────────────────────
// De 3 a 4 ángulos múltiplos de 5, entre 20° y 160°, sin el 90 (que no se
// mide: se ve el cuadradito).
export function mideAngulo(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const g = 5 * azar.entero(4, 32);
    if (g === 90) return null;
    return {
      latex: "Mide: ___",
      latexResuelto: `Mide: ${g}°`,
      texto: `Ángulo de ${g}° → ___`,
      solucion: `${g}°`,
      grados: g,
      figura: figuraDeAngulo(g),
      razon: `El centro del transportador en el vértice y el 0 sobre el lado horizontal; se lee en la escala que empieza en 0: ${g}°.`,
    };
  }, { cuantos, clave: (a) => String(Math.round(a.grados / 20)) });

  return {
    clave: "mide_angulo",
    arquetipo: "Mide el ángulo con el transportador",
    enunciado: "Mide cada ángulo con el transportador (puede haber 2° de diferencia):",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

// ── "Clasifica el ángulo" (dificultad 1) ────────────────────────────────
// De 4 a 6: agudo, recto, obtuso y llano, lejos de los bordes (nada de 85°
// ni de 95°: aquí se clasifica mirando, no midiendo).
export function clasificaAngulo(azar, { cuantos = 4 } = {}) {
  const TIPOS = ["agudo", "recto", "obtuso", "llano"];
  const plan = [...azar.mezcla(TIPOS), ...azar.mezcla(TIPOS)];
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const t = plan[i % plan.length];
    i += 1;
    const g = { agudo: 5 * azar.entero(4, 14), recto: 90, obtuso: 5 * azar.entero(22, 32), llano: 180 }[t];
    return {
      latex: "___",
      latexResuelto: t,
      texto: `Ángulo de ${g}° → ___`,
      solucion: t,
      grados: g,
      figura: figuraDeAngulo(g, 18),
      razon: { agudo: "Más cerrado que un recto: agudo.", recto: "El cuadradito dice que mide 90°: recto.", obtuso: "Más abierto que un recto y menos que un llano: obtuso.", llano: "Los dos lados forman una recta: 180°, llano." }[t],
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "clasifica_angulo",
    arquetipo: "Clasifica el ángulo en agudo, recto, obtuso o llano",
    enunciado: "Escribe si cada ángulo es agudo, recto, obtuso o llano:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 3,
    apartados,
  };
}

// ── "Complementario y suplementario" (dificultad 1) ─────────────────────
// De 6 a 8, mitad y mitad; el ángulo nunca es 45° (su complementario es él
// mismo, y el error 6 da 135°, que no se distingue de otro despiste).
export function complementarioSuplementario(azar, { cuantos = 6 } = {}) {
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const comp = i % 2 === 0;
    i += 1;
    const g = comp ? 5 * azar.entero(2, 16) : 5 * azar.entero(4, 32);
    if (g === 45 || g === 90) return null;
    const r = comp ? 90 - g : 180 - g;
    const frase = `El ${comp ? "complementario" : "suplementario"} de ${g}°`;
    return {
      latex: `${frase}: ___`,
      latexResuelto: `${frase}: ${r}°`,
      texto: `${frase}: ___`,
      solucion: `${r}°`,
      confundido: comp ? `${180 - g}°` : (g < 90 ? `${90 - g}°` : null),
      razon: `${comp ? "Complementarios: suman 90°" : "Suplementarios: suman 180°"}. ${comp ? 90 : 180}° − ${g}° = ${r}°.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "complementario_suplementario",
    arquetipo: "Calcula el complementario o el suplementario de un ángulo",
    enunciado: "Calcula:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 2,
    apartados,
  };
}

// ── "El ángulo que falta en el triángulo" (dificultad 2) ────────────────
// De 3 a 4: dos ángulos marcados en la figura y la x en el tercero.
export function anguloDelTriangulo(azar, { cuantos = 3 } = {}) {
  const { apartados } = reuneApartados(() => {
    const a = 5 * azar.entero(6, 18);
    const b = 5 * azar.entero(6, 18);
    const c = 180 - a - b;
    if (c < 25 || a === b) return null;
    // La x va en uno de los tres, a suertes.
    const donde = azar.entero(0, 2);
    const valores = [a, b, c];
    const rotulos = valores.map((v, j) => (j === donde ? "x" : `${v}°`));
    const dados = valores.filter((_, j) => j !== donde);
    return {
      latex: "$x =$ ___",
      latexResuelto: `$x = ${valores[donde]}°$`,
      texto: `Ángulos ${dados[0]}° y ${dados[1]}° → x = ___`,
      solucion: `${valores[donde]}°`,
      a: dados[0], b: dados[1],
      figura: figuraDeTrianguloPorAngulos(a, b, rotulos),
      razon: `Los tres ángulos de un triángulo suman 180°: x = 180° − ${dados[0]}° − ${dados[1]}° = ${valores[donde]}°.`,
    };
  }, { cuantos, clave: (a) => a.texto });

  return {
    clave: "angulo_del_triangulo",
    arquetipo: "Calcula el ángulo que falta en un triángulo",
    enunciado: "Calcula el ángulo x (los ángulos de un triángulo suman 180°):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados,
  };
}
