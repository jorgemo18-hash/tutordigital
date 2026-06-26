import { fetchHistorialRecibos } from "../../api.js";
import { buildIcon } from "../../icons.js";
import { buildHistorialLista } from "./historialLista.js";
import { createReciboDrawer } from "./reciboDrawer.js";

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

// Segundo drawer deslizante, apilado sobre el del alumno sin cubrirlo: su
// overlay (.ac-drawer-overlay--nested) solo oscurece el área a la
// izquierda del drawer de alumno (ver el `inset` en el CSS), así que ese
// drawer queda visible y operable detrás mientras este está abierto.
// Implementación de referencia para cualquier drawer con sub-niveles de
// navegación en el proyecto — ver docs/drawer-stacking.md.
//
// Seleccionar un recibo de la lista NO reemplaza este contenido — abre un
// tercer drawer apilado (reciboDrawer.js), mismo patrón un nivel más a la
// izquierda. Este drawer sigue mostrando la lista siempre.
export function createHistorialDrawer(root, { config = {} } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay ac-drawer-overlay--nested";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer ac-drawer-historial";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  // Tercer drawer, creado una sola vez y apilado sobre este — ver reciboDrawer.js.
  const reciboDrawer = createReciboDrawer(root, {
    config,
    onCambiado: async ({ mes, anio }) => {
      await recargarHistorial();
      renderLista(drawer.querySelector(".ac-drawer-body"));
      return historial.find((h) => h.mes === mes && h.anio === anio) || null;
    },
  });

  let alumnoId = null;
  let alumnoNombre = "";
  let historial = [];

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
        onSeleccionar: (item) => reciboDrawer.open(item),
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
    historial = [];
    render();
    overlay.classList.add("open");
    await recargarHistorial();
    renderLista(drawer.querySelector(".ac-drawer-body"));
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) close(); });

  return { open, close };
}
