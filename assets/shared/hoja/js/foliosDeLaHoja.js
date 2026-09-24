import { medirPiezas, repartirEnFolios } from "./paginacionDeLaHoja.js";
import { altoFolioPx, margenVerticalPx } from "./ajusteDelFolio.js";
import { ALTO_CABECERA_DE_CONTINUACION_MM, buildCabeceraDeContinuacion, textoDelPie } from "./cabeceraDeContinuacion.js";

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
  const pie = hoja.querySelector(".hj-foot");
  // EL PIE VA EN TODOS LOS FOLIOS (Jorge, 23/9: *"que lo ponga en el final de
  // todas las páginas"*), así que se reserva su sitio en cada folio y no
  // compite con los ejercicios del último. Con pie en todos, "el pie se
  // quedaría solo en un folio" ya no puede pasar.
  pie?.classList.remove("hj-foot--suelto");
  const medidas = piezas || medirPiezas(hoja, doc);
  const utilPx = altoUno - (margen ?? margenVerticalPx(hoja, doc)) - holgura - (medidas.piePx || 0);
  // Los folios 2 y siguientes llevan una cabecera corta (nombre y objetivo).
  const cabeceraSiguePx = (ALTO_CABECERA_DE_CONTINUACION_MM / 297) * altoUno;
  const { reparto } = repartirEnFolios({ utilPx, ...medidas, cabeceraSiguePx, piePx: 0 });

  const folios = reparto.filter((f) => f.length);
  hoja.classList.add("hj-folio");
  hoja.dataset.folio = "1";
  if (folios.length <= 1) return [hoja];

  const codigo = hoja.dataset.codigo || "";
  const objetivo = hoja.querySelector(".hj-title")?.textContent || "";
  const numeraPie = (folio, n) => {
    const c = folio.querySelector(".hj-foot-codigo");
    if (c) c.textContent = textoDelPie(codigo, n, folios.length);
  };
  numeraPie(hoja, 1);

  const lista = hoja.querySelector(".hj-act-lista");
  const actividades = [...hoja.querySelectorAll(".hj-act")];
  const resultado = [hoja];
  let anterior = hoja;

  folios.slice(1).forEach((piezasDelFolio, i) => {
    const nuevo = doc.createElement("article");
    nuevo.className = hoja.className;
    nuevo.dataset.folio = String(i + 2);
    nuevo.dataset.codigo = codigo;
    nuevo.appendChild(buildCabeceraDeContinuacion({ objetivo, doc }));
    const seccion = doc.createElement("section");
    seccion.className = "hj-actividades hj-actividades--sigue";
    const ol = doc.createElement("ol");
    ol.className = lista?.className || "hj-act-lista";
    seccion.appendChild(ol);
    nuevo.appendChild(seccion);
    // Se MUEVEN los nodos ya pintados (con sus fórmulas de KaTeX dibujadas),
    // no se vuelven a construir.
    for (const p of piezasDelFolio) if (actividades[p - 1]) ol.appendChild(actividades[p - 1]);
    if (pie) {
      nuevo.appendChild(pie.cloneNode(true));
      numeraPie(nuevo, i + 2);
    }
    anterior.after(nuevo);
    anterior = nuevo;
    resultado.push(nuevo);
  });

  return resultado;
}
