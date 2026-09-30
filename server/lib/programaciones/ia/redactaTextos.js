import { apartadosDeTextoDe, apartadoDe } from "../../../../assets/shared/programacion/apartadosLegales.js";
import { INSTRUMENTOS } from "../../../../assets/shared/programacion/detalleDeCriterios.js";
import { quienRedacta } from "./quienRedacta.js";

// EL BORRADOR DE LOS APARTADOS DE TEXTO de la programación (c, e y de la f
// a la última letra de su etapa: ver apartadosLegales.js).
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

// Las letras que se pueden pedir para una materia (dependen de la etapa).
export function letrasDeTexto(materiaSlug) {
  return apartadosDeTextoDe(materiaSlug).map((a) => a.letra);
}

// QUÉ TIENE QUE LLEVAR CADA APARTADO, por `clave` (qué es), no por letra:
// la h de ESO es la materia pendiente y la de Primaria la metodología. La
// primera prueba real (24/9) dio borradores que repetían el contexto ("esta
// programación de 1.º de ESO, con 4 sesiones semanales…") y hablaban de las
// propias instrucciones ("no se inventan datos del centro"). Con solo el
// título legal, la IA rellena; con lo que un inspector busca, concreta.
export const GUIA = {
  instrumentos: "Qué instrumentos se usan (pruebas escritas, observación sistemática con rúbrica o lista de cotejo, cuaderno, producciones, autoevaluación y coevaluación), con qué criterios o competencias se vincula cada uno, cuándo se aplican y cómo se devuelve la información al alumno para que mejore.",
  inicial: "Cuándo se hace (primeras semanas), qué se evalúa (saberes previos imprescindibles de la materia y del curso anterior), con qué instrumento, que no califica, y qué se decide con los resultados: agrupamientos, refuerzos, ajustes de la secuencia y comunicación a tutoría y familias.",
  diferencias: "Medidas generales y ordinarias de atención a las diferencias (actividades graduadas, apoyo entre iguales, más tiempo o formatos adaptados), cómo se coordina con orientación y PT, y cómo se hacen y evalúan las adaptaciones curriculares significativas y de acceso.",
  seguimiento: "Para el alumno que lo necesita (en ESO, el que no promociona): quién hace el seguimiento, cómo se analizan sus dificultades, qué medidas concretas se toman en la materia y con qué periodicidad se revisa y se informa a la familia.",
  pendientes: "Para el alumno con la materia pendiente: quién lo hace, qué trabajo se le pide y cuándo, cómo se evalúa y califica, y cómo se informa a alumno y familia.",
  metodologia: "Enfoque metodológico de la materia (resolución de problemas, manipulación, trabajo cooperativo…), organización del aula y agrupamientos, recursos y materiales, y criterios para diseñar las situaciones de aprendizaje.",
  lector: "Cómo contribuye la materia al Plan Lector: tipos de textos que se leen en la materia, actividades de comprensión y expresión, y tiempos.",
  transversales: "Qué elementos transversales se trabajan desde la materia (igualdad, convivencia, sostenibilidad, educación financiera, salud…) y en qué unidades o actividades.",
  digital: "Qué herramientas digitales se usan en la materia, para qué, cómo se desarrolla la competencia digital del alumnado y con qué criterios de uso responsable.",
  bilingue: "Si el centro tiene programa bilingüe o de lenguas propias que afecte a la materia, qué se hace; si no lo tiene, una frase que lo diga.",
  revision: "Cuándo y cómo se revisa la programación (reuniones del departamento o del equipo de ciclo, tras cada evaluación), con qué indicadores (resultados, grado de desarrollo, encuestas) y cómo se recogen y aplican los cambios.",
  extraescolares: "Qué tipo de actividades complementarias y extraescolares encajan con la materia, cómo se vinculan con las unidades y cómo inciden en la evaluación.",
};

export function promptDeTextos({ materia, materiaSlug, curso }) {
  const q = quienRedacta({ materia, materiaSlug, curso });
  return [
    `${q.presentacion("redactas la programación didáctica")} según el ${q.norma} (LOMLOE).`,
    "Escribe cada apartado que se te pide tal como irá en el documento que se entrega a inspección:",
    `- en español, en voz impersonal o ${q.voz}, registro profesional;`,
    "- entre 100 y 220 palabras por apartado, en párrafos cortos o listas con guiones;",
    "- concreto para esta materia y este curso: cita saberes, unidades o competencias cuando venga al caso;",
    "- cubre lo que se indica en \"Qué tiene que incluir\" de cada apartado;",
    "- NO repitas los datos del contexto (materia, curso, sesiones, número de unidades) ni resumas la programación;",
    "- NO hables de estas instrucciones ni del propio borrador;",
    "- lo que dependa del centro (nombres de planes, proyectos, actividades, fechas) escríbelo como [a completar por el centro]; no lo inventes;",
    "- devuelve solo el texto de cada apartado, sin repetir su título.",
  ].join("\n");
}

