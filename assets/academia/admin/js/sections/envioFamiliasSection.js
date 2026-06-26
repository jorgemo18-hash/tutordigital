import {
  fetchRecibos, fetchRecibo, generarRecibos, regenerarRecibos, regenerarRecibo,
  updateRecibo, enviarRecibo, enviarTodosRecibos, fetchMesesEnviados,
} from "../api.js";
import { buildCabecera } from "./envioFamilias/cabecera.js";
import { buildFamiliasLista } from "./envioFamilias/familiasLista.js";
import { buildReciboPreview } from "./envioFamilias/reciboPreview.js";
import { buildReciboEditor } from "./envioFamilias/reciboEditor.js";

function periodoActual() {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

function buildResultadoEnvioTodos({ enviados, errores }) {
  const wrap = document.createElement("div");
  wrap.className = `ac-banner ${errores.length ? "amber" : "green"}`;
  wrap.style.flexDirection = "column";
  wrap.style.alignItems = "flex-start";
  wrap.style.cursor = "default";
  const resumen = document.createElement("div");
  resumen.textContent = `${enviados} recibo(s) enviado(s).`;
  wrap.appendChild(resumen);
  if (errores.length) {
    const lista = document.createElement("ul");
    lista.style.margin = "6px 0 0";
    lista.style.paddingLeft = "18px";
    for (const e of errores) {
      const li = document.createElement("li");
      li.textContent = `${e.familia_nombre}: ${e.motivo}`;
      lista.appendChild(li);
    }
    wrap.appendChild(lista);
  }
  return wrap;
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
  let mesesEnviados = [];
  let familias = [];
  let familiaSeleccionadaId = null;
  let headSlotEl = null;
  let listaEl = null;
  let panelDerechoEl = null;
  let bannerSlotEl = null;

  function renderLista() {
    listaEl.innerHTML = "";
    listaEl.appendChild(buildFamiliasLista(familias, { selectedId: familiaSeleccionadaId, onSelect: seleccionarFamilia }));
  }

  function renderCabecera() {
    headSlotEl.innerHTML = "";
    headSlotEl.appendChild(
      buildCabecera({
        mes,
        anio,
        mesesEnviados,
        anioActualSistema,
        hayRecibosEnPeriodo: familias.some((f) => f.recibo),
        onCambiarPeriodo: ({ mes: m, anio: a }) => {
          mes = m;
          anio = a;
          familiaSeleccionadaId = null;
          cargarLista();
        },
        // finally (no un await secuencial) garantiza el refresco aunque
        // generar/regenerar falle a medias — la lista debe reflejar el
        // estado real del servidor tras CUALQUIER intento, no solo los que
        // terminan sin lanzar.
        onGenerar: async () => {
          try {
            if (familias.some((f) => f.recibo)) await regenerarRecibos({ mes, anio });
            else await generarRecibos({ mes, anio });
          } finally {
            await cargarLista();
          }
        },
        onEnviarTodos: async () => {
          const resultado = await enviarTodosRecibos({ mes, anio });
          bannerSlotEl.innerHTML = "";
          bannerSlotEl.appendChild(buildResultadoEnvioTodos(resultado));
          await cargarLista();
        },
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
    renderPanelDerecho();
  }

  function renderPanelDerecho() {
    panelDerechoEl.innerHTML = "";
    const item = familias.find((f) => f.familia_id === familiaSeleccionadaId);
    if (!item) {
      panelDerechoEl.appendChild(buildPanelMensaje("Selecciona una familia de la lista."));
      return;
    }
    if (!item.recibo) {
      panelDerechoEl.appendChild(buildPanelMensaje("Esta familia no tiene recibo generado para este mes."));
      return;
    }
    cargarDetalle(item.recibo.id);
  }

  async function cargarDetalle(reciboId) {
    panelDerechoEl.appendChild(buildPanelMensaje("Cargando recibo…", "ac-loading"));
    let recibo;
    try {
      recibo = await fetchRecibo(reciboId);
    } catch (err) {
      panelDerechoEl.innerHTML = "";
      panelDerechoEl.appendChild(buildPanelMensaje(err.message || "No se pudo cargar el recibo.", "ac-error"));
      return;
    }
    panelDerechoEl.innerHTML = "";
    panelDerechoEl.appendChild(
      buildReciboEditor(recibo, {
        onGuardar: async (payload) => {
          await updateRecibo(recibo.id, payload);
          await cargarLista();
        },
        onEnviar: async () => {
          await enviarRecibo(recibo.id);
          await cargarLista();
        },
        onRegenerar: async () => {
          try {
            await regenerarRecibo(recibo.id);
          } finally {
            await cargarLista();
          }
        },
      })
    );
    panelDerechoEl.appendChild(
      buildReciboPreview(recibo, {
        nombreAcademia: config.nombre_emisor || tenantNombre,
        textoExencionIva: config.texto_exencion_iva,
        emailEmisor: config.email_emisor,
      })
    );
  }

  function seleccionarFamilia(item) {
    familiaSeleccionadaId = item.familia_id;
    renderLista();
    renderPanelDerecho();
  }

  function render(container) {
    container.innerHTML = "";

    headSlotEl = document.createElement("div");
    container.appendChild(headSlotEl);

    bannerSlotEl = document.createElement("div");
    container.appendChild(bannerSlotEl);

    const body = document.createElement("div");
    body.className = "ef-layout";
    listaEl = document.createElement("div");
    listaEl.className = "ef-panel-izq";
    panelDerechoEl = document.createElement("div");
    panelDerechoEl.className = "ef-panel-der";
    body.append(listaEl, panelDerechoEl);
    container.appendChild(body);

    renderCabecera();
    cargarLista();
  }

  return { render };
}
