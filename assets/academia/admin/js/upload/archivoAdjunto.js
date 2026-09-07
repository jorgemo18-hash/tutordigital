import { buildFotoDisplay } from "./fotoDisplay.js";

// Enseñar un adjunto privado del centro: la ficha de inscripción escaneada
// de un alumno o la factura de un gasto.
//
// POR QUÉ NO ES UN <img src="..."> Y YA. Estos dos archivos vivían en un
// bucket PÚBLICO y lo que se guardaba en la base de datos era su URL: bastaba
// tener el enlace para abrir la hoja firmada de un menor, sin login y para
// siempre. Desde la migración 114 viven en un bucket privado y el backend los
// reenvía por una ruta que exige sesión, así que aquí ya no hay una URL que
// pintar: hay que DESCARGAR el archivo y crear un object URL local, que solo
// existe mientras la pestaña esté abierta.
//
// EL OBJECT URL SE REVOCA. Cada uno retiene el blob entero en memoria —una
// foto de móvil son varios megas— y el drawer se abre y se cierra decenas de
// veces en una tarde. Sin revocar, esa memoria no vuelve hasta recargar.

// `descargarFn()` devuelve un Blob, o null si no hay archivo. `urlLegado` es
// la URL pública antigua de una ficha todavía sin migrar: mientras no se haya
// ejecutado scripts/migrar-archivos-privados.mjs el backend responde 404 y se
// sigue enseñando la vieja. Se degrada, no se rompe — y el día que el script
// corra, deja de usarse sola.
export function crearVisorAdjunto({ descargarFn, urlLegado = null, alt = "Adjunto" }) {
  let objectUrl = null;

  function revocar() {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  // Devuelve el elemento a pintar, o null si no hay nada que enseñar (y
  // entonces quien llama muestra el botón de subir).
  async function cargar() {
    revocar();
    const blob = await descargarFn();
    if (blob) {
      objectUrl = URL.createObjectURL(blob);
      // El tipo se lee del propio blob: un object URL no tiene extensión y
      // detectarPdfPorUrl() diría que todo es imagen (ver fotoDisplay.js).
      return buildFotoDisplay(objectUrl, { esPdf: blob.type === "application/pdf", alt });
    }
    if (urlLegado) return buildFotoDisplay(urlLegado, { alt });
    return null;
  }

  return { cargar, revocar };
}
