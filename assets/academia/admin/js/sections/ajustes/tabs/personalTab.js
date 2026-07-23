import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";

function buildToggle(label, checked) {
  const wrap = document.createElement("label");
  wrap.className = "ac-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(input, span);
  return { wrap, input };
}

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

export function buildPersonalTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";
  wrap.appendChild(buildControlHorarioPanel({ fetchConfigFn, updateConfigFn }));
  return wrap;
}
