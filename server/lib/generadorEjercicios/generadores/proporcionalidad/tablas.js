import { reuneApartados } from "../../ejercicio.js";
import { conComa } from "./numeros.js";

// PROPORCIONALIDAD, OBJETIVO 2 (primera mitad): MAGNITUDES DIRECTAMENTE
// PROPORCIONALES EN TABLAS (concepto 3). Saber A.5: «Situaciones de
// proporcionalidad en diferentes contextos».
//
// La tabla se dibuja con un `array` de LaTeX: dos filas (las dos
// magnitudes) y cuatro columnas de valores.
//
// EL ERROR QUE TIENEN QUE PODER PROVOCAR es el 2, el ADITIVO: la tabla
// 2 → 5, 4 → 7, 6 → 9 "crece igual" y no es proporcional (se suma 3, no se
// multiplica). Por eso los "no" de "¿son proporcionales?" son así, y en
// "completa la tabla" la respuesta-trampa es la que sale sumando.

const MAGNITUDES = [
  ["Kilos", "Euros"],
  ["Horas", "Km"],
  ["Personas", "Litros"],
  ["Entradas", "Euros"],
  ["Minutos", "Páginas"],
  ["Cajas", "Botellas"],
];

// La constante de proporcionalidad: entera o de medio en medio (3/2), para
// que no se resuelva siempre con la tabla del mismo número.
function constante(azar) {
  return azar.suerte(0.3) ? { n: 2 * azar.entero(1, 4) + 1, d: 2 } : { n: azar.entero(2, 9), d: 1 };
}

// Cuatro valores de la primera fila, crecientes y múltiplos de d.
function primeraFila(azar, d) {
  const valores = new Set();
  while (valores.size < 4) valores.add(d * azar.entero(1, 12 / d + 2));
  return [...valores].sort((p, q) => p - q);
}

function tabla(nombres, xs, ys) {
  const fila = (nombre, vs) => `\\text{${nombre}} & ${vs.join(" & ")}`;
  return `\\begin{array}{|l|c|c|c|c|}\\hline ${fila(nombres[0], xs)} \\\\ \\hline ${fila(nombres[1], ys)} \\\\ \\hline\\end{array}`;
}
const tablaTexto = (nombres, xs, ys) => `${nombres[0]}: ${xs.join(", ")} | ${nombres[1]}: ${ys.join(", ")}`;

// ── "¿Son directamente proporcionales?" (dificultad 1) ──────────────────
// De 3 a 4 tablas, alternando sí y no; los "no" suman siempre lo mismo.
export function sonProporcionales(azar, { cuantos = 3 } = {}) {
  let i = 0;
  const plan = azar.mezcla(MAGNITUDES);
  const { apartados } = reuneApartados(() => {
    const nombres = plan[i % plan.length];
    const si = i % 2 === 0;
    i += 1;
    const k = constante(azar);
    const xs = primeraFila(azar, k.d);
    const suma = azar.entero(2, 9);
    const ys = si ? xs.map((x) => (x * k.n) / k.d) : xs.map((x) => x + suma);
    // Un "no" aditivo con x0 + suma = x0 · algo sería proporcional en la
    // primera columna y confunde: se exige que no lo sea en ninguna.
    if (!si && xs.some((x, j) => j > 0 && ys[j] * xs[0] === ys[0] * x)) return null;
    const cocientes = xs.map((x, j) => `${ys[j]} : ${x} = ${conComa(ys[j] / x)}`);
    return {
      latex: `$${tabla(nombres, xs, ys)}$ ___`,
      latexResuelto: `$${tabla(nombres, xs, ys)}$ ${si ? "Sí" : "No"}`,
      texto: `${tablaTexto(nombres, xs, ys)} ___`,
      solucion: si ? "sí" : "no",
      aditiva: !si,
      razon: si
        ? `Al dividir cada valor de abajo entre el de arriba sale siempre lo mismo (${cocientes.slice(0, 2).join("; ")}…): sí.`
        : `Abajo siempre hay ${suma} más que arriba, pero al dividir no sale lo mismo (${cocientes.slice(0, 2).join("; ")}): no. Si uno se duplica, el otro no se duplica.`,
    };
  }, { cuantos, clave: (a) => a.texto.split(":")[0] });

  return {
    clave: "son_proporcionales",
    arquetipo: "Decide si las magnitudes de la tabla son directamente proporcionales",
    enunciado: "¿Son directamente proporcionales? Contesta sí o no:",
    tipo: "ejercicio",
    dificultad: 1,
    columnas: 1,
    apartados,
  };
}

// ── "Completa la tabla de proporcionalidad" (dificultad 2) ──────────────
// De 3 a 4 tablas con dos huecos, a y b: uno en cada fila, para que haya
// que multiplicar por la constante y también dividir entre ella.
export function completaTabla(azar, { cuantos = 3 } = {}) {
  let i = 0;
  const plan = azar.mezcla(MAGNITUDES);
  const { apartados } = reuneApartados(() => {
    const nombres = plan[i % plan.length];
    i += 1;
    const k = constante(azar);
    const xs = primeraFila(azar, k.d);
    const ys = xs.map((x) => (x * k.n) / k.d);
    // El primer par siempre visible: de ahí sale la constante.
    const [ja, jb] = azar.mezcla([1, 2, 3]).slice(0, 2).sort();
    const x2 = [...xs]; const y2 = [...ys];
    y2[ja] = "a";
    x2[jb] = "b";
    const [a, b] = [ys[ja], xs[jb]];
    const kTexto = conComa(k.n / k.d);
    // Error 2: se suma la diferencia de la primera columna.
    const dif = ys[0] - xs[0];
    return {
      latex: `$${tabla(nombres, x2, y2)}$ $a =$ ___, $b =$ ___`,
      latexResuelto: `$${tabla(nombres, x2, y2)}$ $a = ${a}$, $b = ${b}$`,
      texto: `${tablaTexto(nombres, x2, y2)}; a = ___, b = ___`,
      solucion: [a, b],
      aditiva: [xs[ja] + dif, ys[jb] - dif],
      razon: `La constante es ${ys[0]} : ${xs[0]} = ${kTexto}. Para ir de arriba abajo se multiplica: a = ${xs[ja]} · ${kTexto} = ${a}; `
        + `y de abajo arriba se divide: b = ${ys[jb]} : ${kTexto} = ${b}.`,
    };
  }, { cuantos, clave: (a) => a.texto.split(":")[0] });

  return {
    clave: "completa_tabla_proporcional",
    arquetipo: "Completa la tabla de proporcionalidad directa",
    enunciado: "Las magnitudes son directamente proporcionales. Completa la tabla:",
    tipo: "ejercicio",
    dificultad: 2,
    columnas: 1,
    apartados,
  };
}
