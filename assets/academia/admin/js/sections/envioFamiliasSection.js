import {
  fetchRecibos, fetchRecibo, generarRecibos, generarReciboFamilia, regenerarRecibos, regenerarRecibo, regenerarInformes,
  updateRecibo, enviarFamilia, enviarInforme, generarInforme, editarComentarioInforme,
  fetchInformePreview, fetchMesesEnviados, fetchTextosLegales,
} from "../api.js";
import { buildCabecera } from "./envioFamilias/cabecera.js";
import { buildFamiliasLista } from "./envioFamilias/familiasLista.js";
import { buildPanelDerecho } from "./envioFamilias/panelDerecho.js";
import { calcularEstadoFamilia, familiaPendienteParaTipo } from "./envioFamilias/estadoFamilia.js";
import { regenerarLote } from "./envioFamilias/acciones/accionesLote.js";
import { buildResultadoEnvioTodos, clasificarEnvio } from "./envioFamilias/resultadoEnvio.js";
import { buildAvisoSinPrecio } from "./envioFamilias/alumnosSinPrecio.js";
import { buildAvisoSinEmail } from "./envioFamilias/familiasSinEmail.js";

const API = {
  fetchRecibo, updateRecibo, enviarFamilia, regenerarRecibo, generarReciboFamilia,
  fetchTextosLegales, enviarInforme, generarInforme, editarComentarioInforme, fetchInformePreview,
};

