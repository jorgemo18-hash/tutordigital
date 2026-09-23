import {
  fetchCatalogoEjercicios, generarHojaEjercicios, generarActividadEjercicios, interpretarPedidoEjercicios,
  pedirPdfDeLaHoja,
} from "../apiEjercicios.js";
import { abrirPdf } from "../../../../shared/generador/abrirPdf.js";
import { buildPedidoEnPalabras } from "./ejercicios/pedidoEnPalabras.js";
import { buildControles } from "./ejercicios/controles.js";
import { createVisorDeHoja } from "../../../../shared/generador/visorDeHoja.js";
import { buildEditorDeEjercicio } from "./ejercicios/editorDeEjercicio.js";
import { reemplazaActividad, quitaActividad } from "../../../../shared/generador/hojaEditable.js";

// LA SECCIÓN "EJERCICIOS": el generador de hojas como un servicio más de la
// academia. Jorge, el 23/9: *"ponlo también en academias, que es un servicio
// más... lo usen o no, y así lo usaré yo para testearlo en la academia"*.
//
// Fase 1 (23/9): curso, materia y tema; y cambiar un ejercicio suelto —otro
// parecido, uno en concreto, o quitarlo— sin rehacer la hoja.
// Fase 2 (23/9): pedirlo con palabras, escrito o dictado
// (ejercicios/pedidoEnPalabras.js). La IA solo elige del catálogo.
//
// Lo que NO hace está dicho en la ruta (academia.hojas-ejercicios.routes.js):
// la hoja no se guarda, así que el pie sale sin código.
//
// Deps inyectables para test, mismo patrón que el resto de secciones.
export function createEjerciciosSection({
  fetchCatalogoFn = fetchCatalogoEjercicios,
  generarFn = generarHojaEjercicios,
  generarActividadFn = generarActividadEjercicios,
  interpretarFn = interpretarPedidoEjercicios,
  // Imprimir = pedir el PDF y abrirlo (ver api/hoja-pdf.js).
  pedirPdfFn = pedirPdfDeLaHoja,
  abrirPdfFn = abrirPdf,
  createVisorFn = createVisorDeHoja,
  centro = "",
} = {}) {
  let catalogo = null;
  // Lo último elegido se conserva al salir y volver a la sección.
  // `baterias`: tipos concretos pedidos en palabras. Cualquier cambio en los
  // controles los olvida; "Otra versión" los conserva.
  let eleccion = { temaId: null, objetivo: 1, intensidad: "normal", actividades: null, baterias: null };
  // La hoja en pantalla y qué batería hay en cada hueco (ver hojaEditable.js).
  let actual = null;
  let elegida = null;
  let peticion = 0;

  const temaDe = (id) => catalogo.temas.find((t) => t.id === id) || catalogo.temas[0];
  const objetivoDe = (e) => temaDe(e.temaId).objetivos.find((o) => o.numero === e.objetivo);
  // Los títulos de bloque del tema de la hoja, para recalcularlos al retocar.
  const tituloDe = (numero) => temaDe(eleccion.temaId).objetivos.find((o) => o.numero === numero)?.titulo;

  function mensaje(partes, texto, error = false) {
    partes.msgEl.textContent = texto;
    partes.msgEl.className = error ? "ej-msg ac-field-hint--error" : "ej-msg";
  }

  function pintar(partes) {
    partes.visor.pintar({ ...actual.hoja, centro });
  }

  function cerrarEditor(partes) {
    elegida = null;
    partes.visor.elegir(null);
    partes.editor.ocultar();
    partes.pedido?.refrescar();
  }

  async function generar(partes, nuevaEleccion, { explicacion = "" } = {}) {
    eleccion = {
      ...eleccion,
      ...nuevaEleccion,
      actividades: nuevaEleccion.actividades || null,
      baterias: nuevaEleccion.baterias || null,
    };
    cerrarEditor(partes);
    // Si llegan dos respuestas, solo cuenta la última pedida.
    peticion += 1;
    const esta = peticion;
    mensaje(partes, "Generando la hoja…");
    partes.controles.setOcupado(true);
    try {
      const { hoja, huecos } = await generarFn(eleccion);
      if (esta !== peticion) return;
      actual = { hoja, huecos: huecos || [] };
      pintar(partes);
      mensaje(partes, explicacion
        ? `${explicacion} Pulsa un ejercicio para cambiarlo o quitarlo.`
        : "Pulsa un ejercicio de la hoja para cambiarlo o quitarlo.");
    } catch (err) {
      if (esta !== peticion) return;
      mensaje(partes, err?.message || "No se pudo generar la hoja.", true);
    } finally {
      if (esta === peticion) partes.controles.setOcupado(false);
    }
  }

  function abrirEditor(partes, orden) {
    if (!actual) return;
    const hueco = actual.huecos[orden - 1];
    if (!hueco) return;
    elegida = orden;
    partes.visor.elegir(orden);
    // "Cambiar por" ofrece las baterías del objetivo de ESE ejercicio (uno de
    // repaso se cambia por otro de su objetivo, no del de la hoja).
    const baterias = temaDe(eleccion.temaId).objetivos.find((o) => o.numero === hueco.objetivo)?.baterias || [];
    partes.editor.mostrar({
      numero: orden,
      nombre: baterias.find((b) => b.clave === hueco.clave)?.nombre || "",
      baterias,
      actual: hueco.clave,
      puedeQuitar: actual.huecos.length > 1,
    });
    partes.pedido?.refrescar();
  }

  async function cambiar(partes, clave, explicacion = "") {
    if (!elegida) return;
    const indice = elegida - 1;
    const hueco = actual.huecos[indice];
    partes.editor.setOcupado(true);
    mensaje(partes, "Generando el ejercicio…");
    try {
      const nuevo = await generarActividadFn({
        temaId: eleccion.temaId, objetivo: hueco.objetivo, intensidad: eleccion.intensidad, clave: clave || hueco.clave,
      });
      actual = reemplazaActividad(actual, indice, nuevo, tituloDe);
      pintar(partes);
      abrirEditor(partes, elegida);
      mensaje(partes, explicacion ? `${explicacion} (ejercicio ${elegida})` : `Ejercicio ${elegida} cambiado.`);
    } catch (err) {
      mensaje(partes, err?.message || "No se pudo cambiar el ejercicio.", true);
    } finally {
      partes.editor.setOcupado(false);
    }
  }

  function quitar(partes) {
    if (!elegida) return;
    const numero = elegida;
    actual = quitaActividad(actual, numero - 1, tituloDe);
    cerrarEditor(partes);
    pintar(partes);
    mensaje(partes, `Ejercicio ${numero} quitado; los demás se renumeran.`);
  }

  // IMPRIMIR ES UN PDF, no el diálogo de imprimir del navegador: cada
  // navegador deja un alto de papel distinto y las hojas salían con páginas
  // de más (ver server/lib/hojaPdf/imprimeHojaEnPdf.js).
  async function imprimir(partes) {
    if (!actual) return;
    mensaje(partes, "Preparando el PDF…");
    partes.controles.setOcupado(true);
    try {
      await abrirPdfFn({ pedirPdfFn: () => pedirPdfFn({ ...actual.hoja, centro }) });
      mensaje(partes, "PDF listo: imprímelo desde la pestaña que se ha abierto.");
    } catch (err) {
      mensaje(partes, err?.message || "No se pudo generar el PDF.", true);
    } finally {
      partes.controles.setOcupado(false);
    }
  }

  async function render(mainShell) {
    mainShell.innerHTML = "";
    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Ejercicios";
    head.appendChild(title);

    const body = document.createElement("div");
    body.className = "ej-seccion";
    const msgEl = document.createElement("p");
    msgEl.className = "ej-msg";
    mainShell.append(head, body);

    try {
      catalogo = catalogo || await fetchCatalogoFn();
    } catch (err) {
      msgEl.textContent = err?.message || "No se pudo cargar el generador.";
      msgEl.className = "ej-msg ac-field-hint--error";
      body.appendChild(msgEl);
      return;
    }
    eleccion = { ...eleccion, temaId: eleccion.temaId || catalogo.temas[0].id };
    if (!objetivoDe(eleccion)) eleccion.objetivo = temaDe(eleccion.temaId).objetivos[0].numero;

    const partes = { msgEl };
    partes.visor = createVisorFn({ onActividad: (orden) => abrirEditor(partes, orden) });
    partes.editor = buildEditorDeEjercicio({
      onOtroParecido: () => cambiar(partes, null),
      onCambiarPor: (clave) => cambiar(partes, clave),
      onQuitar: () => quitar(partes),
      onCerrar: () => cerrarEditor(partes),
    });
    partes.controles = buildControles({
      catalogo,
      inicial: eleccion,
      onCambio: (e) => generar(partes, e),
      onOtraVersion: (e) => generar(partes, { ...e, baterias: eleccion.baterias }),
      onImprimir: () => imprimir(partes),
    });

    partes.pedido = buildPedidoEnPalabras({
      interpretarFn,
      // Lo que hay en pantalla, y el ejercicio elegido si lo hay: con él,
      // lo que se pide es un cambio de ESE ejercicio.
      getContexto: () => {
        const contexto = { temaId: eleccion.temaId, objetivo: eleccion.objetivo, intensidad: eleccion.intensidad };
        const hueco = elegida && actual?.huecos[elegida - 1];
        if (hueco) contexto.ejercicio = { orden: elegida, objetivo: hueco.objetivo, clave: hueco.clave };
        return contexto;
      },
      onHoja: (plan, explicacion) => {
        partes.controles.aplicar(plan);
        generar(partes, plan, { explicacion });
      },
      onEjercicio: (clave, explicacion) => cambiar(partes, clave, explicacion),
    });

    body.append(partes.pedido.el, partes.controles.el, msgEl, partes.editor.el, partes.visor.el);
    await generar(partes, eleccion);
  }

  return { render };
}
