// ¿EN CUÁNTOS FOLIOS VA LA HOJA, Y CÓMO QUEDA EL ÚLTIMO?
//
// CAMBIO DE CRITERIO (Jorge, 17/9): *"todos, si hace falta pueden ser dos
// hojas de ejercicios, no nos tenemos que limitar a un solo folio"*. Antes
// esto medía si la hoja CABÍA en un folio y avisaba en rojo si no, con el
// consejo "quita un ejercicio o reduce el espacio para escribir". Ese consejo
// ya está mal: dos folios es un resultado legítimo, no un error.
//
// Lo que sigue siendo un error es OTRA COSA, y es la que se ve al imprimir:
// una hoja que se sale 44 mm saca un segundo folio con una actividad y medio
// palmo de blanco. El profesor gasta dos hojas de papel para lo que cabía en
// una y pico. Eso es lo que hay que avisar.
//
// Así que la pregunta ya no es "cabe o no cabe" sino "cuántos folios y cuánto
// se aprovecha el último".
//
// El aviso NUNCA se imprime (`hj-no-imprimir`): es para quien monta la hoja.
// Y el arreglo nunca es reducir la letra.
//
// MEDIDAS INYECTABLES: los dos altos se pasan como parámetros porque en los
// tests no hay maquetación de verdad (happy-dom no calcula alturas) y porque
// así la regla se puede probar sin navegador.

export const ALTO_FOLIO_MM = 297;
const PX_POR_MM = 96 / 25.4;

// POR DEBAJO DE ESTO, EL ÚLTIMO FOLIO ESTÁ GASTADO. 80 mm son poco más de un
// cuarto de folio: da para dos actividades de seis apartados. Con menos que
// eso, lo que hay en la última hoja no justifica la hoja.
export const MINIMO_ULTIMO_FOLIO_MM = 80;

// LA MEDIDA DE PANTALLA ES UNA ESTIMACIÓN, NO EL NÚMERO DE FOLIOS.
//
// Esto lo descubrí comparando lo que dice esta función con los folios que
// Chromium saca de verdad en el PDF, sobre seis hojas de distinto tamaño.
// Coincidió en cinco. En la sexta esta función decía dos folios y el PDF
// traía uno: el contenido sobresalía **6 mm** del folio, y a esa distancia
// la maquetación de pantalla y la de impresión ya no coinciden — el motor de
// impresión redondea las líneas de otra manera.
//
// No se arregla con una tolerancia disimulada, porque el error reaparecería
// en el siguiente borde. Se arregla diciendo la verdad: dentro de esta
// franja el número de folios NO se sabe, y el consejo es el mismo de todas
// formas (quita un ejercicio y te aseguras el folio de menos).
export const MARGEN_DE_DUDA_MM = 15;

// Un folio medido por el navegador, no calculado: si la página está con zoom,
// 297mm no son 1123px y la comparación saldría mal.
export function altoFolioPx(doc = globalThis.document) {
  if (!doc?.body) return ALTO_FOLIO_MM * PX_POR_MM;
  const probe = doc.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;width:0;height:297mm;";
  doc.body.appendChild(probe);
  const alto = probe.getBoundingClientRect?.().height || 0;
  probe.remove();
  return alto || ALTO_FOLIO_MM * PX_POR_MM;
}

