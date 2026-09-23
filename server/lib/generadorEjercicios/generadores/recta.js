import { reuneApartados } from "../ejercicio.js";
import { escribeNumero } from "../explicacion.js";

// OBJETIVO 1: LA RECTA NUMÉRICA (concepto 6 del catálogo, saber A.2).
//
// El generador NO dibuja: describe cada recta con números (ver la forma de la
// figura en assets/shared/hoja/js/rectaNumerica.js) y la plantilla la pinta.
// Es lo que dejó escrito la migración 120 para estos arquetipos.
//
// DOS FAMILIAS Y DOS NIVELES. Jorge, el 23/9, sobre qué números van escritos
// en la recta y si va siempre de 1 en 1: *"depende de si es al principio, al
// final del tema, si lo quieres poner más fácil para aprender o más difícil
// para profundizar"*. Por eso cada familia tiene dos baterías:
//
//   - dificultad 1: la recta va de 1 en 1 y lleva escritos el 0 y el 1, que
//     es la convención de los libros de 1.º ESO (origen y unidad).
//   - dificultad 2: la recta va de 2, 5 o 10 en 10 y lleva escritos el 0 y la
//     primera marca. Hay que deducir cuánto vale cada marca antes de colocar
//     nada, que es donde aparece el error de contar marcas como unidades.
//
// Quién elige una u otra es quien monta la hoja, no este archivo.

const LETRAS = ["A", "B", "C", "D", "E"];
const PASOS = [2, 5, 10];

// La recta de dificultad 1: de -10 a 10, 21 marcas. En 150 mm quedan a 6,8 mm,
// que es lo que hace falta para que "−10" y "−9" no se pisen debajo.
const RECTA_UNIDAD = { desde: -10, hasta: 10, paso: 1 };
// La graduada: 17 marcas, de -8 a 8 veces el paso.
const MARCAS_A_CADA_LADO = 8;

function rectaGraduada(paso) {
  return { desde: -MARCAS_A_CADA_LADO * paso, hasta: MARCAS_A_CADA_LADO * paso, paso };
}

// `cuantos` valores distintos de la recta, sin los rotulados (colocar o leer
// un número que ya está escrito no es ejercicio), con al menos dos negativos y
// un positivo. Los negativos son los que fallan: sin ellos el ejercicio es
// contar hacia la derecha.
function valoresDeLaRecta(azar, recta, rotulos, cuantos) {
  const posibles = [];
  for (let v = recta.desde; v <= recta.hasta; v += recta.paso) {
    if (!rotulos.includes(v)) posibles.push(v);
  }
  const negativos = azar.mezcla(posibles.filter((v) => v < 0));
  const positivos = azar.mezcla(posibles.filter((v) => v > 0));
  const elegidos = [negativos[0], negativos[1], positivos[0]];
  const resto = azar.mezcla([...negativos.slice(2), ...positivos.slice(1)]);
  return azar.mezcla([...elegidos, ...resto.slice(0, cuantos - elegidos.length)]);
}

function cuantoVale(paso) {
  return paso === 1 ? "Cada marca es 1" : `Cada marca vale ${paso} (del 0 al ${paso} hay una marca)`;
}

function dondeEsta(v, paso) {
  const marcas = Math.abs(v) / paso;
  const lado = v < 0 ? "a la izquierda" : "a la derecha";
  return `${escribeNumero(v)} está ${marcas} ${marcas === 1 ? "marca" : "marcas"} ${lado} del 0`;
}

// ── REPRESENTAR ─────────────────────────────────────────────────────────────

function apartadoRepresenta(azar, recta, cuantosNumeros) {
  const rotulos = [0, recta.paso];
  const valores = valoresDeLaRecta(azar, recta, rotulos, cuantosNumeros);
  const lista = valores.join(",\\ ");
  const figura = { tipo: "recta", ...recta, rotulos, puntos: [] };
  // El que se explica es el negativo más lejano: es el que más se coloca mal.
  const ejemplo = Math.min(...valores);
  return {
    latex: `$${lista}$`,
    latexResuelto: `$${lista}$`,
    texto: valores.join(", "),
    figura,
    // En el ejemplo resuelto cada punto lleva su número encima.
    figuraResuelta: { ...figura, puntos: valores.map((valor) => ({ valor })) },
    solucion: valores,
    razon: `${cuantoVale(recta.paso)}: ${dondeEsta(ejemplo, recta.paso)}. `
      + "Los negativos van a la izquierda del 0 y los positivos a la derecha.",
  };
}

