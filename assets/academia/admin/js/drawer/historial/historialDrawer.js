import { fetchHistorialRecibos, fetchRecibo, regenerarRecibo, enviarRecibo } from "../../api.js";
import { buildIcon } from "../../icons.js";
import { buildReciboPreview } from "../../sections/envioFamilias/reciboPreview.js";
import { buildHistorialLista } from "./historialLista.js";
import { buildHistorialAcciones } from "./historialAcciones.js";

function buildHead(titulo, onClose) {
  const head = document.createElement("div");
  head.className = "ac-drawer-head";
  const title = document.createElement("div");
  title.className = "ac-drawer-title";
  title.textContent = titulo;
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "ac-drawer-close";
  closeBtn.appendChild(buildIcon("close", { size: 14 }));
  closeBtn.addEventListener("click", onClose);
  head.append(title, closeBtn);
  return head;
}

function buildVolverBtn(onVolver) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ac-btn ghost sm";
  btn.style.marginBottom = "14px";
  btn.textContent = "← Volver al historial";
  btn.addEventListener("click", onVolver);
  return btn;
}

function renderMensaje(body, texto, claseExtra) {
  body.innerHTML = "";
  const p = document.createElement("p");
  p.className = claseExtra;
  p.textContent = texto;
  body.appendChild(p);
}

// Segundo drawer deslizante, apilado sobre el del alumno sin cubrirlo: su
// overlay (.ac-drawer-overlay--nested) solo oscurece el área a la
// izquierda del drawer de alumno (ver el `inset` en el CSS), así que ese
// drawer queda visible y operable detrás mientras este está abierto.
// Implementación de referencia para cualquier drawer con sub-niveles de
// navegación en el proyecto — ver docs/drawer-stacking.md.
export function createHistorialDrawer(root, { config = {} } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay ac-drawer-overlay--nested";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer ac-drawer-historial";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  let alumnoId = null;
  let alumnoNombre = "";
  let historial = [];
  let reciboSeleccionadoResumen = null;

  function close() {
    overlay.classList.remove("open");
  }

  function renderLista(body) {
    body.innerHTML = "";
    if (!historial.length) {
      const p = document.createElement("p");
      p.className = "ac-empty";
      p.textContent = "Sin recibos todavía.";
      body.appendChild(p);
      return;
    }
    body.appendChild(
      buildHistorialLista(historial, {
        onSeleccionar: (item) => {
          reciboSeleccionadoResumen = item;
          abrirDetalle(body);
        },
      })
    );
  }

  async function recargarHistorial() {
    try {
      historial = await fetchHistorialRecibos(alumnoId);
    } catch {
      historial = [];
    }
  }

  async function abrirDetalle(body) {
    renderMensaje(body, "Cargando recibo…", "ac-loading");

    let recibo;
    try {
      recibo = await fetchRecibo(reciboSeleccionadoResumen.id);
    } catch (err) {
      body.innerHTML = "";
      body.appendChild(buildVolverBtn(() => { reciboSeleccionadoResumen = null; renderLista(body); }));
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el recibo.";
      body.appendChild(p);
      return;
    }

    body.innerHTML = "";
    body.appendChild(buildVolverBtn(() => { reciboSeleccionadoResumen = null; renderLista(body); }));
    body.appendChild(
      buildHistorialAcciones(recibo, {
        onRegenerar: async () => {
          await regenerarRecibo(recibo.id);
          await recargarHistorial();
          const actualizado = historial.find((h) => h.mes === recibo.mes && h.anio === recibo.anio);
          if (actualizado) {
            reciboSeleccionadoResumen = actualizado;
            await abrirDetalle(body);
          } else {
            reciboSeleccionadoResumen = null;
            renderLista(body);
          }
        },
        onEnviar: async () => {
          await enviarRecibo(recibo.id);
          await recargarHistorial();
          await abrirDetalle(body);
        },
      })
    );
    body.appendChild(
      buildReciboPreview(recibo, {
        nombreAcademia: config.nombre_emisor || "",
        textoExencionIva: config.texto_exencion_iva,
        emailEmisor: config.email_emisor,
      })
    );
  }

  function render() {
    drawer.innerHTML = "";
    drawer.appendChild(buildHead(`Historial de recibos — ${alumnoNombre}`, close));
    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    drawer.appendChild(body);
    renderMensaje(body, "Cargando historial…", "ac-loading");
  }

  async function open({ id, nombre }) {
    alumnoId = id;
    alumnoNombre = nombre;
    reciboSeleccionadoResumen = null;
    historial = [];
    render();
    overlay.classList.add("open");
    await recargarHistorial();
    renderLista(drawer.querySelector(".ac-drawer-body"));
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  return { open, close };
}
