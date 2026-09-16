// QUE EL CUADRANTE SE LLEVE EL FOLIO ENTERO.
//
// Jorge, 16/09/2026, viendo el primer PDF: *"que se adapte según lo que ocupa
// para que salga en una hoja entera"*. La tabla cabía, sí, pero se quedaba en
// el tercio de arriba con letra de 9pt, y un cuadrante colgado en la pared con
// letra de 9pt no se lee desde dos metros.
//
// NO SE ESTIRAN LAS FILAS, SE AGRANDA LA LETRA. Estirar las filas para rellenar
// el folio deja celdas enormes con el texto minúsculo pegado arriba: parece un
// error de maquetación, no un cuadrante. Lo que se busca es la letra MÁS GRANDE
// que todavía quepa.
//
// CÓMO SE MIDE, que es la parte que podría parecer imposible. No se puede medir
// en papel, pero no hace falta: los milímetros de CSS son unidades absolutas,
// así que una tabla dentro de una caja de 277mm de ancho (A4 horizontal menos
// los márgenes) mide EN PANTALLA lo que va a medir en el papel. Es el mismo
// truco con el que se comprobó la hoja de ejercicios, y allí la predicción
// coincidió con el PDF al milímetro.
//
// Por eso el aspecto de la tabla vive fuera de `@media print`: si estuviera
// dentro, al medir no existiría.

const ANCHO_UTIL_MM = 277;   // A4 horizontal (297) menos 10mm de margen a cada lado
const ALTO_UTIL_MM = 190;    // A4 horizontal (210) menos 10mm arriba y abajo
const MM_POR_PULGADA = 25.4;

// La cabecera de papel (centro, título y fecha) solo ocupa sitio en el primer
// folio. Se mide de verdad en vez de descontar un número a ojo.
const MARGEN_SEGURIDAD_MM = 3;

// De pequeño a grande. Pasos de medio punto por abajo, donde se nota, y de
// punto por arriba, donde no. El tope de 20pt no es estético: por encima, una
// casilla con siete nombres empieza a partir palabras.
export const CUERPOS_PT = [8, 8.5, 9, 9.5, 10, 11, 12, 13, 14, 15, 16, 18, 20];

export function pxPorMm(doc = globalThis.document) {
  // Se pregunta al navegador en vez de asumir 96dpi: con el zoom del sistema
  // o del navegador, 1mm no son siempre 3,78px.
  const probe = doc.createElement("div");
  probe.style.cssText = "position:absolute;visibility:hidden;height:100mm;width:0;";
  doc.body?.appendChild(probe);
  const alto = probe.getBoundingClientRect?.().height || 0;
  probe.remove();
  return alto ? alto / 100 : 96 / MM_POR_PULGADA;
}

// El banco de medir: una caja del ancho útil del folio, fuera de la pantalla.
// `visibility: hidden` y no `display: none` — lo que no se dibuja no se mide.
function abrirBanco(doc) {
  const banco = doc.createElement("div");
  banco.className = "cq-medida";
  doc.body?.appendChild(banco);
  return banco;
}

// Mide un nodo como si estuviera en el folio, con un cuerpo de letra dado.
// Se mide una COPIA: el original está dentro de `.ac-print-solo`, que es
// `display: none`, y moverlo para medirlo haría parpadear la pantalla.
export function medirAltoMm(nodo, { cuerpoPt = null, doc = globalThis.document, porMm = null } = {}) {
  if (!nodo || !doc?.body) return 0;
  const banco = abrirBanco(doc);
  try {
    const copia = nodo.cloneNode(true);
    // Sin esta clase la copia heredaría el display:none del original.
    copia.classList.remove("ac-print-solo");
    if (cuerpoPt !== null) copia.style.setProperty("--cq-font", `${cuerpoPt}pt`);
    banco.appendChild(copia);
    const alto = copia.getBoundingClientRect?.().height || 0;
    return alto / (porMm || pxPorMm(doc));
  } finally {
    banco.remove();
  }
}

// El cuerpo más grande que cabe en el alto disponible. Se recorre de mayor a
// menor y se coge el primero que entra; si no entra ni el más pequeño se
// devuelve ése, y la tabla pasará al folio siguiente — que ahora funciona, así
// que es una salida digna y no una pérdida de datos.
export function elegirCuerpo(medir, { altoDisponibleMm = ALTO_UTIL_MM, cuerpos = CUERPOS_PT } = {}) {
  const orden = [...cuerpos].sort((a, b) => b - a);
  for (const pt of orden) {
    if (medir(pt) <= altoDisponibleMm) return pt;
  }
  return orden[orden.length - 1];
}

// Ajusta cada hoja del cuadrante. Las hojas son una por profesor y cada una va
// en su folio (ver el `break-after: page` del CSS), así que cada una se mide
// contra un folio completo — y solo a la primera se le descuenta la cabecera
// de papel, que es la única que la lleva encima.
export function ajustarCuadranteAlFolio({
  hojas = [],
  cabecera = null,
  doc = globalThis.document,
  altoUtilMm = ALTO_UTIL_MM,
} = {}) {
  if (!hojas.length || !doc?.body) return [];
  const porMm = pxPorMm(doc);
  const altoCabeceraMm = cabecera ? medirAltoMm(cabecera, { doc, porMm }) : 0;

  return hojas.map((hoja, i) => {
    const disponible = altoUtilMm - MARGEN_SEGURIDAD_MM - (i === 0 ? altoCabeceraMm : 0);
    const cuerpo = elegirCuerpo(
      (pt) => medirAltoMm(hoja, { cuerpoPt: pt, doc, porMm }),
      { altoDisponibleMm: disponible }
    );
    hoja.style.setProperty("--cq-font", `${cuerpo}pt`);
    return cuerpo;
  });
}

// HAY QUE ESPERAR A LAS TIPOGRAFÍAS antes de medir. No es teórico: en la hoja
// de ejercicios, medir antes de que llegaran IBM Plex e Instrument Serif dio un
// desborde de 40mm en una hoja que cabía justa. Con la tipografía de sistema el
// texto ocupa otra cosa, y aquí se decidiría un cuerpo de letra equivocado.
async function esperarFuentes(doc) {
  try {
    await doc?.fonts?.ready;
  } catch {
    // Sin FontFaceSet se mide con lo que haya: más vale eso que no medir.
  }
}

// Un solo punto de entrada para los paneles: busca las hojas dentro del
// contenedor y las ajusta. Idempotente — se puede llamar en cada repintado
// ("sin nombres", cambio de profesor) sin acumular nada.
export async function revisarAjusteDelCuadrante(contenedor, { doc = globalThis.document } = {}) {
  if (!contenedor?.querySelectorAll) return [];
  await esperarFuentes(doc);
  const hojas = [...contenedor.querySelectorAll(".cq-hoja")];
  const cabecera = contenedor.querySelector(".ac-print-cuadrante-head");
  return ajustarCuadranteAlFolio({ hojas, cabecera, doc });
}

export { ALTO_UTIL_MM, ANCHO_UTIL_MM, MARGEN_SEGURIDAD_MM };