function periodoActual() {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

function buildPanelMensaje(texto, claseExtra = "ac-empty") {
  const p = document.createElement("p");
  p.className = claseExtra;
  p.textContent = texto;
  return p;
}

// `config`/`tenantNombre`: ya cargados una vez en academiaAdmin.js — se
// pasan explícitos en vez de volver a pedirlos aquí.
export function createEnvioFamiliasSection({ config = {}, tenantNombre = "" } = {}) {
  let { mes, anio } = periodoActual();
  const anioActualSistema = anio;
  const branding = { nombreAcademia: config.nombre_emisor || tenantNombre, emailEmisor: config.email_emisor, logoUrl: config.logo_url };
  let mesesEnviados = [];
  let familias = [];
  let familiaSeleccionadaId = null;
  const familiasConError = new Set();
  let headSlotEl = null;
  let listaEl = null;
  let avisoSlotEl = null;
  let bannerSlotEl = null;
  const panelDerecho = buildPanelDerecho();

  // Aviso de alumnos activos sin precio (ver alumnosSinPrecio.js). Va en su
  // propio slot y NO en bannerSlotEl, que es del resultado del último envío:
  // uno describe el estado de los datos y dura mientras dure el problema, el
  // otro cuenta qué acaba de pasar. Compartir slot haría que enviar borrara
  // el aviso justo cuando ya se ha cobrado mal.
  // Dos avisos distintos y los dos del mismo tipo ("mira esto antes de
  // pulsar Generar"): sin precio → el recibo saldría a 0 €; sin email → el
  // recibo sale bien pero no se puede enviar. Pueden salir a la vez y no se
  // resumen en uno: son dos problemas con dos arreglos distintos.
  function renderAviso() {
    avisoSlotEl.innerHTML = "";
    for (const aviso of [buildAvisoSinPrecio(familias), buildAvisoSinEmail(familias)]) {
      if (aviso) avisoSlotEl.appendChild(aviso);
    }
  }

  // Se recalcula aquí, y no en cada uno de los tres sitios que recargan
  // familias, porque renderLista es lo único que se ejecuta siempre que
  // `familias` cambia: así no hay forma de añadir una recarga nueva y
  // olvidarse del aviso.
  function renderLista() {
    listaEl.innerHTML = "";
    listaEl.appendChild(buildFamiliasLista(familias, { selectedId: familiaSeleccionadaId, onSelect: seleccionarFamilia, familiasConError }));
    renderAviso();
  }

  function renderCabecera() {
    headSlotEl.innerHTML = "";
    headSlotEl.appendChild(
      buildCabecera({
        mes,
        anio,
        mesesEnviados,
        anioActualSistema,
        // Pendientes O con error: si falla el lote entero (microservicio de
        // PDF dormido, corte de red), todas pasan a "error" y ninguna queda
        // "pendiente" — el botón se deshabilitaba solo y no había forma
        // evidente de reintentar salvo cambiar de mes y volver.
        hayPendientes: familias.some((f) => {
          const tipo = calcularEstadoFamilia(f, { tieneError: familiasConError.has(f.familia_id) }).tipo;
          return tipo === "pendiente" || tipo === "error";
        }),
        onCambiarPeriodo: ({ mes: m, anio: a }) => {
          mes = m;
          anio = a;
          familiaSeleccionadaId = null;
          familiasConError.clear();
          cargarLista();
        },
        // finally (no un await secuencial) garantiza el refresco aunque
        // regenerar falle a medias — la lista debe reflejar el estado real
        // del servidor tras CUALQUIER intento, no solo los que terminan
        // sin lanzar. El resultado se devuelve (no se descarta) para que
        // el botón pueda mostrar cuántos fallaron, si alguno lo hizo — ver
        // textoOkLote en cabecera.js.
        onRegenerar: async (tipo) => {
          try {
            return await regenerarLote(tipo, {
              mes, anio, hayRecibosEnPeriodo: familias.some((f) => f.recibo),
              regenerarRecibosFn: regenerarRecibos, generarRecibosFn: generarRecibos, regenerarInformesFn: regenerarInformes,
            });
          } finally {
            await cargarLista();
          }
        },
        onEnviar: enviarATodos,
      })
    );
  }

  async function cargarLista() {
    listaEl.innerHTML = "";
    listaEl.appendChild(buildPanelMensaje("Cargando…", "ac-loading"));
    try {
      [familias, mesesEnviados] = await Promise.all([fetchRecibos({ mes, anio }), fetchMesesEnviados(anio)]);
    } catch (err) {
      listaEl.innerHTML = "";
      listaEl.appendChild(buildPanelMensaje(err.message || "No se pudieron cargar las familias.", "ac-error"));
      return;
    }
    renderCabecera();
    renderLista();
    const item = familias.find((f) => f.familia_id === familiaSeleccionadaId);
    if (item) mostrarEnPanel(item);
    else panelDerecho.limpiar(buildPanelMensaje("Selecciona una familia de la lista."));
  }

  // Refresca solo los datos y la lista (puntos de estado) tras una acción
  // dentro del panel derecho (generar/editar/enviar un informe o un
  // recibo) — a propósito NO toca panelDerecho, para no perder el estado
  // de las tabs/cards mientras el admin sigue trabajando ahí.
  async function refrescarListaSinTocarPanel() {
    try {
      [familias, mesesEnviados] = await Promise.all([fetchRecibos({ mes, anio }), fetchMesesEnviados(anio)]);
    } catch {
      return;
    }
    renderCabecera();
    renderLista();
  }

  // A diferencia de refrescarListaSinTocarPanel, SÍ actualiza el panel
  // derecho — una acción de familia (Regenerar/Enviar, ver
  // acciones/accionesFamiliaBoton.js) puede cambiar justo lo que se está
  // viendo ahí (el recibo, un informe). `actualizar` (no `mostrar`)
  // conserva la tab activa, para no sacar al admin de donde estaba.
  async function refrescarListaYPanel() {
    try {
      [familias, mesesEnviados] = await Promise.all([fetchRecibos({ mes, anio }), fetchMesesEnviados(anio)]);
    } catch {
      return;
    }
    renderCabecera();
    renderLista();
    const item = familias.find((f) => f.familia_id === familiaSeleccionadaId);
    if (item) panelDerecho.actualizar(item, { mes, anio, api: API, branding, onCambio: refrescarListaSinTocarPanel, onAccionFamilia: refrescarListaYPanel });
  }

  function mostrarEnPanel(item) {
    panelDerecho.mostrar(item, { mes, anio, api: API, branding, onCambio: refrescarListaSinTocarPanel, onAccionFamilia: refrescarListaYPanel });
  }

  function seleccionarFamilia(item) {
    familiaSeleccionadaId = item.familia_id;
    renderLista();
    mostrarEnPanel(item);
  }

  // Envía, con el tipo elegido en el diálogo de "Enviar todos" (ver
  // cabecera.js), cada familia que tenga algo pendiente PARA ESE TIPO —
  // un único email por familia (ver enviarReciboYInformesDeFamilia), no
  // uno por documento. Secuencial a propósito, para no saturar el
  // microservicio de PDF/Claude con envíos en paralelo. Cada fallo se
  // marca en familiasConError (transitorio, solo esta sesión del
  // navegador) para que la lista muestre el punto rojo sin necesidad de
  // una columna nueva en BD.
  async function enviarATodos(tipo) {
    const candidatas = familias.filter((f) => familiaPendienteParaTipo(f, tipo));
    let enviadas = 0;
    const parciales = [];
    const errores = [];
    for (const item of candidatas) {
      try {
        const respuesta = await enviarFamilia({ familia_id: item.familia_id, mes, anio, tipo, confirmar: false });
        // El email salió, pero puede haber salido incompleto: un PDF que
        // falla no aborta el envío (ver enviarFamiliaEmail.js). Esas
        // familias se marcan igualmente con el punto rojo de la lista —
        // hay algo que revisar, aunque no sea un fallo de envío.
        const { completo, faltas } = clasificarEnvio(tipo, respuesta);
        if (completo) {
          familiasConError.delete(item.familia_id);
          enviadas += 1;
        } else {
          familiasConError.add(item.familia_id);
          parciales.push({ familia_nombre: item.familia_nombre, faltas });
        }
      } catch (err) {
        familiasConError.add(item.familia_id);
        errores.push({ familia_nombre: item.familia_nombre, motivo: err.message || "No se pudo enviar." });
      }
    }
    bannerSlotEl.innerHTML = "";
    bannerSlotEl.appendChild(buildResultadoEnvioTodos({ enviadas, parciales, errores }));
    await refrescarListaSinTocarPanel();
  }

  function render(container) {
    container.innerHTML = "";

    headSlotEl = document.createElement("div");
    container.appendChild(headSlotEl);

    avisoSlotEl = document.createElement("div");
    container.appendChild(avisoSlotEl);

    bannerSlotEl = document.createElement("div");
    container.appendChild(bannerSlotEl);

    const body = document.createElement("div");
    body.className = "ef-layout";
    listaEl = document.createElement("div");
    listaEl.className = "ef-panel-izq";
    const panelDerechoWrap = document.createElement("div");
    panelDerechoWrap.className = "ef-panel-der";
    panelDerechoWrap.appendChild(panelDerecho.wrap);
    body.append(listaEl, panelDerechoWrap);
    container.appendChild(body);

    renderCabecera();
    cargarLista();
  }

  return { render };
}
