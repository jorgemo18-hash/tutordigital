import { fetchRecibos, fetchRecibo, generarRecibos, updateRecibo, enviarRecibo, enviarTodosRecibos } from "../api.js";
import { buildFamiliasLista } from "./envioFamilias/familiasLista.js";
import { buildReciboPreview } from "./envioFamilias/reciboPreview.js";
import { buildReciboEditor } from "./envioFamilias/reciboEditor.js";

function mesAnterior() {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

function buildSelectorMes(mes, anio, onChange) {
  const input = document.createElement("input");
  input.type = "month";
  input.className = "ac-input ef-selector-mes";
  input.value = `${anio}-${String(mes).padStart(2, "0")}`;
  input.addEventListener("change", () => {
    const [a, m] = input.value.split("-").map(Number);
    if (a && m) onChange({ mes: m, anio: a });
  });
  return input;
}

function buildBtn(texto, claseExtra) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${claseExtra}`;
  btn.textContent = texto;
  return btn;
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
  let { mes, anio } = mesAnterior();
  let familias = [];
  let familiaSeleccionadaId = null;
  let listaEl = null;
  let panelDerechoEl = null;
  let bannerSlotEl = null;

  function renderLista() {
    listaEl.innerHTML = "";
    listaEl.appendChild(buildFamiliasLista(familias, { selectedId: familiaSeleccionadaId, onSelect: seleccionarFamilia }));
  }

  async function cargarLista() {
    listaEl.innerHTML = "";
    listaEl.appendChild(buildPanelMensaje("Cargando…", "ac-loading"));
    try {
      familias = await fetchRecibos({ mes, anio });
    } catch (err) {
      listaEl.innerHTML = "";
      listaEl.appendChild(buildPanelMensaje(err.message || "No se pudieron cargar las familias.", "ac-error"));
      return;
    }
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
      })
    );
    panelDerechoEl.appendChild(
      buildReciboPreview(recibo, {
        nombreAcademia: config.nombre_emisor || tenantNombre,
        textoExencionIva: config.texto_exencion_iva,
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

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Envío a familias";
    head.appendChild(title);

    const acciones = document.createElement("div");
    acciones.className = "ef-head-acciones";

    acciones.appendChild(
      buildSelectorMes(mes, anio, ({ mes: m, anio: a }) => {
        mes = m;
        anio = a;
        familiaSeleccionadaId = null;
        cargarLista();
      })
    );

    const generarBtn = buildBtn("Generar recibos", "ghost");
    generarBtn.addEventListener("click", async () => {
      generarBtn.disabled = true;
      try {
        await generarRecibos({ mes, anio });
        await cargarLista();
      } finally {
        generarBtn.disabled = false;
      }
    });
    acciones.appendChild(generarBtn);

    const enviarTodosBtn = buildBtn("Enviar todos", "primary");
    enviarTodosBtn.addEventListener("click", async () => {
      enviarTodosBtn.disabled = true;
      try {
        const resultado = await enviarTodosRecibos({ mes, anio });
        bannerSlotEl.innerHTML = "";
        bannerSlotEl.appendChild(buildResultadoEnvioTodos(resultado));
        await cargarLista();
      } finally {
        enviarTodosBtn.disabled = false;
      }
    });
    acciones.appendChild(enviarTodosBtn);

    head.appendChild(acciones);
    container.appendChild(head);

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

    cargarLista();
  }

  return { render };
}
