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

// De pequeño a grande, en pasos de medio punto. Los pasos finos no son
// cosmética: el alto no crece suave con la letra, da SALTOS, porque cada medio
// punto puede hacer que una casilla pase de tres líneas a cuatro. Medido con el
// cuadrante de Lyceo: 14pt ocupa 166mm y 15pt ocupa 207mm. Con pasos de punto
// entero se pierden 20mm de folio por no tener el escalón intermedio.
//
// El tope de 20pt no es estético: por encima, una casilla con siete nombres
// empieza a partir palabras.
export const CUERPOS_PT = [
  8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 17, 18, 20,
];

// Las tipografías que usa la tabla. Hay que pedirlas EXPLÍCITAMENTE antes de
// medir, y esto es el fallo que se coló en la primera versión:
//
//   `await document.fonts.ready` NO SIRVE AQUÍ. La tabla vive dentro de
//   `.ac-print-solo { display: none }`, así que el navegador nunca llega a
//   pedir IBM Plex — y como no hay ninguna carga pendiente, `fonts.status` ya
//   vale "loaded" y `fonts.ready` resuelve de inmediato con las tipografías
//   SIN cargar. Comprobado en Chromium: `ready` resuelve y ninguna Plex está
//   cargada.
//
// Consecuencia real: se medía con la tipografía del sistema, que ocupa menos,
// y se elegía 15pt para una tabla que con IBM Plex mide 207mm — o sea, dos
// folios. Que es exactamente lo que le salía a Jorge.
const FUENTES_DE_LA_TABLA = [
  '400 12pt "IBM Plex Sans"',
  '600 12pt "IBM Plex Sans"',
  '500 12pt "IBM Plex Mono"',
];

// El ancho del banco de medir lo pone la hoja de impresión, que se inyecta como
// <link> al pintar y tarda en cargar. Medir antes de que esté daría una caja
// del ancho de la ventana (menos saltos de línea, tabla más baja, letra
// demasiado grande). Se espera a que el banco mida de verdad los 277mm.
const TOLERANCIA_ANCHO_MM = 5;
const ESPERAS_CSS = 20;
const MS_ENTRE_ESPERAS = 50;

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

// Pide las tipografías y espera a tenerlas. Ver FUENTES_DE_LA_TABLA: pedirlas
// una por una es obligatorio, `fonts.ready` a secas miente cuando quien las
// necesita está oculto.
export async function esperarTipografias(doc = globalThis.document) {
  try {
    await Promise.all(FUENTES_DE_LA_TABLA.map((f) => doc.fonts.load(f)));
    await doc.fonts.ready;
    return true;
  } catch {
    // Sin FontFaceSet se mide con lo que haya: más vale eso que no medir.
    return false;
  }
}

// ¿Ha llegado ya la hoja de impresión? Se comprueba midiendo el propio banco en
// vez de espiar la etiqueta <link>, que es de otro módulo.
export async function esperarHojaDeEstilos(doc = globalThis.document, { intentos = ESPERAS_CSS } = {}) {
  for (let i = 0; i < intentos; i += 1) {
    const banco = abrirBanco(doc);
    const ancho = banco.getBoundingClientRect?.().width || 0;
    banco.remove();
    const anchoMm = ancho / pxPorMm(doc);
    if (Math.abs(anchoMm - ANCHO_UTIL_MM) < TOLERANCIA_ANCHO_MM) return true;
    await new Promise((listo) => setTimeout(listo, MS_ENTRE_ESPERAS));
  }
  return false;
}

// Un solo punto de entrada para los paneles: busca las hojas dentro del
// contenedor y las ajusta. Idempotente — se puede llamar en cada repintado
// ("sin nombres", cambio de profesor) sin acumular nada.
export async function revisarAjusteDelCuadrante(contenedor, { doc = globalThis.document } = {}) {
  if (!contenedor?.querySelectorAll) return [];
  await esperarTipografias(doc);
  // Si la hoja de impresión no llega, NO se ajusta nada y se queda el 9pt del
  // CSS. Un cuerpo elegido a ciegas sale mal en papel; 9pt cabe siempre.
  if (!(await esperarHojaDeEstilos(doc))) return [];
  const hojas = [...contenedor.querySelectorAll(".cq-hoja")];
  const cabecera = contenedor.querySelector(".ac-print-cuadrante-head");
  return ajustarCuadranteAlFolio({ hojas, cabecera, doc });
}

export { ALTO_UTIL_MM, ANCHO_UTIL_MM, MARGEN_SEGURIDAD_MM };
