// DÓNDE CAEN LOS SALTOS DE PÁGINA DE LA HOJA.
//
// POR QUÉ NO BASTA DIVIDIR LA ALTURA TOTAL, que es lo que hacía antes: porque
// una actividad no se parte. El CSS de impresión lleva `break-inside: avoid`
// en `.hj-act` —una actividad partida entre dos folios es una actividad
// perdida— y eso significa que la que no cabe abajo se va ENTERA a la página
// siguiente, dejando un hueco blanco detrás.
//
// Ese hueco no aparece en la altura total, así que dividir entre el alto útil
// subestima los folios. Se vio midiendo: con diez actividades la cuenta decía
// dos folios y Chrome imprimía tres, y el aviso no decía nada porque su
// número le cuadraba.
//
// Así que aquí se simula lo que hace el motor de impresión: se van colocando
// las actividades una a una y se abre folio nuevo cuando la siguiente no
// entra. Es el mismo algoritmo, y por eso la cuenta coincide con lo que sale
// por la impresora.
//
// Este archivo NO habla con el usuario: solo dice cuántos folios y cuánto se
// llena el último. El aviso lo compone `ajusteDelFolio.js`.

// El alto de un elemento incluyendo el margen inferior, que es lo que de
// verdad ocupa en el flujo. Sin el margen, diez actividades se subestiman en
// dos centímetros.
function altoConMargen(elemento, doc) {
  if (!elemento?.getBoundingClientRect) return 0;
  const alto = elemento.getBoundingClientRect().height || 0;
  const vista = doc?.defaultView;
  if (!vista?.getComputedStyle) return alto;
  const css = vista.getComputedStyle(elemento);
  return alto + (parseFloat(css.marginBottom) || 0);
}

// Las piezas de la hoja, medidas del DOM:
//
//   - `cabecera`: todo lo que va antes de la primera actividad (título, datos
//     del alumno, "lo esencial", el rótulo ACTIVIDADES). Solo ocupa sitio en
//     el PRIMER folio.
//   - `actividades`: una por actividad, en orden, cada una indivisible.
//   - `pie`: la marca y el código, que van al final del flujo.
export function medirPiezas(hoja, doc = globalThis.document) {
  if (!hoja?.querySelectorAll) return { cabeceraPx: 0, actividadesPx: [], piePx: 0 };

  const vista = doc?.defaultView;
  const css = vista?.getComputedStyle ? vista.getComputedStyle(hoja) : null;
  const arribaDelContenido = (hoja.getBoundingClientRect?.().top || 0)
    + (css ? parseFloat(css.paddingTop) || 0 : 0);

  const actividades = [...hoja.querySelectorAll(".hj-act")];
  const primera = actividades[0];
  const cabeceraPx = primera
    ? Math.max(0, (primera.getBoundingClientRect().top || 0) - arribaDelContenido)
    : 0;

  return {
    cabeceraPx,
    actividadesPx: actividades.map((a) => altoConMargen(a, doc)),
    piePx: altoConMargen(hoja.querySelector(".hj-foot"), doc),
  };
}

// La simulación. Devuelve cuántos folios salen y cuánto se ha usado del
// último, en píxeles.
//
// `utilPx` es el alto que queda para contenido en UN folio, o sea 297 mm
// menos los dos márgenes de `@page`.
export function repartirEnFolios({ utilPx, cabeceraPx = 0, actividadesPx = [], piePx = 0 }) {
  if (!utilPx || utilPx <= 0) return { folios: 1, usadoUltimoPx: 0, reparto: [] };

  let folios = 1;
  let libre = utilPx - cabeceraPx;
  const reparto = [[]];

  const coloca = (alto, etiqueta) => {
    // UNA PIEZA MÁS ALTA QUE EL FOLIO no cabe en ninguna parte: el navegador
    // la partirá de todas formas. Se coloca donde está y se sigue, porque
    // abrir folios nuevos sin fin no arreglaría nada y el aviso ya dirá que
    // la hoja se ha ido de tamaño.
    if (alto > libre && alto <= utilPx) {
      folios += 1;
      libre = utilPx;
      reparto.push([]);
    }
    libre -= alto;
    reparto[reparto.length - 1].push(etiqueta);
  };

  actividadesPx.forEach((alto, i) => coloca(alto, i + 1));
  if (piePx > 0) coloca(piePx, "pie");

  return { folios, usadoUltimoPx: Math.max(0, utilPx - libre), reparto };
}
