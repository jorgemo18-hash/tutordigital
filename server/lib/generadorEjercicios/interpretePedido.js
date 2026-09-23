import { INTENSIDADES } from "./montadorDeHoja.js";
import { MAX_ACTIVIDADES } from "../../../assets/shared/hoja/js/actividades.js";

// "HAZME DOS EJERCICIOS DE RESTAS CON PARÉNTESIS, NIVEL REFUERZO": EL PEDIDO
// EN PALABRAS, TRADUCIDO AL CATÁLOGO. Fase 2 del generador en el panel
// (Jorge, 23/9): el profesor lo escribe o lo dicta y la IA lo convierte en
// lo que el generador sabe hacer, preguntando lo que falte.
//
// LA IA NO ESCRIBE EJERCICIOS AQUÍ, y es la decisión que sostiene todo lo
// demás. Solo ELIGE: tema, objetivo, intensidad, cuántos, y qué baterías del
// catálogo. Los números, los enunciados y las soluciones los sigue poniendo
// nuestro código, que es lo que garantiza que lo impreso está bien resuelto
// (el principio del 14/9: la IA propone, el código comprueba).
//
// Y SU RESPUESTA NO SE CREE: se contrasta con el catálogo. Una clave que no
// existe, un objetivo inventado o una intensidad que no hay se tratan como
// "no lo he entendido", nunca se pasan al montador. Un modelo que alucina una
// batería no puede tumbar ni ensuciar una hoja.
//
// Lo que no está en el catálogo (raíces cuadradas en la hoja de enteros) se
// dice como tal —`fuera_de_catalogo`— con lo más parecido si lo hay. Jorge
// decidió que entonces se pida confirmación; generar fuera del catálogo es la
// fase 3 y aquí no existe.

export const HERRAMIENTA = "proponer";

// Lo que puede contestar. Forzado con `tool_choice`: la respuesta es siempre
// este objeto y nunca prosa que haya que adivinar cómo leer.
export const ESQUEMA = {
  type: "object",
  properties: {
    accion: {
      type: "string",
      enum: ["hoja", "ejercicio", "pregunta", "fuera_de_catalogo"],
      description: "hoja: montar una hoja. ejercicio: un solo ejercicio para cambiar el elegido. "
        + "pregunta: falta un dato imprescindible. fuera_de_catalogo: lo pedido no está en el catálogo.",
    },
    temaId: { type: "string" },
    objetivo: { type: "integer" },
    intensidad: { type: "string", enum: Object.keys(INTENSIDADES) },
    actividades: { type: "integer", description: "Cuántos ejercicios, si el profesor lo dice." },
    baterias: {
      type: "array",
      items: { type: "string" },
      description: "Claves de baterías concretas, en el orden de la hoja, si el profesor pide tipos concretos. "
        + "Se pueden repetir para pedir dos del mismo tipo.",
    },
    clave: { type: "string", description: "Para accion=ejercicio: la clave de la batería." },
    pregunta: { type: "string" },
    opciones: { type: "array", items: { type: "string" } },
    explicacion: {
      type: "string",
      description: "Una o dos frases, en español, de lo que has entendido (o de por qué no está).",
    },
    parecido: {
      type: "object",
      description: "Para fuera_de_catalogo: lo más parecido que sí hay, con los mismos campos que una hoja.",
      properties: {
        temaId: { type: "string" },
        objetivo: { type: "integer" },
        intensidad: { type: "string", enum: Object.keys(INTENSIDADES) },
        baterias: { type: "array", items: { type: "string" } },
      },
    },
  },
  required: ["accion", "explicacion"],
};

// El catálogo contado al modelo: SOLO lo que existe. Es la lista cerrada de
// la que tiene que elegir.
export function catalogoEnTexto(catalogo) {
  const lineas = [];
  for (const t of catalogo.temas) {
    lineas.push(`TEMA ${t.id}: ${t.curso} · ${t.materia} · ${t.nombre}`);
    for (const o of t.objetivos) {
      lineas.push(`  OBJETIVO ${o.numero}: ${o.titulo} (hasta ${o.maxActividades} ejercicios)`);
      for (const b of o.baterias) lineas.push(`    - ${b.clave}: ${b.nombre} (dificultad ${b.dificultad})`);
    }
  }
  return lineas.join("\n");
}

