import { medirPiezas, repartirEnFolios } from "./paginacionDeLaHoja.js";
import { altoFolioPx, margenVerticalPx } from "./ajusteDelFolio.js";

// LA HOJA PARTIDA EN FOLIOS DE VERDAD, antes de imprimir.
//
// Hasta el 23/9 la hoja era un único bloque largo y el salto de página lo
// decidía el navegador al imprimir, con la orden "no partas un ejercicio"
// (`break-inside: avoid`). Chrome la cumple; Safari no: Jorge imprimió dos
// veces desde Safari y los ejercicios salieron partidos entre folios, con
// huecos grandes en medio, aunque en pantalla se veía bien. Un primer arreglo
// (quitar el flex de las actividades) no bastó.
//
// Así que ya no se le pide nada al navegador. La hoja se mide aquí, en el
// mismo navegador que va a imprimir, se reparte con la regla de siempre
// (`repartirEnFolios`: un ejercicio que no cabe abajo pasa entero al folio
// siguiente) y se construye UN ARTÍCULO POR FOLIO, cada uno con su salto de
// página detrás. Cada folio ya cabe en su página, así que el navegador no
// tiene nada que decidir, y la vista previa enseña exactamente los folios que
// van a salir (Jorge: *"aunque ocupe dos páginas lo muestra todo en una"*).
//
// Es la única regla que pidió Jorge: que no se corte un ejercicio, y el resto
// apurado. El reparto es voraz: cada folio se llena hasta donde cabe.

// Un poco de aire: la medida es de pantalla y la impresión redondea las
// líneas a su manera (en Chrome, hasta 2 mm de diferencia medidos).
export const HOLGURA_DEL_FOLIO_MM = 3;

// Reparte y construye. Devuelve los folios (el primero es `hoja` misma).
// `piezas`, `folio` y `margen` se inyectan en los tests, donde happy-dom no
// maqueta.
export function partirEnFolios(hoja, { doc = globalThis.document, piezas = null, folio = null, margen = null } = {}) {
  if (!hoja?.parentNode) return [hoja];
  const altoUno = folio ?? altoFolioPx(doc);
  const holgura = (HOLGURA_DEL_FOLIO_MM / 297) * altoUno;
  const utilPx = altoUno - (margen ?? margenVerticalPx(hoja, doc)) - holgura;
  const pie = hoja.querySelector(".hj-foot");
  // Un pie ya marcado como suelto (ver ajusteDelFolio.js) no se imprime y no
  // cuenta: no puede abrir un folio.
  const medidas = piezas || medirPiezas(hoja, doc);
  const { reparto } = repartirEnFolios({
    utilPx, ...medidas, piePx: pie?.classList.contains("hj-foot--suelto") ? 0 : medidas.piePx,
  });

  const folios = reparto.filter((f) => f.length);
  hoja.classList.add("hj-folio");
  hoja.dataset.folio = "1";
  if (folios.length <= 1) return [hoja];

  const lista = hoja.querySelector(".hj-act-lista");
  const actividades = [...hoja.querySelectorAll(".hj-act")];
  const resultado = [hoja];
  let anterior = hoja;

  folios.slice(1).forEach((piezasDelFolio, i) => {
    const nuevo = doc.createElement("article");
    nuevo.className = hoja.className;
    nuevo.dataset.folio = String(i + 2);
    nuevo.dataset.codigo = hoja.dataset.codigo || "";
    const seccion = doc.createElement("section");
    seccion.className = "hj-actividades hj-actividades--sigue";
    const ol = doc.createElement("ol");
    ol.className = lista?.className || "hj-act-lista";
    seccion.appendChild(ol);
    nuevo.appendChild(seccion);
    // Se MUEVEN los nodos ya pintados (con sus fórmulas de KaTeX dibujadas),
    // no se vuelven a construir.
    for (const p of piezasDelFolio) {
      if (p === "pie") { if (pie) nuevo.appendChild(pie); } else if (actividades[p - 1]) ol.appendChild(actividades[p - 1]);
    }
    anterior.after(nuevo);
    anterior = nuevo;
    resultado.push(nuevo);
  });

  return resultado;
}
