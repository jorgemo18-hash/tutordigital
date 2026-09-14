// ¿CABE LA HOJA EN UN FOLIO?
//
// Esto es el mecanismo que hace cumplir *"sin sacar 100 ejercicios, más vale
// calidad y originalidad que cantidad"* sin que nadie tenga que acordarse.
//
// El problema es real y lo descubrimos midiendo, no pensando: la primera
// versión de la hoja de enteros llevaba siete actividades y ocupaba 410 mm,
// o sea folio y medio. En pantalla no se nota — la página simplemente sigue
// hacia abajo — y el que se lleva la sorpresa es el profesor cuando la
// impresora saca una segunda cara con un ejercicio y medio.
//
// Así que la hoja se mide y, si no cabe, se avisa EN PANTALLA (el aviso no se
// imprime nunca). El arreglo no es reducir la letra: es quitar un ejercicio o
// quitar espacio para escribir. Cuando los ejercicios los proponga un modelo,
// esta misma función es la que le dirá "te has pasado, quita uno".
//
// MEDIDAS INYECTABLES: los dos altos se pasan como parámetros porque en los
// tests no hay maquetación de verdad (happy-dom no calcula alturas) y porque
// así la regla —"cabe o no cabe"— se puede probar sin navegador.

export const ALTO_FOLIO_MM = 297;
const PX_POR_MM = 96 / 25.4;

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

export function medirDesborde(hoja, { alto = null, folio = null, doc = globalThis.document } = {}) {
  const altoHoja = alto ?? hoja?.getBoundingClientRect?.().height ?? 0;
  const altoUno = folio ?? altoFolioPx(doc);
  if (!altoUno) return { cabe: true, desbordeMm: 0, folios: 1 };

  const desbordePx = altoHoja - altoUno;
  // Medio milímetro de más es redondeo del navegador, no un ejercicio de
  // sobra: por debajo de 1mm se considera que cabe.
  const desbordeMm = Math.round((desbordePx / altoUno) * ALTO_FOLIO_MM * 10) / 10;
  return {
    cabe: desbordeMm < 1,
    desbordeMm: desbordeMm > 0 ? desbordeMm : 0,
    folios: Math.max(1, Math.ceil(altoHoja / altoUno)),
  };
}

export function textoDeDesborde({ desbordeMm = 0, folios = 1 } = {}) {
  const cuantos = folios > 1 ? `Va a salir en ${folios} folios.` : "";
  return `Se sale del folio por ${desbordeMm} mm. ${cuantos} Quita un ejercicio o reduce el espacio para escribir — no la letra.`.trim();
}

export function buildAvisoDeDesborde(medida, doc = globalThis.document) {
  if (!medida || medida.cabe) return null;
  const aviso = doc.createElement("div");
  // hj-no-imprimir: el aviso es para quien monta la hoja, no para el alumno.
  aviso.className = "hj-aviso hj-no-imprimir";
  aviso.textContent = textoDeDesborde(medida);
  return aviso;
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

// Comprueba si cabe y deja el aviso puesto o quitado. Idempotente: se puede
// llamar después de cada cambio de ejercicio sin acumular avisos.
export async function revisarAjuste(
  contenedor,
  hoja,
  { doc = globalThis.document, alto = null, folio = null } = {},
) {
  if (!contenedor || !hoja) return null;
  await esperarFuentes(doc);
  contenedor.querySelector?.(".hj-aviso")?.remove();
  // `alto` y `folio` se inyectan en los tests, donde no hay maquetación.
  const medida = medirDesborde(hoja, { doc, alto, folio });
  const aviso = buildAvisoDeDesborde(medida, doc);
  if (aviso) contenedor.insertBefore(aviso, hoja);
  return medida;
}
