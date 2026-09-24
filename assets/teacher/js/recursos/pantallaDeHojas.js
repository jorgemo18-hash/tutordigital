import { crearApiDeRecursos } from "./apiRecursos.js";
import { pedirPdfDeLaHoja } from "../../../shared/generador/apiDeHojas.js";
import { abrirPdf } from "../../../shared/generador/abrirPdf.js";
import { createVisorDeHoja } from "../../../shared/generador/visorDeHoja.js";
import { reemplazaActividad, quitaActividad, mueveActividad, anadeActividad } from "../../../shared/generador/hojaEditable.js";
import { MAX_ACTIVIDADES } from "../../../shared/hoja/js/actividades.js";
import { resumenDeActividad } from "../../../shared/generador/resumenDeActividad.js";
import { buildBarraDeContexto } from "./barraDeContexto.js";
import { pintarListaDeHuecos } from "./listaDeHuecos.js";
import { abrirDialogoCambiar } from "./dialogoCambiar.js";
import { el } from "./elementos.js";
import { construirEsqueleto } from "./esqueletoDeLaPantalla.js";
import { bateriasAnadibles as anadiblesDe, claveAlAzar as claveAlAzarDe } from "./anadibles.js";
import { textoDelAviso } from "./avisoDeAsignatura.js";
import { crearGuardado } from "./guardadoDeLaHoja.js";
import { crearDeberesDeLaPantalla } from "./deberes/deberesDeLaPantalla.js";
import { crearListaDeRecientes } from "./hojasRecientes.js";

