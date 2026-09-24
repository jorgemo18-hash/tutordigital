import { saberesConId, criteriosDe, cobertura } from "../../../../assets/shared/programacion/estructuraDeLaProgramacion.js";

// LAS UNIDADES DIDÁCTICAS, PROPUESTAS POR LA IA (Recursos → Programación).
//
// El profesor tiene los saberes y criterios oficiales del curso; lo que le
// cuesta es agruparlos en unidades con sentido, darles título, ordenarlas y
// repartir las sesiones. La IA hace ese primer borrador.
//
// LA IA ELIGE, NO INVENTA: trabaja con los IDs de los saberes y los códigos
// de los criterios que le damos, y su respuesta se contrasta con el
// currículo. Un id que no existe se descarta; un saber que no puso en
// ninguna unidad se añade a la unidad de su mismo bloque (o a la última). Las
// sesiones se cuadran con las del curso. El profesor recibe siempre una
// propuesta completa y válida, y ve en el aviso de cobertura lo mismo que si
// la hubiera hecho a mano.
export const HERRAMIENTA = "propon_unidades";
export const MAX_UNIDADES = 15;
// Bloques que no son un tema sino algo de todo el curso.
export const BLOQUE_TRANSVERSAL = /socioafectiv/i;

const ESQUEMA = {
  type: "object",
  properties: {
    unidades: {
      type: "array",
      minItems: 3,
      maxItems: MAX_UNIDADES,
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "Título breve como el de un libro de texto, p. ej. «Números enteros»." },
          trimestre: { type: "integer", enum: [1, 2, 3] },
          sesiones: { type: "integer", minimum: 1 },
          saberes: { type: "array", items: { type: "string" }, description: "IDs de los saberes (s0.1.2.3)." },
          criterios: { type: "array", items: { type: "string" }, description: "Códigos de los criterios que se evalúan en esta unidad." },
        },
        required: ["titulo", "trimestre", "sesiones", "saberes", "criterios"],
      },
    },
  },
  required: ["unidades"],
};

export function promptDeUnidades({ materia, curso, sesionesTotales }) {
  return [
    `Eres jefe de departamento de ${materia} en un instituto de Aragón y preparas la programación didáctica de ${curso ? `${curso}.º de ESO` : "ESO"} (LOMLOE, ORDEN ECD/1172/2022).`,
    "Agrupa los saberes básicos del currículo en unidades didácticas, como las de un libro de texto:",
    "- entre 6 y 12 unidades, con títulos cortos y concretos (no copies el nombre del bloque si es genérico);",
    "- en el orden en que se enseñan de verdad (lo que es base, antes);",
    "- repartidas en los tres trimestres de forma equilibrada;",
    `- con sesiones que sumen unas ${sesionesTotales || "las"} del curso, según el peso de cada unidad;`,
    "- TODOS los saberes tienen que estar en alguna unidad. Los de bloques transversales (sentido socioafectivo, actitudes, gestión emocional, trabajo en equipo) van en TODAS las unidades, no en una;",
    "- en cada unidad, SOLO los criterios de evaluación que de verdad se evalúan en ella: normalmente entre 3 y 8, no todos; entre todas las unidades, todos los criterios.",
    "Usa exactamente los IDs y códigos que te doy. No inventes saberes ni criterios.",
  ].join("\n");
}

export function mensajeDelCurriculo(curriculo) {
  const lineasSaberes = saberesConId(curriculo).map((s) => `${s.id} | ${[s.bloque, s.apartado, s.nombreApartado].filter(Boolean).join(" · ")} | ${s.texto}`);
  const lineasCriterios = (curriculo.competencias || []).flatMap((ce) => [
    `${ce.codigo}: ${ce.texto || "(ver anexo)"}`,
    ...ce.criterios.map((k) => `  ${k.codigo}: ${k.texto}`),
  ]);
  return `SABERES BÁSICOS (id | bloque · apartado | saber):\n${lineasSaberes.join("\n")}\n\nCOMPETENCIAS Y CRITERIOS:\n${lineasCriterios.join("\n")}`;
}

