import { APARTADOS } from "../../../../assets/shared/programacion/apartadosLegales.js";

// EL BORRADOR DE LOS APARTADOS DE TEXTO (c, e, f–ñ del artículo 59.3).
//
// Es lo que más tiempo quita de una programación y lo que menos cambia de un
// año a otro. La IA escribe un PRIMER BORRADOR adaptado a la materia, el
// curso y las unidades que ya tiene la programación; el profesor lo corrige.
//
// Tres reglas, y las tres están en el prompt:
//   1. No inventar datos del centro. Lo que depende del centro (nombre del
//      Plan Lector, actividades concretas, si hay programa bilingüe) va como
//      [a completar por el centro]. Una programación con un plan inventado
//      es peor que una con un hueco: el hueco se ve.
//   2. Coherente con lo que ya hay: las unidades y cómo se califica.
//   3. Solo los apartados que se piden (los vacíos): lo que el profesor ya
//      escribió no se toca nunca.
export const HERRAMIENTA = "redacta_apartados";
export const LETRAS_DE_TEXTO = APARTADOS.filter((a) => a.de === "texto").map((a) => a.letra);

export function promptDeTextos({ materia, curso }) {
  return [
    `Eres jefe de departamento de ${materia} en un instituto de Aragón y redactas la programación didáctica de ${curso ? `${curso}.º de ESO` : "ESO"} según el artículo 59.3 de la ORDEN ECD/1172/2022 (LOMLOE).`,
    "Escribe un primer borrador de cada apartado que se te pide:",
    "- en español, registro profesional, concreto para esta materia y este curso (nada de frases que valgan para cualquier asignatura);",
    "- entre 80 y 220 palabras por apartado, en párrafos cortos o listas con guiones;",
    "- coherente con las unidades y la forma de calificar que te doy;",
    "- la evaluación, formativa y vinculada a los criterios de evaluación (es lo que pide la Orden);",
    "- NO inventes datos del centro: nombres de planes, proyectos, actividades o fechas concretas. Donde haga falta, escribe [a completar por el centro];",
    "- si un apartado no procede habitualmente (p. ej. m, programas bilingües), escribe una frase que lo diga y deja [a completar por el centro] por si hubiera programa.",
    "Devuelve solo el texto de cada apartado, sin repetir su título.",
  ].join("\n");
}

export function esquemaDeTextos(letras) {
  return {
    type: "object",
    properties: Object.fromEntries(letras.map((l) => [l, { type: "string" }])),
    required: letras,
  };
}

export function mensajeDeContexto({ curriculo, datos, letras }) {
  const unidades = (datos.unidades || []).map((u, i) => `UD ${i + 1}. ${u.titulo} (${u.trimestre}.º trimestre, ${u.sesiones} sesiones)`);
  const modo = datos.calificacion === "criterio" ? "por criterio de evaluación" : "por competencia específica";
  const pesos = Object.entries(datos.pesos || {}).map(([k, v]) => `${k}: ${v} %`).join(", ");
  const competencias = (curriculo.competencias || []).map((ce) => `${ce.codigo}: ${ce.texto || ""}`);
  const pedidos = letras.map((l) => {
    const a = APARTADOS.find((x) => x.letra === l);
    return `${l}) ${a?.titulo || ""}`;
  });
  return [
    `MATERIA: ${curriculo.materia}${datos.variante ? ` (${datos.variante})` : ""}`,
    `SESIONES: ${datos.sesionesSemanales || "?"} por semana, ${datos.semanas || 35} semanas.`,
    `UNIDADES:\n${unidades.join("\n") || "(todavía sin unidades)"}`,
    `CALIFICACIÓN: ${modo}${pesos ? `. Pesos: ${pesos}` : ""}.`,
    `COMPETENCIAS ESPECÍFICAS:\n${competencias.join("\n")}`,
    `APARTADOS QUE TIENES QUE REDACTAR:\n${pedidos.join("\n")}`,
  ].join("\n\n");
}

// Solo las letras pedidas, en texto, recortadas al máximo que guarda la
// programación (20.000 caracteres por apartado, ver programaciones.js).
export function validaTextos(entrada, letras) {
  const textos = {};
  for (const l of letras) {
    const t = typeof entrada?.[l] === "string" ? entrada[l].trim() : "";
    if (t) textos[l] = t.slice(0, 20000);
  }
  return textos;
}

export async function redactaTextos({ client, model, curriculo, datos, letras }) {
  const respuesta = await client.messages.create({
    model,
    max_tokens: Math.min(12000, 700 * letras.length + 500),
    system: promptDeTextos({ materia: curriculo.materia, curso: curriculo.curso }),
    tools: [{ name: HERRAMIENTA, description: "Redacta los apartados pedidos.", input_schema: esquemaDeTextos(letras) }],
    tool_choice: { type: "tool", name: HERRAMIENTA },
    messages: [{ role: "user", content: mensajeDeContexto({ curriculo, datos, letras }) }],
  });
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  return { textos: validaTextos(bloque?.input, letras), usage: respuesta.usage };
}
