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
function buildAdminImparteClasesPanel({ fetchConfigFn, updateConfigFn, recargarFn }) {
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

    const valorInicial = Boolean(config.admin_imparte_clases);
    const activo = buildToggle("El administrador de este centro también imparte clase", valorInicial);
    panel.appendChild(activo.wrap);

    const { foot, hint } = buildPanelFoot();
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      const nuevo = activo.input.checked;
      try {
        await updateConfigFn({ admin_imparte_clases: nuevo });
        // Este ajuste cambia el MENÚ (aparece o desaparece "Dar clase"), y
        // el menú se construye una sola vez al arrancar el panel. Antes se
        // guardaba y no pasaba nada visible hasta que el admin recargaba
        // por su cuenta, que es exactamente lo que parece un fallo.
        //
        // Se recarga en vez de reconstruir el sidebar en caliente: es un
        // cambio de la estructura del panel, no de un dato de pantalla, y
        // aquí no hay nada más a medias que perder (la configuración ya
        // está guardada cuando esto ocurre).
        if (nuevo !== valorInicial) {
          hint.textContent = "✓ Guardado — recargando…";
          recargarFn();
          return;
        }
        hint.textContent = "✓ Guardado";
        setTimeout(() => { hint.textContent = ""; }, 1700);
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

// `recargarFn` inyectable para que el test pueda comprobar que se recarga
// (y cuándo NO se recarga) sin que happy-dom intente navegar de verdad.
export function buildPersonalTab({
  fetchConfigFn = fetchConfig,
  updateConfigFn = updateConfig,
  recargarFn = () => window.location.reload(),
} = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid one";
  wrap.appendChild(buildAdminImparteClasesPanel({ fetchConfigFn, updateConfigFn, recargarFn }));
  wrap.appendChild(buildControlHorarioPanel({ fetchConfigFn, updateConfigFn }));
  return wrap;
}
