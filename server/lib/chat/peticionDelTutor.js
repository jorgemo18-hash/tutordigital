// LA PETICIÓN A LA API PARA UN MENSAJE DEL TUTOR (1/10/2026).
//
// Dos decisiones, cada una con su motivo:
//
// 1. CACHÉ DE LA API. Cada mensaje del alumno reenvía el prompt entero (reglas,
//    enunciado, historial): unos 6.000 tokens para escribir una respuesta de
//    150. Con la caché, lo que ya se envió en el mensaje anterior se cobra a
//    0,1× (ver aiPricing.js). Dos marcas `cache_control`:
//      - al final de la parte FIJA del prompt: sobrevive aunque el historial
//        se recorte a los últimos 20 mensajes (el recorte desplaza el
//        principio del historial y rompería una sola marca);
//      - en el último mensaje del historial: lo ya hablado no se vuelve a
//        pagar entero.
//    La parte VARIABLE (intentos y mapa de pasos) va detrás de la fija, así
//    que cambiarla solo cuesta ese mensaje. Si el prompt no llega al mínimo
//    que la API cachea, la marca se ignora sin error.
//
// 2. SIN `temperature`. Sonnet 5.5 la rechaza (400) y ningún cliente la manda;
//    el campo se sigue aceptando en el cuerpo para no romper a nadie, pero
//    aquí no se usa.
const CACHE = { type: "ephemeral" };
export const MAX_TOKENS_TUTOR = 1600;

function conMarcaDeCache(mensaje) {
  const bloques = typeof mensaje.content === "string"
    ? [{ type: "text", text: mensaje.content }]
    : mensaje.content.map((b) => ({ ...b }));
  bloques[bloques.length - 1] = { ...bloques[bloques.length - 1], cache_control: CACHE };
  return { ...mensaje, content: bloques };
}

export function peticionDelTutor({ model, partes, historial, mensajeActual }) {
  const system = [{ type: "text", text: partes.fijo, cache_control: CACHE }];
  if (partes.variable) system.push({ type: "text", text: partes.variable });

  const anteriores = historial.length
    ? [...historial.slice(0, -1), conMarcaDeCache(historial[historial.length - 1])]
    : [];

  return {
    model,
    system,
    messages: [...anteriores, mensajeActual],
    max_tokens: MAX_TOKENS_TUTOR,
  };
}
