import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { buildRejillaCursos } from "./rejillaCursosDom.js";
import { bloquesDeConfig } from "../../../../../../shared/js/horarioBloques.js";
import { reservasVigentes } from "../../../../../../shared/js/horarioReservas.js";

const TITULO = "Cursos por hora";
const DESC =
  "Solo si reservas horas para un curso concreto. Elige un curso y pincha las horas: saldrá impreso " +
  "en la hoja. Es un rótulo, no impide meter en esa hora a un alumno de otro nivel.";

const DIAS = [
  { num: 1, label: "Lun" }, { num: 2, label: "Mar" }, { num: 3, label: "Mié" },
  { num: 4, label: "Jue" }, { num: 5, label: "Vie" }, { num: 6, label: "Sáb" }, { num: 7, label: "Dom" },
];

function diasDeConfig(config) {
  const activos = Array.isArray(config?.dias_laborables) && config.dias_laborables.length
    ? config.dias_laborables
    : [1, 2, 3, 4, 5];
  return DIAS.filter((d) => activos.includes(d.num));
}

// Ajustes › Información para familias › "Cursos por hora". Vive aquí y no
// en la pestaña Horario a propósito: esto no configura cuándo abre el
// centro —eso es Horario—, sino qué pone el papel que se le da a una
// familia. Junto a la tabla de precios, en la misma pestaña, se ve de un
// vistazo todo lo que va impreso en la hoja.
//
// La rejilla que se dibuja es la MISMA que la del cuadrante
// (bloquesDeConfig): una fila por clase del centro, no por media hora. Si
// se dibujara aparte, cambiar la duración de la clase dejaría este panel
// diciendo una cosa y el cuadrante otra.
export function buildCursosPorHoraPanel({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead(TITULO, DESC));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    const bloques = bloquesDeConfig(config);
    const dias = diasDeConfig(config);
    const { foot, hint } = buildPanelFoot("Una casilla en blanco es una hora abierta a cualquier curso");

    if (!bloques.length || !dias.length) {
      const vacio = document.createElement("p");
      vacio.className = "ac-empty";
      vacio.textContent = "Configura primero el horario de apertura y los días laborables, en Ajustes › Horario.";
      panel.append(vacio, foot);
      return;
    }

    // Se limpian de entrada las reservas de horas que ya no existen (el
    // centro cambió su apertura): así lo que se ve es lo que hay, y al
    // guardar no se devuelven a la base de datos.
    const rejilla = buildRejillaCursos({
      bloques,
      dias,
      reservas: reservasVigentes(config?.horario_reservas, { dias: dias.map((d) => d.num), bloques }),
      onCambio: () => { hint.textContent = "Sin guardar"; },
    });
    panel.appendChild(rejilla.el);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ horario_reservas: rejilla.getValue() });
        hint.textContent = "✓ Guardado";
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
