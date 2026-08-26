import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { buildToggle } from "../toggle.js";

// Control horario (RDL 8/2019) — toggle único, OFF por defecto. Al
// activarlo aparece "Fichar" en el panel de cada trabajador (profesor y
// admin, ver academiaProfesor.js/academiaAdmin.js) y la sección "Control
// horario" en el sidebar del admin (ver sidebar.js) — ninguna de las dos
// se muestra mientras esté desactivado, para no confundir a academias que
// no lo necesitan (p.ej. Lyceo).
function buildControlHorarioPanel({ fetchConfigFn, updateConfigFn }) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(buildPanelHead(
      "Control horario",
      "Fichaje de entrada/salida para profesores y personal admin, conforme al RDL 8/2019."
    ));

    const activo = buildToggle("Activar control horario para este centro", Boolean(config.control_horario_activo));
    panel.appendChild(activo.wrap);

    const { foot, hint } = buildPanelFoot();
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ control_horario_activo: activo.input.checked });
        const previo = hint.textContent;
        hint.textContent = "✓ Guardado";
        setTimeout(() => { hint.textContent = previo; }, 1700);
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
    });
    foot.appendChild(saveBtn);
    panel.appendChild(foot);
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}

// "El administrador da clase" — en academias pequeñas el dueño es a la vez
// admin y profesor, y hasta ahora eso obligaba a tener dos cuentas y cerrar
// sesión para pasar del diario a la gestión.
//
// El interruptor vive AQUÍ y no solo en superadmin al crear la academia (que
// fue la primera idea): los centros ya creados no se pueden volver a crear, y
// la situación cambia con el tiempo — se contrata a alguien y el dueño deja
// de dar clase, o al revés. Decidirlo solo al nacer el centro deja atrapado
// a quien cambie de modelo.
//
// No concede permisos: las rutas de sesiones, notas de examen y horario ya
// aceptan rol admin (ver migración 108). Solo decide si se ve la sección.
function buildAdminImparteClasesPanel({ fetchConfigFn, updateConfigFn }) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    panel.appendChild(buildPanelHead(
      "El administrador da clase",
      "Añade la sección «Dar clase» (diario y notas de examen) al panel de administración, para no tener que cambiar de cuenta."
    ));

    const activo = buildToggle("El administrador de este centro también imparte clase", Boolean(config.admin_imparte_clases));
    panel.appendChild(activo.wrap);

    const { foot, hint } = buildPanelFoot();
    hint.textContent = "El cambio se ve al recargar la página.";
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ admin_imparte_clases: activo.input.checked });
        const previo = hint.textContent;
        hint.textContent = "✓ Guardado";
        setTimeout(() => { hint.textContent = previo; }, 1700);
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
    });
    foot.appendChild(saveBtn);
    panel.appendChild(foot);
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}

export function buildPersonalTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";
  wrap.appendChild(buildAdminImparteClasesPanel({ fetchConfigFn, updateConfigFn }));
  wrap.appendChild(buildControlHorarioPanel({ fetchConfigFn, updateConfigFn }));
  return wrap;
}
