// Mensaje del aviso no bloqueante tras archivar un alumno: si su familia
// queda con otros alumnos activos que tienen descuentos recurrentes
// asignados, se lo recuerda al admin — el descuento de hermanos ya no es
// automático (es un descuento recurrente asignado a mano, ver
// server/lib/academiaRecibos/generarRecibo.js), así que archivar a un
// hermano no desactiva nada por sí solo. Solo informa, nunca desactiva
// nada — eso queda a criterio del admin, revisándolo desde la ficha de
// cada hermano listado.
export function formatAvisoArchivoFamilia(hermanosConDescuento = []) {
  if (!hermanosConDescuento?.length) return null;

  const detalle = hermanosConDescuento
    .map((h) => {
      const descuentos = (h.descuentos || []).map((d) => `${d.concepto} ${Number(d.porcentaje)}%`).join(", ");
      return `${h.nombre} — ${descuentos}`;
    })
    .join("; ");

  return `La familia queda con ${hermanosConDescuento.length} alumno(s) activo(s) con descuentos asignados: ${detalle}. Revísalos si ya no corresponden.`;
}
