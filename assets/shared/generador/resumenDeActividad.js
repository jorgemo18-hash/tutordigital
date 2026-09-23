// UN EJERCICIO DE LA HOJA EN UNA LÍNEA, para la lista de ejercicios.
//
// El diseño enseña cada hueco con su enunciado ("Calcula: (−7) + (+12)").
// Nuestras actividades son un enunciado con varios apartados ("Calcula:" y
// nueve cuentas), así que la línea es el enunciado y los primeros apartados,
// sin el ejemplo resuelto. Las fórmulas vienen en LaTeX entre $…$; aquí se
// dejan legibles como texto (el panel no carga KaTeX: la hoja de verdad está
// al lado, en la vista previa).
const LATEX = [
  [/\\cdot/g, "·"], [/\\times/g, "×"], [/\\div/g, ":"], [/\\left|\\right/g, ""],
  [/\\frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2"], [/\^\{([^}]*)\}/g, "^$1"], [/\\,|\;|\\ /g, " "],
  [/\\lvert|\\rvert|\\vert/g, "|"], [/\\ldots|\\dots/g, "…"], [/\\le(q)?/g, "≤"], [/\\ge(q)?/g, "≥"], [/\\ne(q)?/g, "≠"],
];

function formula(t) {
  let f = t;
  for (const [de, a] of LATEX) f = f.replace(de, a);
  // El menos de verdad (−) y no el guion, como en el papel. Solo dentro de
  // las fórmulas: en el texto un guion es un guion.
  return f.replace(/-/g, "−");
}

export function textoLegible(texto) {
  // Los trozos impares entre $ son fórmulas.
  const t = String(texto || "").split("$").map((trozo, i) => (i % 2 ? formula(trozo) : trozo)).join("");
  return t.replace(/\s+/g, " ").trim();
}

function textoDelApartado(a) {
  return typeof a === "string" ? a : a?.texto || "";
}

export const APARTADOS_EN_EL_RESUMEN = 3;

export function resumenDeActividad(actividad) {
  const enunciado = textoLegible(actividad?.enunciado);
  const apartados = (actividad?.apartados || []).filter((a) => !(a && typeof a === "object" && a.resuelto));
  const muestra = apartados.slice(0, APARTADOS_EN_EL_RESUMEN).map((a) => textoLegible(textoDelApartado(a)));
  const mas = apartados.length > APARTADOS_EN_EL_RESUMEN ? " …" : "";
  return {
    enunciado,
    muestra: muestra.length ? `${muestra.join("  ·  ")}${mas}` : "",
    apartados: apartados.length,
  };
}