// La clave de cada apartado en la herramienta. La API solo admite
// [a-zA-Z0-9_.-] en las claves: con "ñ" la petición entera fallaba (502 en
// menos de un segundo al pedir f–ñ, 24/9). Todas llevan prefijo para que
// ninguna sea una letra suelta que la IA confunda con otra cosa.
export const claveDe = (letra) => `apartado_${letra === "ñ" ? "nn" : letra}`;

export function esquemaDeTextos(letras) {
  return {
    type: "object",
    properties: Object.fromEntries(letras.map((l) => [claveDe(l), { type: "string", description: `Apartado ${l})` }])),
    required: letras.map(claveDe),
  };
}

export function mensajeDeContexto({ curriculo, materiaSlug, datos, letras }) {
  const unidades = (datos.unidades || []).map((u, i) => `UD ${i + 1}. ${u.titulo} (${u.trimestre}.º trimestre, ${u.sesiones} sesiones)`);
  const modo = datos.calificacion === "criterio" ? "por criterio de evaluación" : "por competencia específica";
  const pesos = Object.entries(datos.pesos || {}).map(([k, v]) => `${k}: ${v} %`).join(", ");
  const competencias = (curriculo.competencias || []).map((ce) => `${ce.codigo}: ${ce.texto || ""}`);
  // Si ya ha marcado con qué evalúa cada criterio, el apartado c) tiene que
  // decir eso, no otra cosa (detalleDeCriterios.js).
  const instrumentos = Object.entries(datos.criterios || {})
    .filter(([, f]) => f.instrumentos?.length || f.imprescindible)
    .map(([c, f]) => `${c}: ${(f.instrumentos || []).map((x) => INSTRUMENTOS[x] || x).join(", ") || "—"}${f.imprescindible ? " (imprescindible)" : ""}`);
  const pedidos = letras.map((l) => {
    const a = apartadoDe(materiaSlug, l);
    return `${l}) ${a?.titulo || ""} [campo ${claveDe(l)}]\n   Qué tiene que incluir: ${GUIA[a?.clave] || ""}`;
  });
  return [
    `MATERIA: ${curriculo.materia}${datos.variante ? ` (${datos.variante})` : ""}`,
    `SESIONES: ${datos.sesionesSemanales || "?"} por semana, ${datos.semanas || 35} semanas.`,
    `UNIDADES:\n${unidades.join("\n") || "(todavía sin unidades)"}`,
    `CALIFICACIÓN: ${modo}${pesos ? `. Pesos: ${pesos}` : ""}.`,
    `COMPETENCIAS ESPECÍFICAS:\n${competencias.join("\n")}`,
    ...(instrumentos.length ? [`INSTRUMENTOS QUE YA HA ELEGIDO EL DEPARTAMENTO, POR CRITERIO:\n${instrumentos.join("\n")}`] : []),
    `APARTADOS QUE TIENES QUE REDACTAR:\n${pedidos.join("\n")}`,
  ].join("\n\n");
}

// Frases que hablan de las instrucciones y no del apartado ("no se inventan
// datos del centro", "este borrador…"): salieron en la prueba real y no
// pueden llegar al documento.
const META = /[^.\n]*\b(no se inventa\w*|sin inventar|este borrador|estas instrucciones)\b[^.\n]*\.?/gi;
const sinMeta = (t) => t.replace(META, " ").replace(/[ \t]{2,}/g, " ").replace(/^[ \t]+/gm, "");

// Solo las letras pedidas, en texto, sin frases sobre las instrucciones y
// recortadas al máximo que guarda la programación (20.000 caracteres por
// apartado, ver programaciones.js). Acepta la clave de la herramienta y,
// por si acaso, la letra suelta.
export function validaTextos(entrada, letras) {
  const textos = {};
  for (const l of letras) {
    const bruto = entrada?.[claveDe(l)] ?? entrada?.[l];
    const t = typeof bruto === "string" ? sinMeta(bruto).trim() : "";
    if (t) textos[l] = t.slice(0, 20000);
  }
  return textos;
}

export async function redactaTextos({ client, model, curriculo, materiaSlug, datos, letras }) {
  const respuesta = await client.messages.create({
    model,
    max_tokens: Math.min(16000, 900 * letras.length + 500),
    system: promptDeTextos({ materia: curriculo.materia, materiaSlug, curso: curriculo.curso }),
    tools: [{ name: HERRAMIENTA, description: "Redacta los apartados pedidos.", input_schema: esquemaDeTextos(letras) }],
    tool_choice: { type: "tool", name: HERRAMIENTA },
    messages: [{ role: "user", content: mensajeDeContexto({ curriculo, materiaSlug, datos, letras }) }],
  });
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  return { textos: validaTextos(bloque?.input, letras), usage: respuesta.usage };
}
