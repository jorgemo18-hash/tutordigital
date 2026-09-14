// LA SECCIÓN ABIERTA VIVE EN LA URL.
//
// EL PROBLEMA (14/09/2026). El panel guardaba la sección activa solo en una
// variable de JavaScript, así que un F5 en Finanzas devolvía a Alumnos, el
// botón de atrás del navegador salía del panel entero, y no había forma de
// guardar un enlace —ni de mandárselo a nadie— apuntando a una pantalla
// concreta. En una herramienta que se usa una tarde entera, recargar y perder
// el sitio se paga muchas veces al día.
//
// SE USA EL HASH (`#finanzas`), no una ruta ni un parámetro:
//
//   - El panel se sirve como estático desde Vercel. Una ruta de verdad
//     (`/admin/finanzas`) necesitaría reescrituras en `vercel.json` y que el
//     servidor devolviera el mismo HTML para cada sección; el hash no toca el
//     servidor en absoluto.
//   - El hash no viaja al servidor, así que no acaba en ningún log de acceso.
//     No es que aquí haya nada sensible, pero es la propiedad que hace que no
//     haya que pensarlo cada vez que se añada una sección.
//
// EL ID VA TAL CUAL, con su guion bajo: `#envio_familias`. Traducirlo a
// `envio-familias` sería más bonito y significaría mantener un mapa de ida y
// vuelta entre dos nombres de lo mismo, que es precisamente donde se cuelan los
// desajustes. Un solo nombre.

// Qué sección pide una URL. Devuelve null si el hash está vacío, no se
// reconoce, o apunta a una sección que este centro no tiene visible —un enlace
// viejo a `#horario` en un centro con un solo profesor no puede dejar el panel
// con una pantalla abierta y ningún elemento marcado en el menú.
export function seccionDeUrl(hash = "", idsVisibles = []) {
  const pedida = String(hash || "").replace(/^#/, "").trim();
  if (!pedida) return null;
  return idsVisibles.includes(pedida) ? pedida : null;
}

// Escribe la sección en la URL. Deja entrada en el historial a propósito: el
// botón de atrás devuelve a la sección anterior, que es lo que espera quien ha
// pulsado cuatro cosas del menú, en vez de salir del panel.
export function escribirSeccionEnUrl(sectionId, ubicacion = globalThis.location) {
  if (!sectionId || !ubicacion) return;
  if (ubicacion.hash.replace(/^#/, "") === sectionId) return; // ya está: no duplicar historial
  ubicacion.hash = sectionId;
}

// Conecta el botón de atrás/adelante. `onSeccion` solo se llama si la URL pide
// una sección DISTINTA de la abierta: sin esa comprobación, escribir el hash al
// seleccionar dispara el evento y se vuelve a renderizar la misma sección —dos
// veces cada clic, y con ella dos veces cada petición de la pantalla.
export function escucharUrl({ idsVisibles = [], getActivo, onSeccion, ventana = globalThis.window } = {}) {
  if (!ventana?.addEventListener) return () => {};

  const alCambiar = () => {
    const pedida = seccionDeUrl(ventana.location?.hash, idsVisibles);
    if (!pedida || pedida === getActivo?.()) return;
    onSeccion?.(pedida);
  };

  ventana.addEventListener("hashchange", alCambiar);
  return () => ventana.removeEventListener("hashchange", alCambiar);
}