// Lo que dijo la IA, contrastado y completado. Devuelve las unidades y lo que
// se tuvo que arreglar (para el registro y para decírselo al profesor).
export function validaUnidades(curriculo, propuesta, { sesionesTotales = 0 } = {}) {
  const saberes = saberesConId(curriculo);
  const porId = new Map(saberes.map((s) => [s.id, s]));
  const codigos = new Set(criteriosDe(curriculo).map((k) => k.codigo));
  const arreglos = { idsInventados: 0, saberesAnadidos: 0, criteriosAnadidos: 0 };

  const unidades = (Array.isArray(propuesta?.unidades) ? propuesta.unidades : []).slice(0, MAX_UNIDADES)
    .map((u, i) => {
      const suyos = (u.saberes || []).filter((id) => porId.has(id));
      const crit = (u.criterios || []).filter((c) => codigos.has(c));
      arreglos.idsInventados += (u.saberes || []).length - suyos.length + (u.criterios || []).length - crit.length;
      return {
        id: `u${i + 1}`,
        titulo: String(u.titulo || `Unidad ${i + 1}`).slice(0, 200),
        trimestre: [1, 2, 3].includes(u.trimestre) ? u.trimestre : 3,
        sesiones: Math.max(1, Math.min(300, Math.round(Number(u.sesiones) || 1))),
        saberes: [...new Set(suyos)],
        criterios: [...new Set(crit)],
      };
    })
    .filter((u) => u.saberes.length);
  if (!unidades.length) return { unidades: [], arreglos: { ...arreglos, vacia: true } };

  // Lo que se quedó fuera va a la unidad que ya tiene saberes de su bloque.
  const cob = cobertura(curriculo, unidades);
  for (const s of cob.saberesSinUnidad) {
    const destino = unidades.find((u) => u.saberes.some((id) => porId.get(id)?.bloque === s.bloque)) || unidades[unidades.length - 1];
    destino.saberes.push(s.id);
    arreglos.saberesAnadidos += 1;
  }
  // Un criterio olvidado va donde ya se evalúa su competencia; si su
  // competencia no aparece en ninguna, es transversal (el trabajo en equipo,
  // la comunicación) y va en todas. Meterlos todos en la última unidad, que
  // era la primera versión, dejaba una unidad con veinte criterios.
  const competenciaDe = new Map(criteriosDe(curriculo).map((k) => [k.codigo, k.competencia]));
  for (const k of cob.criteriosSinUnidad) {
    const conSuCompetencia = unidades.filter((u) => u.criterios.some((c) => competenciaDe.get(c) === k.competencia));
    for (const u of conSuCompetencia.length ? conSuCompetencia : unidades) u.criterios.push(k.codigo);
    arreglos.criteriosAnadidos += 1;
  }

  // LOS BLOQUES TRANSVERSALES VAN EN TODAS. El sentido socioafectivo de
  // Matemáticas (gestión emocional, trabajo en equipo) no es un tema: se
  // trabaja todo el curso. En la primera prueba real (24/9) la IA metió sus
  // siete saberes en la unidad 1 y en ninguna más.
  const transversales = saberes.filter((s) => BLOQUE_TRANSVERSAL.test(s.bloque || ""));
  if (transversales.length) {
    for (const u of unidades) {
      for (const s of transversales) if (!u.saberes.includes(s.id)) u.saberes.push(s.id);
    }
  }

  // Las sesiones, cuadradas con las del curso sin perder las proporciones.
  if (sesionesTotales > 0) {
    const suma = unidades.reduce((n, u) => n + u.sesiones, 0);
    let asignadas = 0;
    unidades.forEach((u, i) => {
      u.sesiones = i === unidades.length - 1
        ? Math.max(1, sesionesTotales - asignadas)
        : Math.max(1, Math.round((u.sesiones * sesionesTotales) / suma));
      asignadas += u.sesiones;
    });
  }
  // Los trimestres, en orden: una unidad no puede ir antes que la anterior.
  for (let i = 1; i < unidades.length; i += 1) {
    if (unidades[i].trimestre < unidades[i - 1].trimestre) unidades[i].trimestre = unidades[i - 1].trimestre;
  }
  return { unidades, arreglos };
}

export async function proponUnidades({ client, model, curriculo, curso, sesionesTotales }) {
  const respuesta = await client.messages.create({
    model,
    max_tokens: 6000,
    system: promptDeUnidades({ materia: curriculo.materia, curso, sesionesTotales }),
    tools: [{ name: HERRAMIENTA, description: "Propón las unidades didácticas del curso.", input_schema: ESQUEMA }],
    tool_choice: { type: "tool", name: HERRAMIENTA },
    messages: [{ role: "user", content: mensajeDelCurriculo(curriculo) }],
  });
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  return { ...validaUnidades(curriculo, bloque?.input, { sesionesTotales }), usage: respuesta.usage };
}
