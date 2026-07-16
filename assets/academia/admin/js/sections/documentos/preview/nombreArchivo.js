// Slug simple para nombres de archivo descargados — sin acentos ni
// caracteres especiales, para que "hoja-inscripcion-lyceo.pdf" funcione
// igual en cualquier sistema de archivos. No hay ya un slugify genérico
// reutilizable en el repo (slugifySubject en agendaUtils.js es un mapa
// fijo de asignaturas, no sirve para nombres de centro arbitrarios).
function slugify(texto) {
  const limpio = (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return limpio || "academia";
}

export function nombreArchivo(prefijo, tenantNombre, extension = "pdf") {
  return `${prefijo}-${slugify(tenantNombre)}.${extension}`;
}
