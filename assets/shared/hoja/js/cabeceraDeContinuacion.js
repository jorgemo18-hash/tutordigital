// LA CABECERA DE LOS FOLIOS 2 Y SIGUIENTES.
//
// Un folio suelto de una hoja de dos no decía de quién era: el nombre solo
// se pedía en el primero, y si el alumno entrega (o se le cae) el segundo
// por separado, ese folio no se puede registrar. Así que cada folio a partir
// del segundo lleva una línea de "Nombre" y el objetivo de la hoja, en
// pequeño. El código de la hoja y "página N de M" van en el pie, que ya está
// en todos los folios.
//
// ALTO FIJO, y es a propósito: el reparto en folios tiene que saber cuánto
// ocupa ANTES de que exista (se añade al partir), y el montador del servidor
// también (alturaDeLaHoja.js). El CSS de `.hj-head-sigue` fija exactamente
// este alto (alto + margen), y un test lo vigila.
export const ALTO_CABECERA_DE_CONTINUACION_MM = 9;

export function buildCabeceraDeContinuacion({ objetivo = "", doc = globalThis.document } = {}) {
  const head = doc.createElement("header");
  head.className = "hj-head-sigue";

  const nombre = doc.createElement("div");
  nombre.className = "hj-dato hj-dato--ancho";
  const lab = doc.createElement("span");
  lab.className = "hj-dato-label";
  lab.textContent = "Nombre";
  const linea = doc.createElement("span");
  linea.className = "hj-dato-linea";
  nombre.append(lab, linea);

  const obj = doc.createElement("span");
  obj.className = "hj-head-sigue-obj";
  obj.textContent = objetivo;

  head.append(nombre, obj);
  return head;
}

// "H-260924-03 · página 2 de 3" en el pie de cada folio (solo si hay más de
// uno: "página 1 de 1" es ruido).
export function textoDelPie(codigo, n, total) {
  const pagina = total > 1 ? `página ${n} de ${total}` : "";
  return [codigo, pagina].filter(Boolean).join(" · ");
}
