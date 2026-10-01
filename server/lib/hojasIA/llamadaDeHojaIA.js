import { HERRAMIENTA, ESQUEMA, promptDeHojaIA, mensajeDeHojaIA } from "./promptDeHojaIA.js";

// UNA LLAMADA A LA IA PARA ESCRIBIR EJERCICIOS, y los ejercicios que devuelve
// (sin verificar todavía: eso lo hace generaHojaIA).
//
// PENSAR ANTES DE ESCRIBIR (1/10/2026). En la segunda prueba real, con la IA
// obligada a responder directamente con la herramienta, se equivocó en 7 de
// unos 28 apartados y un enunciado salió con la IA corrigiéndose dentro
// («En realidad, simplifica: …»). Era lo esperable: sin tiempo para pensar,
// calcula «de cabeza» y, si se da cuenta de un error, ya está escribiendo el
// enunciado. Con `pensar`, el modelo razona antes (thinking adaptativo) y
// luego llama a la herramienta. Cuesta más tokens de salida (el razonamiento
// se cobra como salida).
//
// Con el pensamiento activo no se puede OBLIGAR a usar la herramienta
// (tool_choice "tool"): va en "auto" y el mensaje lo pide. Si aun así no la
// usa, la llamada devuelve cero ejercicios y generaHojaIA hace su segunda
// ronda.
//
// max_tokens por debajo de 21 333: por encima, el SDK exige streaming.
export const MAX_TOKENS_PENSANDO = 20000;
const MAX_TOKENS_DIRECTO = 8000;

export function parametrosDeLlamada({ model, ctx, pide, dificultad, soloEnteros = false, yaHay, pensar }) {
  const tools = [{ name: HERRAMIENTA, description: "Escribe los ejercicios de la hoja.", input_schema: ESQUEMA }];
  const mensaje = mensajeDeHojaIA({ ...ctx, cuantos: pide, dificultad, soloEnteros, yaHay });
  if (!pensar) {
    return {
      model, max_tokens: MAX_TOKENS_DIRECTO, system: promptDeHojaIA(ctx), tools,
      tool_choice: { type: "tool", name: HERRAMIENTA },
      messages: [{ role: "user", content: mensaje }],
    };
  }
  return {
    model, max_tokens: MAX_TOKENS_PENSANDO, system: promptDeHojaIA(ctx), tools,
    thinking: { type: "adaptive" },
    tool_choice: { type: "auto" },
    messages: [{
      role: "user",
      content: `${mensaje}\n\nAntes de escribir, resuelve tú cada apartado y cada problema y comprueba que el enunciado tiene sentido y una solución razonable. Luego llama UNA vez a la herramienta ${HERRAMIENTA} con todos los ejercicios ya revisados. Nada de texto fuera de la herramienta.`,
    }],
  };
}

export async function llamadaDeHojaIA({ client, ...pedido }) {
  const respuesta = await client.messages.create(parametrosDeLlamada(pedido));
  const bloque = (respuesta.content || []).find((b) => b.type === "tool_use" && b.name === HERRAMIENTA);
  return {
    brutos: Array.isArray(bloque?.input?.ejercicios) ? bloque.input.ejercicios : [],
    usage: respuesta.usage || {},
    sinHerramienta: !bloque,
  };
}