// Los márgenes verticales del folio, en píxeles, leídos del CSS y no
// escritos aquí: los define `--hj-margen-alto` / `--hj-margen-bajo` en
// hoja.css, y duplicar el número en JavaScript es cómo se desincronizan.
export function margenVerticalPx(hoja, doc = globalThis.document) {
  const vista = doc?.defaultView;
  if (!hoja || !vista?.getComputedStyle) return 0;
  const css = vista.getComputedStyle(hoja);
  return (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
}

// CUENTA FOLIOS SOBRE EL ALTO ÚTIL, NO SOBRE 297 mm.
//
// Esta es la parte que hubo que rehacer al permitir hojas de dos folios. Al
// imprimir, el margen lo pone `@page`, así que **cada** folio pierde los dos
// márgenes y solo caben 275 mm de contenido. En pantalla, en cambio, la hoja
// es una columna continua con el padding UNA vez.
//
// Si se cuentan los folios dividiendo la altura total entre 297, los dos
// modelos coinciden por casualidad en un folio y se separan en tres: una hoja
// de 560 mm de contenido son tres folios impresos (560/275) y la cuenta
// ingenua diría dos ((22+560)/297). El aviso mentiría precisamente en el caso
// en el que sirve de algo.
export function medirFolios(
  hoja,
  { alto = null, folio = null, margen = null, doc = globalThis.document } = {},
) {
  const altoHoja = alto ?? hoja?.getBoundingClientRect?.().height ?? 0;
  const altoUno = folio ?? altoFolioPx(doc);
  if (!altoUno) return { folios: 1, usadoUltimoMm: 0, desaprovechado: false };

  const margenPx = margen ?? margenVerticalPx(hoja, doc);
  const enMm = (px) => (px / altoUno) * ALTO_FOLIO_MM;
  const contenidoMm = Math.max(0, enMm(altoHoja - margenPx));
  const utilPorFolioMm = Math.max(1, ALTO_FOLIO_MM - enMm(margenPx));

  // Medio milímetro de más es redondeo del navegador, no una actividad de
  // sobra: se resta 1 mm antes de contar, para que una hoja que llena el
  // folio justo no pase a valer dos.
  const folios = Math.max(1, Math.ceil((contenidoMm - 1) / utilPorFolioMm));
  const usadoUltimoMm =
    Math.round((contenidoMm - (folios - 1) * utilPorFolioMm) * 10) / 10;

  return {
    folios,
    usadoUltimoMm,
    // Viaja en el resultado porque es el denominador del mensaje: decir "38
    // de 297" sería mentir, porque 22 de esos 297 son margen y ahí no cabe
    // un ejercicio.
    utilPorFolioMm: Math.round(utilPorFolioMm * 10) / 10,
    // Tan cerca del borde que el folio de más puede salir o no salir.
    enElLimite: folios > 1 && usadoUltimoMm < MARGEN_DE_DUDA_MM,
    // Un folio solo no se desaprovecha nunca: es el que hay.
    desaprovechado: folios > 1 && usadoUltimoMm < MINIMO_ULTIMO_FOLIO_MM,
  };
}

export function textoDeFolios({
  folios = 1,
  usadoUltimoMm = 0,
  utilPorFolioMm = ALTO_FOLIO_MM,
  enElLimite = false,
  desaprovechado = false,
} = {}) {
  if (folios <= 1) return "";
  if (enElLimite) {
    // NO SE AFIRMA EL NÚMERO DE FOLIOS. A esta distancia del borde la
    // medición de pantalla no lo sabe, y decirlo con seguridad sería el tipo
    // de dato que parece medido y es una suposición.
    return `La hoja va justo en el límite: sobresale ${usadoUltimoMm} mm del folio ${folios - 1}. `
      + `Según la impresora puede salir en ${folios - 1} o en ${folios}. `
      + `Quita un ejercicio para asegurar ${folios - 1} — no reduzcas la letra.`;
  }
  if (desaprovechado) {
    // Las dos salidas, porque las dos son válidas y el que monta la hoja sabe
    // cuál quiere: recortar hasta que quepa en una menos, o llenar la última.
    return `El folio ${folios} va casi vacío: ${usadoUltimoMm} mm de ${utilPorFolioMm}. `
      + `Quita un ejercicio para que quepan en ${folios - 1}, o añade otro para aprovecharlo `
      + "— no reduzcas la letra.";
  }
  return `Va en ${folios} folios. El último usa ${usadoUltimoMm} mm de ${utilPorFolioMm}.`;
}

// DOS ESTADOS Y NO UNO, porque ya no todo lo que se dice es un problema.
// `hj-aviso` es el rojo de antes y se reserva para el folio desperdiciado;
// `hj-nota` es informativo: dos folios es un dato, no una queja.
export function buildNotaDeFolios(medida, doc = globalThis.document) {
  const texto = textoDeFolios(medida || {});
  if (!texto) return null;
  const nota = doc.createElement("div");
  nota.className = medida.desaprovechado
    ? "hj-aviso hj-no-imprimir"
    : "hj-nota hj-no-imprimir";
  nota.textContent = texto;
  return nota;
}

// HAY QUE ESPERAR A LAS TIPOGRAFÍAS, y esto no es una precaución teórica: la
// primera versión avisaba de que la hoja de enteros se salía 40mm cuando cabe
// exactamente. Medía con la tipografía de sistema, antes de que llegaran
// Instrument Serif e IBM Plex, y con otra tipografía el texto ocupa otra cosa.
// El aviso se quedaba puesto aunque la página ya hubiera recompuesto bien.
async function esperarFuentes(doc) {
  try {
    await doc?.fonts?.ready;
  } catch {
    // Sin FontFaceSet (o si falla) se mide igual: más vale medir con la
    // tipografía que haya que no medir.
  }
}

// Mide y deja la nota puesta o quitada. Idempotente: se puede llamar después
// de cada cambio de ejercicio sin acumular notas.
export async function revisarAjuste(
  contenedor,
  hoja,
  { doc = globalThis.document, alto = null, folio = null, margen = null } = {},
) {
  if (!contenedor || !hoja) return null;
  await esperarFuentes(doc);
  contenedor.querySelector?.(".hj-aviso")?.remove();
  contenedor.querySelector?.(".hj-nota")?.remove();
  // Las tres medidas se inyectan en los tests, donde no hay maquetación.
  const medida = medirFolios(hoja, { doc, alto, folio, margen });
  const nota = buildNotaDeFolios(medida, doc);
  if (nota) contenedor.insertBefore(nota, hoja);
  return medida;
}
