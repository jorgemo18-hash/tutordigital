// EL BOTÓN DE IMPRIMIR DEL CUADRANTE, PARA LAS DOS REJILLAS.
//
// Pedido por Jorge el 14/09/2026: *"el calendario de dar clases podría tener un
// botón de imprimir para que quepa en un folio en horizontal"*.
//
// SE IMPRIME LO QUE HAY EN PANTALLA, no una versión aparte. Es la diferencia
// con la hoja para familias, que es un PDF hecho en el servidor: aquélla tiene
// que caer en cuatro cuartillas exactas y se la lleva una familia, así que se
// dibuja a mano y no lleva nombres. Esto es el cuadrante que Jorge ya está
// mirando, en papel, para él.
//
// Y ESO RESUELVE LO DE LOS NOMBRES SIN DECIDIR NADA: la rejilla del aula ya
// tiene el interruptor "sin nombres" (el que deja solo las plazas libres, para
// poder enseñar la pantalla). Como se imprime lo que se ve, si está activado
// sale sin nombres y si no, con ellos. Un segundo botón de "imprimir sin
// nombres" sería una segunda forma de decir lo mismo.
//
// window.print() con hoja de impresión, no un PDF: es el patrón que ya usan los
// modelos fiscales en este mismo panel.
//
// LO QUE SE IMPRIME NO ES LA REJILLA sino una tabla aparte (ver
// cuadranteImprimible.js): la rejilla de pantalla es una caja con scroll y una
// caja con scroll se imprime cortada. Aquí queda el botón, la cabecera de papel
// y la carga de la hoja de estilos.

const LINK_ID = "ac-cuadrante-print-styles";
const HREF = "/assets/shared/styles/components/cuadrante-print.css";

// Idempotente: el cuadrante se repinta cada vez que se cambia de semana o se
// pulsa "sin nombres", y no hace falta una etiqueta <link> por repintado.
export function ensureEstilosDeImpresion(doc = globalThis.document) {
  if (!doc?.head || doc.getElementById(LINK_ID)) return;
  const link = doc.createElement("link");
  link.id = LINK_ID;
  link.rel = "stylesheet";
  link.href = HREF;
  doc.head.appendChild(link);
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function textoFechaImpresion(fecha = new Date()) {
  return `Impreso el ${fecha.getDate()} de ${MESES[fecha.getMonth()]} de ${fecha.getFullYear()}`;
}

// La cabecera que solo existe en el papel. Un cuadrante colgado en una pared
// sin fecha no se sabe si está vigente, y sin el nombre del centro no se sabe
// de quién es en cuanto hay dos academias.
export function buildCabeceraDeImpresion({ titulo = "Horario semanal", centro = "", fecha = new Date() } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-print-solo ac-print-cuadrante-head";

  const izq = document.createElement("div");
  const t = document.createElement("div");
  t.className = "ac-print-cuadrante-titulo";
  t.textContent = titulo;
  izq.appendChild(t);
  if (centro) {
    const c = document.createElement("div");
    c.className = "ac-print-cuadrante-centro";
    c.textContent = centro;
    izq.appendChild(c);
  }

  const der = document.createElement("div");
  der.className = "ac-print-cuadrante-fecha";
  der.textContent = textoFechaImpresion(fecha);

  wrap.append(izq, der);
  return wrap;
}

// El botón. `imprimirFn` se inyecta para poder probarlo: window.print() abre un
// diálogo del navegador y bloquea el proceso, así que un test nunca debe
// llamarlo de verdad.
// SAFARI NO HACE CASO A `@page { size: A4 landscape }`. Visto en el diálogo de
// impresión de Jorge el 16/09: la orientación salía en Vertical con el CSS
// pidiendo horizontal, y el cuadrante en vertical se parte en varias hojas.
// Chrome y Firefox sí lo aplican, así que el aviso solo se enseña donde hace
// falta — en los demás navegadores sería ruido que además desconcierta ("¿no
// estaba ya en horizontal?").
export function esSafari(userAgent = globalThis.navigator?.userAgent || "") {
  return /safari/i.test(userAgent) && !/chrome|chromium|crios|android|edg|fxios/i.test(userAgent);
}

export function buildNotaOrientacion({ userAgent = globalThis.navigator?.userAgent || "" } = {}) {
  if (!esSafari(userAgent)) return null;
  const nota = document.createElement("span");
  // hj/ac-print-solo al revés: esto se ve en PANTALLA y no en el papel.
  nota.className = "ac-nota-orientacion";
  nota.textContent = "En Safari, elige orientación horizontal en el diálogo.";
  return nota;
}

export function buildBotonImprimir({ imprimirFn = null, ventana = globalThis.window } = {}) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ac-btn-imprimir";
  btn.textContent = "Imprimir";
  btn.title = "Imprime el cuadrante tal como se ve, en un folio horizontal";

  // Un doble clic abriría dos diálogos de impresión encolados, y el segundo
  // aparece cuando ya has cerrado el primero: parece que la aplicación se ha
  // quedado colgada (mismo cuidado que en los botones de impresión fiscal).
  let imprimiendo = false;
  btn.addEventListener("click", () => {
    if (imprimiendo) return;
    imprimiendo = true;
    try {
      ensureEstilosDeImpresion();
      (imprimirFn || ventana?.print?.bind(ventana))?.();
    } finally {
      // El diálogo es bloqueante: cuando se vuelve aquí, ya se ha cerrado.
      imprimiendo = false;
    }
  });
  return btn;
}
