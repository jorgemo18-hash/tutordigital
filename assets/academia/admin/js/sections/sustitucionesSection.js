import { fetchProfesoresParaSustitucion, fetchSustituciones, crearSustitucion, revocarSustitucion } from "../apiSustituciones.js";
import { buildTablaSustituciones } from "./sustituciones/tablaSustituciones.js";
import { abrirCrearSustitucionDialog } from "./sustituciones/crearSustitucionDialog.js";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

// Sección "Sustituciones" del sidebar admin-academia — siempre visible,
// único punto de gestión (el profesor ya no declara ni revoca nada,
// solo consulta las suyas dentro de Horario/Diario). El admin ve el
// histórico completo del centro y puede crear con cualquier rango de
// fechas o revocar cualquiera ya creada.
//
// `confirmFn` inyectable (mismo criterio que regenerarBoton.js) — por
// defecto window.confirm, igual que el resto de acciones destructivas
// de listados en este panel (ver categoriasGastoPanel.js/gastosTab.js).
// Bloqueante de por sí: solo se ve un estado a la vez sin ningún estado
// intermedio que gestionar a mano, que es justo el bug que tuvo el
// panel profesor con sus propios diálogos de confirmación.
export function createSustitucionesSection({
  confirmFn = (mensaje) => window.confirm(mensaje),
  fetchProfesoresFn = fetchProfesoresParaSustitucion,
  fetchSustitucionesFn = fetchSustituciones,
  crearSustitucionFn = crearSustitucion,
  revocarSustitucionFn = revocarSustitucion,
} = {}) {
  let tablaWrap = null;
  let msgEl = null;
  let profesoresCache = [];

  async function cargarTabla() {
    tablaWrap.innerHTML = "";
    tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-loading", textContent: "Cargando…" }));
    try {
      const [profesores, sustituciones] = await Promise.all([fetchProfesoresFn(), fetchSustitucionesFn()]);
      profesoresCache = profesores;
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(buildTablaSustituciones(sustituciones, { hoyISO: hoyISO(), onRevocar }));
    } catch (err) {
      tablaWrap.innerHTML = "";
      tablaWrap.appendChild(Object.assign(document.createElement("p"), { className: "ac-error", textContent: err.message || "No se pudieron cargar las sustituciones." }));
    }
  }

  async function onRevocar(sustitucion) {
    const pregunta = `¿Revocar la sustitución de ${sustitucion.sustituto_nombre || "este profesor"} `
      + `cubriendo a ${sustitucion.sustituido_nombre || "otro profesor"}?`;
    if (!confirmFn(pregunta)) return;

    msgEl.textContent = "";
    try {
      await revocarSustitucionFn(sustitucion.id);
      msgEl.textContent = "✓ Sustitución revocada";
      msgEl.className = "ac-drawer-msg ok";
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo revocar la sustitución.";
      msgEl.className = "ac-drawer-msg error";
    }
  }

  async function onCrear() {
    if (profesoresCache.length < 2) {
      msgEl.textContent = "Hacen falta al menos dos profesores en el centro para crear una sustitución.";
      msgEl.className = "ac-drawer-msg error";
      return;
    }
    const datos = await abrirCrearSustitucionDialog(profesoresCache, { hoyISO: hoyISO() });
    if (!datos) return;
    msgEl.textContent = "";
    try {
      await crearSustitucionFn(datos);
      msgEl.textContent = "✓ Sustitución creada";
      msgEl.className = "ac-drawer-msg ok";
      await cargarTabla();
    } catch (err) {
      msgEl.textContent = err.message || "No se pudo crear la sustitución.";
      msgEl.className = "ac-drawer-msg error";
    }
  }

  function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Sustituciones";
    head.appendChild(title);

    const crearBtn = document.createElement("button");
    crearBtn.type = "button";
    crearBtn.className = "ac-btn primary";
    crearBtn.textContent = "Nueva sustitución";
    crearBtn.addEventListener("click", onCrear);
    head.appendChild(crearBtn);

    container.appendChild(head);

    const panel = document.createElement("div");
    panel.className = "ac-panel";

    msgEl = document.createElement("span");
    msgEl.className = "ac-drawer-msg";
    panel.appendChild(msgEl);

    tablaWrap = document.createElement("div");
    panel.appendChild(tablaWrap);
    cargarTabla();

    container.appendChild(panel);
  }

  return { render };
}
