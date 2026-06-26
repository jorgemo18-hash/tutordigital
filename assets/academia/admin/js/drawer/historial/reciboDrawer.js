import { fetchRecibo, regenerarRecibo, enviarRecibo } from "../../api.js";
import { buildIcon } from "../../icons.js";
import { buildReciboPreview } from "../../sections/envioFamilias/reciboPreview.js";
import { buildHistorialAcciones } from "./historialAcciones.js";

const MESES = [
  null, "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function capitaliza(str) {
  return str ? str[0].toUpperCase() + str.slice(1) : str;
}

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

function renderMensaje(body, texto, claseExtra) {
  body.innerHTML = "";
  const p = document.createElement("p");
  p.className = claseExtra;
  p.textContent = texto;
  body.appendChild(p);
}

// Tercer drawer deslizante, apilado sobre el de historial sin cubrirlo —
// mismo patrón que historialDrawer.js usa para apilarse sobre el de
// alumno (ver .ac-drawer-overlay--nested-2 en el CSS y
// docs/drawer-stacking.md). Muestra la preview de un recibo concreto del
// historial y sus acciones (regenerar/enviar/reenviar).
// `onCambiado({mes, anio})` lo llama el llamador (historialDrawer.js) tras
// regenerar/enviar para refrescar su propia lista; devuelve el resumen
// actualizado de ese período (o null si ya no existe) para que este
// drawer pueda recargarse con el id nuevo tras un regenerar.
export function createReciboDrawer(root, { config = {}, onCambiado } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay ac-drawer-overlay--nested-2";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer ac-drawer-recibo";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  let reciboResumen = null;

  function close() {
    overlay.classList.remove("open");
  }

  function tituloPara(item) {
    return `Recibo — ${capitaliza(MESES[item.mes] || "")} ${item.anio}`;
  }

  async function cargarYRenderizar() {
    const body = drawer.querySelector(".ac-drawer-body");
    renderMensaje(body, "Cargando recibo…", "ac-loading");

    let recibo;
    try {
      recibo = await fetchRecibo(reciboResumen.id);
    } catch (err) {
      body.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudo cargar el recibo.";
      body.appendChild(p);
      return;
    }

    body.innerHTML = "";
    body.appendChild(
      buildHistorialAcciones(recibo, {
        onRegenerar: async () => {
          await regenerarRecibo(recibo.id);
          const actualizado = await onCambiado?.({ mes: recibo.mes, anio: recibo.anio });
          if (actualizado) {
            reciboResumen = actualizado;
            await cargarYRenderizar();
          } else {
            close();
          }
        },
        onEnviar: async () => {
          await enviarRecibo(recibo.id);
          await onCambiado?.({ mes: recibo.mes, anio: recibo.anio });
          await cargarYRenderizar();
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

  function open(item) {
    reciboResumen = item;
    drawer.innerHTML = "";
    drawer.appendChild(buildHead(tituloPara(item), close));
    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    drawer.appendChild(body);
    overlay.classList.add("open");
    cargarYRenderizar();
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  return { open, close };
}
