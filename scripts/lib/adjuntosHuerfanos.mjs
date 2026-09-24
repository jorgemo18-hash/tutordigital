// Qué es huérfano, sin tocar nada (ver limpiar-adjuntos-huerfanos.mjs).
export const MARGEN_MS = 24 * 60 * 60 * 1000;

export function clasificarHuerfanos({ adjuntos, deSesion, tareas, archivos, ahora = new Date() }) {
  const tareasVivas = new Set(tareas.map((t) => t.id));
  const conFila = new Set([...adjuntos, ...deSesion].map((a) => a.storage_path).filter(Boolean));
  const filas = adjuntos.filter((a) => !tareasVivas.has(a.owner_id));
  const sueltos = archivos.filter((a) => !conFila.has(a.ruta) && ahora - new Date(a.creado) > MARGEN_MS);
  const fechas = [...filas.map((f) => f.created_at), ...sueltos.map((a) => a.creado)].filter(Boolean).sort();
  return {
    filas,
    sueltos,
    bytesFilas: filas.reduce((s, f) => s + (f.size || 0), 0),
    bytesSueltos: sueltos.reduce((s, a) => s + (a.bytes || 0), 0),
    desde: fechas[0] || null,
    hasta: fechas[fechas.length - 1] || null,
  };
}
