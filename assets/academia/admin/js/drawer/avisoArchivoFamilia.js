// Mensaje del aviso no bloqueante tras archivar un alumno: si su familia
// queda con otros alumnos activos que tienen descuentos recurrentes
// asignados, se lo recuerda al admin — el descuento de hermanos ya no es
// automático (es un descuento recurrente asignado a mano, ver
// server/lib/academiaRecibos/generarRecibo.js), así que archivar a un
// hermano no desactiva nada por sí solo. Solo informa, nunca desactiva
// nada — eso queda a criterio del admin, revisándolo desde la ficha de
// cada hermano listado.
function formatDescuentos(hermano) {
  return (hermano.descuentos || []).map((d) => `${d.concepto} ${Number(d.porcentaje)}%`).join(", ");
}

export function formatAvisoArchivoFamilia(hermanosConDescuento = []) {
  if (!hermanosConDescuento?.length) return null;

  // Caso más señalado: si solo queda UN alumno con descuentos, suele ser
  // justo el que iba destinado a compartirse entre hermanos (p.ej.
  // "Hermanos") y ya no tiene con quién — mensaje singular y más directo
  // que la lista genérica de abajo, sin dar por hecho de qué descuento se
  // trata (nunca detección por nombre, solo por cuántos quedan).
  if (hermanosConDescuento.length === 1) {
    const [hermano] = hermanosConDescuento;
    return `La familia queda con un solo alumno activo (${hermano.nombre}) que conserva "${formatDescuentos(hermano)}" — revisa si aún corresponde.`;
  }

  const detalle = hermanosConDescuento
    .map((h) => `${h.nombre} — ${formatDescuentos(h)}`)
    .join("; ");

  return `La familia queda con ${hermanosConDescuento.length} alumno(s) activo(s) con descuentos asignados: ${detalle}. Revísalos si ya no corresponden.`;
}
