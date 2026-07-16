import { createHash } from "node:crypto";

// Serialización determinista — recorre objetos anidados y ordena sus
// claves alfabéticamente antes de JSON.stringify. Sin esto, dos llamadas
// con el mismo contenido pero construidas con las claves en otro orden
// (p.ej. si algún día se reordenan los campos en construirPayloadHojaInscripcion.js)
// darían un hash distinto y el caché nunca acertaría aunque el PDF
// resultante fuera idéntico.
function ordenarClaves(valor) {
  if (Array.isArray(valor)) return valor.map(ordenarClaves);
  if (valor && typeof valor === "object") {
    return Object.keys(valor)
      .sort()
      .reduce((acc, key) => {
        acc[key] = ordenarClaves(valor[key]);
        return acc;
      }, {});
  }
  return valor;
}

// Hash estable de todo lo que alimenta la plantilla de la hoja de
// inscripción (campos activados, texto legal, datos del centro y logo —
// ver construirPayloadHojaInscripcion.js) — mismo payload, mismo hash,
// así que dos peticiones con la misma configuración sirven el PDF ya
// generado en Storage en vez de llamar otra vez al microservicio (ver
// hojaInscripcionCache.js).
export function calcularHashHojaInscripcion(payload) {
  const serializado = JSON.stringify(ordenarClaves(payload));
  return createHash("sha256").update(serializado).digest("hex");
}
