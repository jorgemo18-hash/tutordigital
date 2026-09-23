import { crearApiDeRecursos } from "./apiRecursos.js";
import { pedirPdfDeLaHoja } from "../../../shared/generador/apiDeHojas.js";
import { abrirPdf } from "../../../shared/generador/abrirPdf.js";
import { createVisorDeHoja } from "../../../shared/generador/visorDeHoja.js";
import { reemplazaActividad, quitaActividad } from "../../../shared/generador/hojaEditable.js";
import { resumenDeActividad } from "../../../shared/generador/resumenDeActividad.js";
import { buildBarraDeContexto } from "./barraDeContexto.js";
import { pintarListaDeHuecos } from "./listaDeHuecos.js";
import { abrirDialogoCambiar } from "./dialogoCambiar.js";
import { el, boton } from "./elementos.js";

// RECURSOS → HOJAS DE EJERCICIOS, en el panel del profesor de instituto.
// Diseño de Claude Design (23/9): a la izquierda los ejercicios de la hoja,
// cada uno con Cambiar y Quitar; a la derecha el folio tal como se imprime.
//
// Es el mismo generador que la sección "Ejercicios" de la academia (mismas
// rutas, misma vista previa, mismo PDF); cambia la pantalla.
//
// Lo que AÚN NO hace (pasos 2 a 5, ver claude/diseno-recursos-instituto.md):
// guardar la hoja con su código (H-…), ponerla como deberes, corregirla, y
// montarla para un alumno con lo que sabemos de él.
//
// Deps inyectables para test.
export function createPantallaDeHojas({
  api = crearApiDeRecursos(),
  pedirPdfFn = pedirPdfDeLaHoja,
  abrirPdfFn = abrirPdf,
  createVisorFn = createVisorDeHoja,
  abrirDialogoFn = abrirDialogoCambiar,
  centro = "",
  doc = document,
} = {}) {
  let catalogo = null;
  let eleccion = { temaId: null, objetivo: 1, intensidad: "normal", actividades: null };
  let actual = null; // { hoja, huecos } (ver hojaEditable.js)
  let cambiando = null;
  let dialogo = null;
  let peticion = 0;
  const p = {}; // las partes de la pantalla, una vez montada

  const temaDe = (id) => catalogo.temas.find((t) => t.id === id) || catalogo.temas[0];
  const objetivoDe = (e) => temaDe(e.temaId).objetivos.find((o) => o.numero === e.objetivo);
  const tituloDe = (numero) => temaDe(eleccion.temaId).objetivos.find((o) => o.numero === numero)?.titulo;

  function mensaje(texto, error = false) {
    p.msg.textContent = texto || "";
    p.msg.className = error ? "rc-msg rc-msg--error" : "rc-msg";
  }

  function pintar() {
    p.titulo.textContent = objetivoDe(eleccion)?.titulo || "Hoja de ejercicios";
    pintarListaDeHuecos({
      contenedor: p.lista, hoja: actual.hoja, huecos: actual.huecos, cambiando, doc,
      onCambiar: (orden) => abrirCambio(orden),
      onQuitar: (orden) => quitar(orden),
    });
    p.visor.pintar({ ...actual.hoja, centro });
    p.visor.elegir(cambiando);
    p.pdf.disabled = false;
  }

  async function montar(nueva) {
    eleccion = { ...eleccion, ...nueva };
    cerrarCambio();
    peticion += 1;
    const esta = peticion;
    mensaje("Montando la hoja…");
    p.barra.setOcupado(true);
    p.pdf.disabled = true;
    try {
      const { hoja, huecos } = await api.generar(eleccion);
      if (esta !== peticion) return;
      actual = { hoja, huecos: huecos || [] };
      pintar();
      mensaje("");
    } catch (err) {
      if (esta !== peticion) return;
      mensaje(err?.message || "No se pudo montar la hoja.", true);
    } finally {
      if (esta === peticion) p.barra.setOcupado(false);
    }
  }

  function cerrarCambio() {
    if (dialogo) { const d = dialogo; dialogo = null; d.cerrar(); }
    if (cambiando != null) {
      cambiando = null;
      if (actual) pintar();
    }
  }

  async function cambiar(orden, clave) {
    const indice = orden - 1;
    const hueco = actual.huecos[indice];
    dialogo?.setOcupado(true);
    try {
      const nuevo = await api.actividad({
        temaId: eleccion.temaId, objetivo: hueco.objetivo, intensidad: eleccion.intensidad, clave: clave || hueco.clave,
      });
      actual = reemplazaActividad(actual, indice, nuevo, tituloDe);
      cerrarCambio();
      pintar();
      mensaje(`Ejercicio ${orden} cambiado.`);
    } catch (err) {
      dialogo?.setOcupado(false);
      dialogo?.aviso(err?.message || "No se pudo cambiar el ejercicio.");
    }
  }

  // El pedido en palabras para UN ejercicio: la IA contesta con una batería
  // del catálogo (y entonces se cambia), una pregunta, o que no está.
  async function pedido(orden, conversacion) {
    const hueco = actual.huecos[orden - 1];
    const contexto = {
      temaId: eleccion.temaId, objetivo: eleccion.objetivo, intensidad: eleccion.intensidad,
      ejercicio: { orden, objetivo: hueco.objetivo, clave: hueco.clave },
    };
    let r;
    try {
      r = await api.interpretar({ conversacion, contexto });
    } catch (err) {
      return { aviso: err?.message || "No se pudo interpretar el pedido." };
    }
    if (r.accion === "ejercicio") { await cambiar(orden, r.clave); return { hecho: true }; }
    if (r.accion === "pregunta") return { pregunta: r.pregunta, opciones: r.opciones };
    if (r.accion === "hoja") {
      return { aviso: "Eso es una hoja entera, no un ejercicio: cámbiala con la barra de arriba." };
    }
    return { aviso: r.explicacion || "Eso no está en el catálogo de este tema." };
  }

  function abrirCambio(orden) {
    if (!actual) return;
    cerrarCambio();
    const hueco = actual.huecos[orden - 1];
    if (!hueco) return;
    cambiando = orden;
    pintar();
    const r = resumenDeActividad(actual.hoja.actividades[orden - 1]);
    const baterias = temaDe(eleccion.temaId).objetivos.find((o) => o.numero === hueco.objetivo)?.baterias || [];
    dialogo = abrirDialogoFn({
      orden, hueco, baterias, doc,
      resumen: [r.enunciado, r.muestra].filter(Boolean).join(" "),
      onAzar: () => cambiar(orden, null),
      onClave: (clave) => cambiar(orden, clave),
      onPedido: (conversacion) => pedido(orden, conversacion),
      onCerrar: () => { dialogo = null; cerrarCambio(); },
    });
  }

  function quitar(orden) {
    if (!actual || actual.huecos.length <= 1) return;
    cerrarCambio();
    actual = quitaActividad(actual, orden - 1, tituloDe);
    pintar();
    mensaje(`Ejercicio ${orden} quitado; los demás se renumeran.`);
  }

  // Imprimir es un PDF hecho en el servidor (ver api/hoja-pdf.js): cada
  // navegador imprimía la hoja a su manera.
  async function imprimir() {
    if (!actual) return;
    mensaje("Preparando el PDF… tarda unos segundos.");
    p.pdf.disabled = true;
    p.pdf.classList.add("is-cargando");
    p.pdf.textContent = "Preparando el PDF…";
    try {
      await abrirPdfFn({ pedirPdfFn: () => pedirPdfFn({ ...actual.hoja, centro }) });
      mensaje("PDF listo: imprímelo desde la pestaña que se ha abierto.");
    } catch (err) {
      mensaje(err?.message || "No se pudo generar el PDF.", true);
    } finally {
      p.pdf.disabled = false;
      p.pdf.classList.remove("is-cargando");
      p.pdf.textContent = "PDF para imprimir";
    }
  }

  function esqueleto(raiz) {
    const cab = el(doc, "div", "rc-head");
    const tit = el(doc, "div");
    p.titulo = el(doc, "h1", "rc-h1", "Hoja de ejercicios");
    tit.append(el(doc, "div", "rc-crumb", "Recursos · Hojas de ejercicios"), p.titulo);
    p.pdf = boton(doc, "PDF para imprimir", { clase: "rc-btn--pri", onClick: () => imprimir() });
    p.pdf.disabled = true;
    cab.append(tit, el(doc, "span", "rc-sp"), p.pdf);

    p.msg = el(doc, "p", "rc-msg");
    p.msg.setAttribute("role", "status");

    const cuerpo = el(doc, "div", "rc-cuerpo");
    p.lista = el(doc, "div", "rc-card rc-lista");
    const previa = el(doc, "div", "rc-previa");
    const cabPrevia = el(doc, "div", "rc-previa__cab");
    const ampliar = boton(doc, "Ampliar", { clase: "rc-btn--sm rc-btn--gh" });
    ampliar.addEventListener("click", () => {
      const grande = cuerpo.classList.toggle("rc-cuerpo--grande");
      ampliar.textContent = grande ? "Reducir" : "Ampliar";
    });
    cabPrevia.append(el(doc, "div", "rc-crumb", "Folio A4 · vista previa"), el(doc, "span", "rc-sp"), ampliar);
    p.visor = createVisorFn({ doc, clase: "rc-folio", onActividad: (orden) => abrirCambio(orden) });
    const folio = el(doc, "div", "rc-previa__folio");
    folio.appendChild(p.visor.el);
    previa.append(cabPrevia, folio, el(doc, "div", "rc-foot", "A4 · blanco y negro · pulsa un ejercicio para cambiarlo"));
    cuerpo.append(p.lista, previa);

    raiz.replaceChildren(cab, p.barra.el, p.msg, cuerpo);
  }

  async function render(raiz) {
    raiz.replaceChildren(el(doc, "p", "rc-msg", "Cargando el generador…"));
    try {
      catalogo = catalogo || await api.catalogo();
    } catch (err) {
      raiz.replaceChildren(el(doc, "p", "rc-msg rc-msg--error", err?.message || "No se pudo cargar el generador."));
      return;
    }
    if (!catalogo.temas?.length) {
      raiz.replaceChildren(el(doc, "p", "rc-msg", "Todavía no hay temas con hojas de ejercicios."));
      return;
    }
    eleccion = { ...eleccion, temaId: eleccion.temaId || catalogo.temas[0].id };
    if (!objetivoDe(eleccion)) eleccion.objetivo = temaDe(eleccion.temaId).objetivos[0].numero;
    p.barra = buildBarraDeContexto({
      catalogo, inicial: eleccion, doc,
      onCambio: (e) => montar(e),
      onVolverAMontar: (e) => montar(e),
    });
    esqueleto(raiz);
    await montar(eleccion);
  }

  return { render, get estado() { return { eleccion, actual, cambiando }; } };
}
