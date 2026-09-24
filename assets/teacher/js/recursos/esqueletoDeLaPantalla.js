import { el, boton } from "./elementos.js";

// LA ESTRUCTURA DE LA PANTALLA DE HOJAS, en escritorio y en móvil.
//
// Escritorio (diseño de Claude Design): cabecera con el PDF, barra de
// contexto, y dos columnas: ejercicios (y hojas recientes) | folio.
//
// Móvil (≤768 px, pantallas 2b/2c del diseño y lo investigado el 24/9):
//  - La barra de contexto va plegada tras un resumen ("1.º ESO · Sumar y
//    restar · Normal"): en 390 px, seis desplegables se comían la pantalla y
//    se cambian poco. Se despliega al tocar.
//  - El folio no cabe al lado: "Ver folio" lo abre a pantalla completa, y
//    se vuelve con "Volver a los ejercicios".
//  - "Ver folio" y el PDF van en una barra fija abajo, a mano del pulgar.
//
// No llama a nada: recibe las acciones y devuelve las piezas que la
// pantalla rellena.
export function construirEsqueleto({ doc, raiz, barraEl, visorEl, recientesEl, onImprimir, movil = false }) {
  const p = {};
  const cab = el(doc, "div", "rc-head");
  const tit = el(doc, "div");
  p.titulo = el(doc, "h1", "rc-h1", "Hoja de ejercicios");
  tit.append(el(doc, "div", "rc-crumb", "Recursos · Hojas de ejercicios"), p.titulo);
  p.pdf = boton(doc, "PDF para imprimir", { clase: "rc-btn--pri", onClick: onImprimir });
  p.pdf.disabled = true;
  // El código de la hoja guardada, como en el diseño (H-260923-01).
  p.codigo = el(doc, "span", "rc-tag rc-tag--mono");
  p.codigo.hidden = true;
  p.codigo.title = "Código de la hoja: va impreso en el papel";
  cab.append(tit, el(doc, "span", "rc-sp"), p.codigo);
  if (!movil) cab.appendChild(p.pdf);

  p.aviso = el(doc, "p", "rc-ban");
  p.aviso.hidden = true;
  p.msg = el(doc, "p", "rc-msg");
  p.msg.setAttribute("role", "status");

  const cuerpo = el(doc, "div", "rc-cuerpo");
  p.cuerpo = cuerpo;
  p.lista = el(doc, "div", "rc-card rc-lista");
  const izquierda = el(doc, "div", "rc-izquierda");
  izquierda.append(p.lista, recientesEl);

  const previa = el(doc, "div", "rc-previa");
  const cabPrevia = el(doc, "div", "rc-previa__cab");
  const folio = el(doc, "div", "rc-previa__folio");
  folio.appendChild(visorEl);
  p.folio = folio;
  if (movil) {
    const volver = boton(doc, "← Volver a los ejercicios", { clase: "rc-btn--sm", onClick: () => verFolio(false) });
    cabPrevia.append(volver, el(doc, "span", "rc-sp"), el(doc, "div", "rc-crumb", "Folio A4"));
  } else {
    const ampliar = boton(doc, "Ampliar", { clase: "rc-btn--sm rc-btn--gh" });
    ampliar.addEventListener("click", () => {
      const grande = cuerpo.classList.toggle("rc-cuerpo--grande");
      ampliar.textContent = grande ? "Reducir" : "Ampliar";
    });
    cabPrevia.append(el(doc, "div", "rc-crumb", "Folio A4 · vista previa"), el(doc, "span", "rc-sp"), ampliar);
  }
  previa.append(cabPrevia, folio, el(doc, "div", "rc-foot", movil
    ? "Así se imprime. Toca un ejercicio para cambiarlo."
    : "A4 · blanco y negro · pulsa un ejercicio para cambiarlo"));
  cuerpo.append(izquierda, previa);

  // En móvil, el folio a pantalla completa; el alto real lo pone el visor.
  function verFolio(si) {
    cuerpo.classList.toggle("rc-cuerpo--folio", si);
    doc.body.classList.toggle("rc-sin-scroll", si);
    if (si) {
      const ancho = Math.max(240, (doc.defaultView?.innerWidth || 390) - 24);
      visorEl.style.zoom = String(ancho / 794);
    }
  }
  p.verFolio = verFolio;

  const partes = [cab, p.aviso];
  if (movil) {
    // La barra de contexto, plegada tras su resumen.
    const plegable = el(doc, "details", "rc-ctx-plegable");
    p.resumen = el(doc, "summary", "rc-ctx-plegable__resumen", "Qué hoja");
    plegable.append(p.resumen, barraEl);
    partes.push(plegable);
  } else {
    partes.push(barraEl);
  }
  partes.push(p.msg, cuerpo);
  if (movil) {
    const abajo = el(doc, "div", "rc-barra-movil");
    p.verFolioBtn = boton(doc, "Ver folio", { onClick: () => verFolio(true) });
    abajo.append(p.verFolioBtn, p.pdf);
    partes.push(abajo);
  }
  raiz.replaceChildren(...partes);
  return p;
}
