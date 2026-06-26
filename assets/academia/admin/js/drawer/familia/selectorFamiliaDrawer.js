import { fetchFamilias, createFamilia } from "../../api.js";
import { buildIcon } from "../../icons.js";
import { buildFamiliaFields } from "./familiaFields.js";
import { buildBuscadorFamilias } from "./familiaBuscador.js";

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

function buildFootBtn(texto, clase) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-btn ${clase}`;
  btn.textContent = texto;
  return btn;
}

function renderMensaje(body, texto, claseExtra) {
  body.innerHTML = "";
  const p = document.createElement("p");
  p.className = claseExtra;
  p.textContent = texto;
  body.appendChild(p);
}

// Cuerpo + pie del modo "buscador": lista de familias existentes y, al
// pie, el botón para pasar a "crear". `irACrear`/`onSeleccionar`/`close`
// llegan explícitos — no cierra sobre variables del factory de fuera.
function buildModoBuscador({ fetchFamiliasFn, onSeleccionar, close, irACrear }) {
  const body = document.createElement("div");
  body.className = "ac-drawer-body";
  renderMensaje(body, "Cargando familias…", "ac-loading");

  fetchFamiliasFn()
    .then((familias) => {
      body.innerHTML = "";
      body.appendChild(
        buildBuscadorFamilias(familias, (familia) => {
          onSeleccionar(familia);
          close();
        })
      );
    })
    .catch((err) => renderMensaje(body, err.message || "No se pudieron cargar las familias.", "ac-error"));

  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";
  const crearBtn = buildFootBtn("Crear familia nueva", "ghost");
  crearBtn.style.width = "100%";
  crearBtn.addEventListener("click", irACrear);
  foot.appendChild(crearBtn);

  return { body, foot };
}

// Cuerpo + pie del modo "crear": formulario reutilizado de
// familiaFields.js + POST inmediato al confirmar. `prefill`/`createFamiliaFn`
// /`onSeleccionar`/`close`/`irABuscador` llegan explícitos.
function buildModoCrear({ prefill, createFamiliaFn, onSeleccionar, close, irABuscador }) {
  const body = document.createElement("div");
  body.className = "ac-drawer-body";
  const fields = buildFamiliaFields(prefill || {});
  body.appendChild(fields.wrap);
  const msg = document.createElement("div");
  msg.className = "ac-drawer-msg";
  body.appendChild(msg);

  const foot = document.createElement("div");
  foot.className = "ac-drawer-foot";
  const atrasBtn = buildFootBtn("← Atrás", "ghost");
  atrasBtn.addEventListener("click", irABuscador);
  const crearBtn = buildFootBtn("Crear familia", "primary");
  crearBtn.addEventListener("click", async () => {
    const datos = fields.getValue();
    if (!datos.nombre) {
      msg.textContent = "El nombre del tutor es obligatorio.";
      msg.className = "ac-drawer-msg error";
      return;
    }
    crearBtn.disabled = true;
    try {
      const familia = await createFamiliaFn(datos);
      onSeleccionar(familia);
      close();
    } catch (err) {
      msg.textContent = err.message || "No se pudo crear la familia.";
      msg.className = "ac-drawer-msg error";
      crearBtn.disabled = false;
    }
  });
  foot.append(atrasBtn, crearBtn);

  return { body, foot };
}

// Segundo drawer deslizante, apilado sobre el de alumno sin cubrirlo —
// mismo patrón que historialDrawer.js (ver .ac-drawer-overlay--nested en
// el CSS y docs/drawer-stacking.md). La familia creada aquí ya queda
// guardada en el servidor al confirmar — a diferencia del flujo antiguo,
// que diferia la creación hasta guardar el alumno.
export function createSelectorFamiliaDrawer(root, { fetchFamiliasFn = fetchFamilias, createFamiliaFn = createFamilia, onCerrarTodo } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay ac-drawer-overlay--nested";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer ac-drawer-selector-familia";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  let prefillCrear = null;
  let onSeleccionar = null;

  function close() {
    overlay.classList.remove("open");
  }

  function renderModo(buildFn) {
    drawer.querySelector(".ac-drawer-body")?.remove();
    drawer.querySelector(".ac-drawer-foot")?.remove();
    const { body, foot } = buildFn();
    drawer.append(body, foot);
  }

  function irABuscador() {
    renderModo(() => buildModoBuscador({ fetchFamiliasFn, onSeleccionar, close, irACrear }));
  }

  function irACrear() {
    renderModo(() =>
      buildModoCrear({ prefill: prefillCrear, createFamiliaFn, onSeleccionar, close, irABuscador })
    );
  }

  function open({ prefill, onSeleccionar: onSeleccionarFn } = {}) {
    prefillCrear = prefill || null;
    onSeleccionar = onSeleccionarFn;
    drawer.innerHTML = "";
    drawer.appendChild(buildHead("Seleccionar familia", close));
    overlay.classList.add("open");
    irABuscador();
  }

  // Clic en el velo oscuro (fuera del panel): cierra TODO el apilamiento,
  // no solo este nivel — por eso usa onCerrarTodo en vez de close().
  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) onCerrarTodo?.(); });

  return { open, close };
}