export function promptDeSistema(catalogo) {
  return `Eres el asistente del generador de hojas de ejercicios de una academia. El profesor te dice, escribiendo o dictando, qué hoja o qué ejercicio quiere. Tu trabajo es traducirlo al CATÁLOGO, que es cerrado:

${catalogoEnTexto(catalogo)}

INTENSIDADES: repaso (un folio, pocos apartados), normal (un folio), refuerzo (hasta dos folios, más apartados).

REGLAS:
- No escribas ejercicios. Solo eliges del catálogo; los ejercicios los genera otro programa.
- Si el profesor pide algo que el catálogo no tiene (otro tema, otro curso, otra materia, o un contenido que no está), usa accion=fuera_de_catalogo, explícalo en una frase y, si hay algo razonablemente parecido, ponlo en "parecido".
- Pregunta (accion=pregunta) SOLO si falta algo que no puedes suponer con sensatez. No preguntes la intensidad (por defecto normal) ni cuántos ejercicios (por defecto automático). Si solo hay un tema, no preguntes el curso ni la materia. Una sola pregunta, corta, con opciones si las hay.
- Si pide tipos concretos ("dos de comparar y uno de ordenar"), rellena "baterias" con sus claves y en ese orden, repitiendo si pide dos del mismo. Si pide un objetivo en general, deja "baterias" vacío.
- Una hoja PUEDE MEZCLAR tipos de objetivos distintos ("dos de comparar y uno de sumas"): pon todas las claves en "baterias"; el objetivo de la hoja se deduce solo de ellas.
- Si nombra un tipo de forma general ("sumas y restas", "de la recta"), elige la clave del catálogo que mejor encaje, sin preguntar. Pregunta solo si de verdad hay dos lecturas muy distintas.
- "Ejercicios" en boca del profesor son actividades de la hoja, no apartados.
- Si el mensaje viene con un EJERCICIO ELEGIDO, el profesor quiere cambiar ese ejercicio por otro: usa accion=ejercicio con la clave de la batería que describe.
- Si el mensaje viene con EJERCICIO NUEVO, el profesor quiere añadir uno al final de la hoja: usa accion=ejercicio con la clave de la batería que describe.
- La explicación va dirigida al profesor, en español, sin tecnicismos ni claves internas.`;
}

// El historial de la conversación (pregunta del asistente, respuesta del
// profesor…) en mensajes. Se recorta: una aclaración son dos o tres turnos,
// y un historial largo solo encarece la llamada.
export const MAX_TURNOS = 8;
export function mensajesDe({ conversacion, contexto }) {
  const turnos = conversacion.slice(-MAX_TURNOS).map((t) => ({
    role: t.rol === "asistente" ? "assistant" : "user",
    content: t.texto,
  }));
  // El contexto (lo que hay en pantalla) va en el primer mensaje del
  // profesor: "tengo abierto el objetivo 3" cambia qué significa "más de
  // esto".
  if (turnos.length && turnos[0].role === "user") {
    turnos[0] = { ...turnos[0], content: `${contextoEnTexto(contexto)}\n\n${turnos[0].content}` };
  }
  return turnos;
}

function contextoEnTexto(contexto = {}) {
  const partes = [`EN PANTALLA: tema ${contexto.temaId}, objetivo ${contexto.objetivo}, intensidad ${contexto.intensidad}.`];
  if (contexto.nuevo) {
    partes.push(`EJERCICIO NUEVO: quiere añadir uno al final de la hoja (objetivo ${contexto.nuevo.objetivo} o anteriores).`);
  }
  if (contexto.ejercicio) {
    partes.push(`EJERCICIO ELEGIDO: el ${contexto.ejercicio.orden}, del objetivo ${contexto.ejercicio.objetivo}, `
      + `batería ${contexto.ejercicio.clave}.`);
  }
  return partes.join(" ");
}

// ── Contrastar la respuesta con el catálogo ────────────────────────────────

function bateriasValidas(tema, objetivo) {
  // Las del objetivo y las de los anteriores (el repaso): mismas que acepta
  // el montador y el cambio de un ejercicio suelto.
  return new Set(tema.objetivos.filter((o) => o.numero <= objetivo).flatMap((o) => o.baterias.map((b) => b.clave)));
}

// De qué objetivo es cada clave del tema.
function objetivoDeCadaClave(tema) {
  const mapa = new Map();
  for (const o of tema.objetivos) for (const b of o.baterias) mapa.set(b.clave, o.numero);
  return mapa;
}