// RECURSOS → HOJAS DE EJERCICIOS, en el panel del profesor de instituto.
// Diseño de Claude Design (23/9): a la izquierda los ejercicios de la hoja,
// cada uno con Cambiar y Quitar; a la derecha el folio tal como se imprime.
//
// Es el mismo generador que la sección "Ejercicios" de la academia (mismas
// rutas, misma vista previa, mismo PDF); cambia la pantalla.
//
// La misma pantalla sirve al panel móvil (`movil: true`): cambia la
// estructura (esqueletoDeLaPantalla.js) y el CSS, no la lógica.
//
// "Poner como deberes" (paso 3) vive en deberes/. Lo que AÚN NO hace (pasos
// 4 y 5, ver claude/diseno-recursos-instituto.md): corregirla, y montarla
// para un alumno con lo que sabemos de él.
//
// Deps inyectables para test.
export function createPantallaDeHojas({
  api = crearApiDeRecursos(),
  pedirPdfFn = pedirPdfDeLaHoja,
  abrirPdfFn = abrirPdf,
  createVisorFn = createVisorDeHoja,
  abrirDialogoFn = abrirDialogoCambiar,
  centro = "",
  // La asignatura que tiene elegida el profesor arriba (ver avisoDeAsignatura.js).
  getAsignatura = () => "",
  // Los grupos del profesor y el que tiene elegido (para "Poner como deberes").
  getGrupos = () => [],
  getGrupoActivo = () => null,
  onTareaCreada = () => {},
  crearDeberesFn = crearDeberesDeLaPantalla,
  movil = false,
  doc = document,
} = {}) {
  let catalogo = null;
  let eleccion = { temaId: null, objetivo: 1, intensidad: "normal", actividades: null, todoElTema: false };
  let actual = null; // { hoja, huecos } (ver hojaEditable.js)
  let cambiando = null;
  let dialogo = null;
  let peticion = 0;
  let p = {}; // las partes de la pantalla, una vez montada
  const guardado = crearGuardado({ api });
  const recientes = crearListaDeRecientes({
    api, doc,
    onAbrir: (id) => abrirGuardada(id),
    abierta: () => (guardado.codigoVigente(actual) ? guardado.id : null),
  });

  const deberes = crearDeberesFn({
    api, guardado, centro, pedirPdfFn, getGrupos, getGrupoActivo, getAsignatura, doc,
    getActual: () => actual,
    parametros: () => parametros(),
    getTituloDeLaHoja: () => p.titulo?.textContent || "Hoja de ejercicios",
    onGuardada: () => { recientes.cargar(); pintar(); },
    onHecho: (tarea) => onTareaCreada(tarea),
    mensaje: (t, error) => mensaje(t, error),
  });

  const temaDe = (id) => catalogo.temas.find((t) => t.id === id) || catalogo.temas[0];
  const objetivoDe = (e) => temaDe(e.temaId).objetivos.find((o) => o.numero === e.objetivo);
  const tituloDe = (numero) => temaDe(eleccion.temaId).objetivos.find((o) => o.numero === numero)?.titulo;

  function revisarAsignatura() {
    if (!p.aviso || !catalogo) return;
    const texto = textoDelAviso({ asignatura: getAsignatura(), catalogo });
    p.aviso.textContent = texto || "";
    p.aviso.hidden = !texto;
  }

  function mensaje(texto, error = false) {
    p.msg.textContent = texto || "";
    p.msg.className = error ? "rc-msg rc-msg--error" : "rc-msg";
  }

  function pintar({ enfocar = null } = {}) {
    p.titulo.textContent = eleccion.todoElTema
      ? `Todo el tema: ${temaDe(eleccion.temaId).nombre}`
      : objetivoDe(eleccion)?.titulo || "Hoja de ejercicios";
    pintarListaDeHuecos({
      contenedor: p.lista, hoja: actual.hoja, huecos: actual.huecos, cambiando, doc,
      maximo: MAX_ACTIVIDADES, enfocar,
      onCambiar: (orden) => abrirCambio(orden),
      onQuitar: (orden) => quitar(orden),
      onMover: (de, a, opciones) => mover(de, a, opciones),
      onAnadir: () => abrirAnadir(),
    });
    // El código solo aparece si la hoja en pantalla es la guardada tal cual.
    const codigo = guardado.codigoVigente(actual);
    p.visor.pintar({ ...actual.hoja, centro, codigo });
    p.visor.elegir(cambiando);
    p.pdf.disabled = false;
    if (p.deberes) p.deberes.disabled = false;
    p.codigo.textContent = codigo;
    p.codigo.hidden = !codigo;
    if (p.resumen) p.resumen.textContent = resumenDeLaEleccion();
    recientes.pintar();
  }

  // En móvil, lo que dice la barra plegada: qué hoja es.
  function resumenDeLaEleccion() {
    const tema = temaDe(eleccion.temaId);
    const que = eleccion.todoElTema ? "Todo el tema" : `Objetivo ${eleccion.objetivo}`;
    const intensidad = { repaso: "Repaso", normal: "Normal", refuerzo: "Refuerzo" }[eleccion.intensidad] || "";
    return [tema.curso, tema.materia, que, intensidad].filter(Boolean).join(" · ");
  }

  const parametros = () => ({
    temaId: eleccion.temaId, objetivo: eleccion.objetivo, intensidad: eleccion.intensidad,
    ...(eleccion.todoElTema ? { todoElTema: true } : {}),
  });

  // Abrir una hoja reciente: el generador se pone como se pidió y la hoja,
  // tal como se imprimió (con sus retoques). Si no se toca, mismo código.
  async function abrirGuardada(id) {
    cerrarCambio();
    mensaje("Abriendo la hoja…");
    try {
      const g = await api.abrir(id);
      const { codigo, centro: _centro, ...hoja } = g.contenido || {};
      eleccion = { ...eleccion, ...(g.parametros || {}), actividades: null, todoElTema: Boolean(g.parametros?.todoElTema) };
      p.barra.fijar(eleccion);
      actual = { hoja, huecos: g.huecos || [] };
      guardado.abierta({ id: g.id, codigo: g.codigo }, actual);
      pintar();
      mensaje(`Hoja ${g.codigo} abierta. Si no la cambias, se imprime con el mismo código.`);
    } catch (err) {
      mensaje(err?.message || "No se pudo abrir la hoja.", true);
    }
  }

  async function montar(nueva) {
    eleccion = { ...eleccion, ...nueva };
    cerrarCambio();
    peticion += 1;
    const esta = peticion;
    mensaje("Montando la hoja…");
    p.barra.setOcupado(true);
    p.pdf.disabled = true;
    if (p.deberes) p.deberes.disabled = true;
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
  // `orden` null: el pedido es para AÑADIR uno al final.
  async function pedido(orden, conversacion) {
    const hueco = orden ? actual.huecos[orden - 1] : null;
    const contexto = { temaId: eleccion.temaId, objetivo: eleccion.objetivo, intensidad: eleccion.intensidad };
    if (hueco) contexto.ejercicio = { orden, objetivo: hueco.objetivo, clave: hueco.clave };
    else contexto.nuevo = { objetivo: eleccion.objetivo };
    let r;
    try {
      r = await api.interpretar({ conversacion, contexto });
    } catch (err) {
      return { aviso: err?.message || "No se pudo interpretar el pedido." };
    }
    if (r.accion === "ejercicio") {
      if (hueco) await cambiar(orden, r.clave);
      else await anadir(r.clave);
      return { hecho: true };
    }
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

  // Ver anadibles.js. Al azar: del objetivo (o de todo el tema).
  const bateriasAnadibles = () => anadiblesDe(temaDe(eleccion.temaId), eleccion.objetivo);
  const claveAlAzar = () => claveAlAzarDe({
    huecos: actual.huecos,
    candidatas: eleccion.todoElTema ? bateriasAnadibles() : objetivoDe(eleccion)?.baterias || [],
  });

  async function anadir(clave) {
    const bateria = bateriasAnadibles().find((b) => b.clave === clave);
    if (!bateria) return;
    dialogo?.setOcupado(true);
    try {
      const nuevo = await api.actividad({
        temaId: eleccion.temaId, objetivo: bateria.objetivo, intensidad: eleccion.intensidad, clave,
      });
      actual = anadeActividad(actual, nuevo, tituloDe, MAX_ACTIVIDADES);
      cerrarCambio();
      pintar();
      mensaje(`Ejercicio ${actual.huecos.length} añadido al final.`);
    } catch (err) {
      dialogo?.setOcupado(false);
      dialogo?.aviso(err?.message || "No se pudo añadir el ejercicio.");
    }
  }

  function abrirAnadir() {
    if (!actual || actual.huecos.length >= MAX_ACTIVIDADES) return;
    cerrarCambio();
    dialogo = abrirDialogoFn({
      modo: "anadir", orden: actual.huecos.length + 1, hueco: null, baterias: bateriasAnadibles(), doc,
      resumen: "Va al final de la hoja; luego puedes moverlo.",
      onAzar: () => anadir(claveAlAzar()),
      onClave: (clave) => anadir(clave),
      onPedido: (conversacion) => pedido(null, conversacion),
      onCerrar: () => { dialogo = null; },
    });
  }

  // `de` y `a` desde 0. Con el teclado, el asa sigue enfocada para poder
  // seguir moviendo.
  function mover(de, a, { teclado = false } = {}) {
    if (!actual) return;
    cerrarCambio();
    const antes = actual;
    actual = mueveActividad(actual, de, a, tituloDe);
    if (actual === antes) return;
    pintar({ enfocar: teclado ? a + 1 : null });
    mensaje(`Ejercicio ${de + 1} movido al puesto ${a + 1}.`);
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
      // Primero el código (guardándola si es nueva o ha cambiado): va en el
      // papel. La pestaña del PDF se abre dentro de abrirPdf, al pulsar.
      await abrirPdfFn({
        pedirPdfFn: async () => {
          const { codigo, nueva } = await guardado.asegurar(actual, { parametros: parametros(), centro });
          if (nueva) recientes.cargar();
          pintar();
          return pedirPdfFn({ ...actual.hoja, centro, codigo });
        },
      });
      mensaje(`PDF listo (${guardado.codigoVigente(actual)}): imprímelo desde la pestaña que se ha abierto.`);
    } catch (err) {
      mensaje(err?.message || "No se pudo generar el PDF.", true);
    } finally {
      p.pdf.disabled = false;
      p.pdf.classList.remove("is-cargando");
      p.pdf.textContent = "PDF para imprimir";
    }
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
    const cajaRecientes = el(doc, "div", "rc-card rc-lista rc-recientes-card");
    recientes.montar(cajaRecientes);
    const visor = createVisorFn({ doc, clase: "rc-folio", onActividad: (orden) => abrirCambio(orden) });
    raiz.classList?.toggle("rc--movil", movil);
    p = {
      barra: p.barra,
      visor,
      ...construirEsqueleto({
        doc, raiz, movil, barraEl: p.barra.el, visorEl: visor.el, recientesEl: cajaRecientes,
        onImprimir: () => imprimir(),
        onDeberes: () => deberes.abrir(),
      }),
    };
    revisarAsignatura();
    recientes.cargar();
    await montar(eleccion);
  }

  return { render, revisarAsignatura, get estado() { return { eleccion, actual, cambiando }; } };
}