// "Representa estos números en la recta numérica" (dificultad 1).
// Instrucción: la IA solo aporta {de, a, marcar}; aquí se decide todo.
// Cinco números por recta, como el ejemplo sembrado: `2, -3, 5, -4, -7`.
export function representaEnRecta(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(
    () => apartadoRepresenta(azar, RECTA_UNIDAD, 5),
    { cuantos },
  );
  return {
    clave: "representa_en_recta",
    arquetipo: "Representa estos números en la recta numérica",
    enunciado: "Representa estos números en la recta:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// "Representa en una recta graduada de 2, 5 o 10 en 10" (dificultad 2).
// Cada recta de la batería va con un paso distinto: si todas fueran de 5 en 5,
// a la segunda ya no se mira cuánto vale la marca.
export function representaEnRectaGraduada(azar, { cuantos = 2 } = {}) {
  const pasos = azar.mezcla(PASOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const paso = pasos[i % pasos.length];
    i += 1;
    return apartadoRepresenta(azar, rectaGraduada(paso), 4);
  }, { cuantos });
  return {
    clave: "representa_en_recta_graduada",
    arquetipo: "Representa en una recta graduada de 2, 5 o 10 en 10",
    enunciado: "Representa estos números. Mira primero cuánto vale cada marca:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}

// ── LEER ────────────────────────────────────────────────────────────────────

function apartadoLee(azar, recta) {
  const rotulos = [0, recta.paso];
  const valores = valoresDeLaRecta(azar, recta, rotulos, 4);
  // LAS LETRAS NO VAN DE IZQUIERDA A DERECHA. Si A fuera siempre el de más a
  // la izquierda, bastaría con escribir los números en orden creciente.
  const puntos = valores.map((valor, i) => ({ valor, etiqueta: LETRAS[i] }));
  const huecos = puntos.map((p) => `${p.etiqueta} = ___`).join("  ");
  const resueltos = puntos.map((p) => `${p.etiqueta} = $${p.valor}$`).join("  ");
  const ejemplo = puntos.reduce((a, b) => (b.valor < a.valor ? b : a));
  return {
    latex: huecos,
    latexResuelto: resueltos,
    texto: puntos.map((p) => `${p.etiqueta} = ${p.valor}`).join("  "),
    figura: { tipo: "recta", ...recta, rotulos, puntos },
    solucion: valores,
    razon: `${cuantoVale(recta.paso)}: ${ejemplo.etiqueta} está ${Math.abs(ejemplo.valor) / recta.paso} `
      + `marcas a la izquierda del 0, así que ${ejemplo.etiqueta} = ${escribeNumero(ejemplo.valor)}.`,
  };
}

// "Lee los puntos marcados en la recta" (dificultad 1). Arquetipo nuevo de la
// migración 127.
export function leeLaRecta(azar, { cuantos = 2 } = {}) {
  const { apartados } = reuneApartados(() => apartadoLee(azar, RECTA_UNIDAD), { cuantos });
  return {
    clave: "lee_la_recta",
    arquetipo: "Lee los puntos marcados en la recta",
    enunciado: "Escribe qué número es cada punto:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// "Lee una recta graduada de 2, 5 o 10 en 10" (dificultad 2). Migración 127.
export function leeLaRectaGraduada(azar, { cuantos = 2 } = {}) {
  const pasos = azar.mezcla(PASOS);
  let i = 0;
  const { apartados } = reuneApartados(() => {
    const paso = pasos[i % pasos.length];
    i += 1;
    return apartadoLee(azar, rectaGraduada(paso));
  }, { cuantos });
  return {
    clave: "lee_la_recta_graduada",
    arquetipo: "Lee una recta graduada de 2, 5 o 10 en 10",
    enunciado: "Escribe qué número es cada punto. Mira primero cuánto vale cada marca:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
