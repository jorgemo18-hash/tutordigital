import { pushAssistant } from "../../lib/chatlog.js";

// Un adjunto que el backend no sabe leer: se avisa al alumno (salvo en
// silencio) y se quita de la cola. Estaba escrito dos veces en send.js.
export function mensajeArchivoNoLegible(nombre) {
  return `No puedo leer ese archivo ("${String(nombre || "archivo")}"). ` +
    "Prueba a exportarlo como foto, DOCX o PDF. " +
    "Si quieres, dime qué formato es y te ayudo a convertirlo.";
}

export function rechazarArchivoNoLegible({ nombre, avisar = true, deps, setPendingImage, hideAttachPreview, update, renderPreview }) {
  if (avisar) { try { pushAssistant(deps, mensajeArchivoNoLegible(nombre)); } catch {} }
  try { setPendingImage?.(null); } catch {}
  try { hideAttachPreview?.(); } catch {}
  try { update?.(); } catch {}
  try { renderPreview?.(); } catch {}
}
