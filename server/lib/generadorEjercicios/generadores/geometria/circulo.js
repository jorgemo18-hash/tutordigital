import { reuneApartados } from "../../ejercicio.js";
import { dec, producto, texto } from "../decimales/decimal.js";

// GEOMETRÍA, OBJETIVO 5: LA CIRCUNFERENCIA Y EL CÍRCULO (concepto 6). Saber
// B.2: «Longitud de la circunferencia, áreas en figuras planas…».
//
// π ≈ 3,14 y a mano (en 1.º no hay calculadora): radios enteros pequeños y
// la cuenta exacta con decimal.js. La mitad de las figuras dan el DIÁMETRO
// y no el radio: es el error 4.
//
// LOS ERRORES QUE TIENEN QUE PODER PROVOCAR:
//   4 usar el diámetro como si fuera el radio;
//   5 calcular r² como r · 2.

const PI = dec(314, 2);

function figuraDeCirculo(r, conDiametro) {
  const elementos = [{ circulo: { centro: [0, 0], radio: r } }, { punto: [0, 0] }];
  if (conDiametro) {
    elementos.push({ segmento: [[-r, 0], [r, 0]] }, { etiqueta: { en: [r * 0.5, 0], texto: `${2 * r} cm`, dy: -1.2 } });
  } else {
    elementos.push({ segmento: [[0, 0], [r, 0]] }, { etiqueta: { en: [r * 0.5, 0], texto: `${r} cm`, dy: -1.2 } });
  }
  return { tipo: "geometria", descripcion: conDiametro ? "Un círculo con su diámetro" : "Un círculo con su radio", elementos };
}

function bateriaDeCirculo(azar, cuantos, que) {
  let i = 0;
  return reuneApartados(() => {
    const conDiametro = i % 2 === 1;
    i += 1;
    const r = azar.entero(2, 10);
    const R = dec(r);
    const bien = que === "longitud" ? producto(producto(dec(2), PI), R) : producto(PI, producto(R, R));
    // Error 4: el número de la figura tomado como radio (si es el diámetro).
    const d = dec(2 * r);
    const conDiametroComoRadio = que === "longitud" ? producto(producto(dec(2), PI), d) : producto(PI, producto(d, d));
    // Error 5 (área): r² como r · 2.
    const r2MalCalculado = producto(PI, producto(R, dec(2)));
    const unidad = que === "longitud" ? "cm" : "cm²";
    const cuenta = que === "longitud" ? `2 · 3,14 · ${r} = ${texto(bien)}` : `3,14 · ${r}² = 3,14 · ${r * r} = ${texto(bien)}`;
    return {
      latex: `${que === "longitud" ? "Longitud" : "Área"} = ___ ${unidad}`,
      latexResuelto: `${que === "longitud" ? "Longitud" : "Área"} = ${texto(bien)} ${unidad}`,
      texto: `${conDiametro ? "Diámetro" : "Radio"} ${conDiametro ? 2 * r : r} → ${que} = ___`,
      solucion: texto(bien),
      diametroComoRadio: conDiametro ? texto(conDiametroComoRadio) : null,
      r2ComoDoble: que === "area" && r !== 2 ? texto(r2MalCalculado) : null,
      figura: figuraDeCirculo(r, conDiametro),
      razon: `${conDiametro ? `El diámetro mide ${2 * r} cm, así que el radio es la mitad, ${r} cm. ` : ""}${que === "longitud" ? "L = 2 · π · r" : "A = π · r²"}: ${cuenta} ${unidad}.`,
    };
  }, { cuantos, clave: (a) => a.texto }).apartados;
}

// ── "Longitud de la circunferencia" (dificultad 2) ──────────────────────
export function longitudCircunferencia(azar, { cuantos = 4 } = {}) {
  return {
    clave: "longitud_circunferencia",
    arquetipo: "Calcula la longitud de la circunferencia",
    enunciado: "Calcula la longitud de la circunferencia (π ≈ 3,14):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados: bateriaDeCirculo(azar, cuantos, "longitud"),
  };
}

// ── "Área del círculo" (dificultad 2) ───────────────────────────────────
export function areaCirculo(azar, { cuantos = 4 } = {}) {
  return {
    clave: "area_circulo",
    arquetipo: "Calcula el área del círculo",
    enunciado: "Calcula el área del círculo (π ≈ 3,14):",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 3,
    apartados: bateriaDeCirculo(azar, cuantos, "area"),
  };
}