// CON TIPOS CONCRETOS, EL OBJETIVO DE LA HOJA SALE DE ELLOS: el más alto de
// los pedidos, y los de objetivos anteriores entran como repaso (lo mismo
// que hace el montador). Antes se usaba el objetivo que dijera el modelo, y
// "dos de comparar y uno de sumas" (objetivos 1 y 3) con el objetivo 1 en
// pantalla se rechazaba entero como "no lo he entendido" (Jorge, 23/9).
//
// Una clave que no existe se DEJA FUERA y se dice, en vez de tirar el pedido
// entero. Solo si no queda ninguna es "no lo he entendido".
function planValido(catalogo, plan) {
  const tema = catalogo.temas.find((t) => t.id === plan.temaId);
  if (!tema) return null;
  const intensidad = INTENSIDADES[plan.intensidad] ? plan.intensidad : "normal";
  const deQueObjetivo = objetivoDeCadaClave(tema);
  const pedidas = (plan.baterias || []).slice(0, MAX_ACTIVIDADES);
  const baterias = pedidas.filter((c) => deQueObjetivo.has(c));
  if (pedidas.length && !baterias.length) return null;
  const numero = baterias.length ? Math.max(...baterias.map((c) => deQueObjetivo.get(c))) : plan.objetivo;
  const objetivo = tema.objetivos.find((o) => o.numero === numero);
  if (!objetivo) return null;
  const limpio = { temaId: tema.id, objetivo: numero, intensidad };
  if (baterias.length < pedidas.length) limpio.descartadas = pedidas.length - baterias.length;
  if (baterias.length) limpio.baterias = baterias;
  else if (Number.isInteger(plan.actividades) && plan.actividades >= 1) {
    limpio.actividades = Math.min(plan.actividades, objetivo.maxActividades);
  }
  return limpio;
}

const NO_ENTENDIDO = {
  accion: "pregunta",
  pregunta: "No lo he entendido del todo. ¿Me lo dices de otra forma, o eliges en los desplegables?",
  opciones: [],
};

// Convierte lo que devuelve el modelo en algo que el panel puede aplicar sin
// más comprobaciones, o en una pregunta.
export function validaPropuesta(catalogo, propuesta, contexto = {}) {
  const explicacion = String(propuesta?.explicacion || "").slice(0, 400);
  switch (propuesta?.accion) {
    case "hoja": {
      const plan = planValido(catalogo, { temaId: contexto.temaId, ...propuesta });
      if (!plan) return NO_ENTENDIDO;
      const { descartadas, ...limpio } = plan;
      const aviso = descartadas ? ` (${descartadas === 1 ? "Un tipo pedido no está" : `${descartadas} tipos pedidos no están`} en el catálogo y se ha dejado fuera.)` : "";
      return { accion: "hoja", plan: limpio, explicacion: `${explicacion}${aviso}`.trim() };
    }
    case "ejercicio": {
      // Cambiar uno (`ejercicio`) o añadir uno (`nuevo`): en los dos, una
      // batería del objetivo o de sus anteriores.
      const ej = contexto.ejercicio || contexto.nuevo;
      if (!ej) return NO_ENTENDIDO;
      const tema = catalogo.temas.find((t) => t.id === contexto.temaId);
      if (!tema || !bateriasValidas(tema, ej.objetivo).has(propuesta.clave)) return NO_ENTENDIDO;
      return { accion: "ejercicio", clave: propuesta.clave, explicacion };
    }
    case "pregunta": {
      const pregunta = String(propuesta.pregunta || "").slice(0, 300);
      if (!pregunta) return NO_ENTENDIDO;
      const opciones = (propuesta.opciones || []).map(String).filter(Boolean).slice(0, 6);
      return { accion: "pregunta", pregunta, opciones };
    }
    case "fuera_de_catalogo": {
      const plan = propuesta.parecido
        ? planValido(catalogo, { temaId: contexto.temaId, ...propuesta.parecido })
        : null;
      const parecido = plan ? (({ descartadas, ...resto }) => resto)(plan) : null;
      return { accion: "fuera_de_catalogo", explicacion, parecido };
    }
    default:
      return NO_ENTENDIDO;
  }
}

// La llamada. `client` se inyecta (en los tests es un falso); devuelve
// también `usage` para apuntar el gasto.
export async function interpretaPedido({ client, model, catalogo, conversacion, contexto }) {
  const respuesta = await client.messages.create({
    model,
    max_tokens: 700,
    system: promptDeSistema(catalogo),
    tools: [{ name: HERRAMIENTA, description: "Propón qué hacer con el pedido del profesor.", input_schema: ESQUEMA }],
    tool_choice: { type: "tool", name: HERRAMIENTA },
    messages: mensajesDe({ conversacion, contexto }),
  });
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  const resultado = validaPropuesta(catalogo, bloque?.input, contexto);
  // Lo que contestó el modelo cuando se rechaza, para poder ver en los
  // registros POR QUÉ no se entendió (antes solo se sabía que no).
  const rechazo = resultado === NO_ENTENDIDO ? (bloque?.input ?? null) : null;
  return { resultado, usage: respuesta.usage, rechazo };
}
