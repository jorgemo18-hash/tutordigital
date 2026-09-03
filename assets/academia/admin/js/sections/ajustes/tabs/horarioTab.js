import { buildIcon } from "../../../icons.js";
import { fetchConfig, updateConfig, fetchImpactoHorario } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { buildPlazasPanel } from "../horario/plazasPanel.js";
// El panel de apertura vive aparte desde que admite jornada partida: es
// pantalla propia (modo, dos tramos, vista previa) y este archivo ya
// rozaba el límite de líneas.
import { buildFranjasPanel } from "../horario/franjasPanel.js";
import { buildReservasPanel } from "../horario/reservasPanel.js";

const DIAS_LAB = [
  { num: 1, k: "L", label: "Lun" },
  { num: 2, k: "M", label: "Mar" },
  { num: 3, k: "X", label: "Mié" },
  { num: 4, k: "J", label: "Jue" },
  { num: 5, k: "V", label: "Vie" },
  { num: 6, k: "S", label: "Sáb" },
];

function buildDiaBtn(dia, activo, onToggle) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `ac-day ${activo ? "on" : ""}`;
  const k = document.createElement("span");
  k.className = "ac-day-k";
  k.textContent = dia.k;
  const d = document.createElement("span");
  d.className = "ac-day-d";
  d.textContent = dia.label;
  btn.append(k, d);
  btn.addEventListener("click", () => onToggle(dia.num));
  return btn;
}

// "Días laborables" sí persiste de verdad — academia_config.dias_laborables
// ya existía (restringe la rejilla de horario de los alumnos), solo le
// faltaba un PUT que lo aceptara (ver UpdateConfigSchema en
// academia.config.routes.js).
function buildDiasLaborablesPanel({ fetchConfigFn, updateConfigFn }) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Días laborables", "Días en los que la academia imparte clase. Restringe la rejilla de horarios de los alumnos."));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();
    let dias = Array.isArray(config.dias_laborables) ? [...config.dias_laborables] : [1, 2, 3, 4, 5];

    const days = document.createElement("div");
    days.className = "ac-days";
    const summary = document.createElement("div");
    summary.className = "ac-day-summary";

    function renderDias() {
      days.innerHTML = "";
      for (const dia of DIAS_LAB) {
        days.appendChild(buildDiaBtn(dia, dias.includes(dia.num), (num) => {
          dias = dias.includes(num) ? dias.filter((d) => d !== num) : [...dias, num].sort();
          renderDias();
        }));
      }
      summary.innerHTML = "";
      summary.appendChild(buildIcon("check", { size: 13 }));
      const etiquetas = DIAS_LAB.filter((d) => dias.includes(d.num)).map((d) => d.label).join(" · ");
      summary.appendChild(document.createTextNode(` ${dias.length} días activos · ${etiquetas}`));
    }
    renderDias();
    panel.append(days, summary);

    const { foot, hint } = buildPanelFoot("Toca un día para activarlo o desactivarlo");
    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      const hintOriginal = hint.textContent;
      try {
        await updateConfigFn({ dias_laborables: dias });
        hint.textContent = "✓ Guardado";
      } catch (err) {
        hint.textContent = err.message || "No se pudo guardar.";
      }
      saveBtn.disabled = false;
      setTimeout(() => { hint.textContent = hintOriginal; }, 1700);
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

export function buildHorarioTab({
  fetchConfigFn = fetchConfig,
  updateConfigFn = updateConfig,
  fetchImpactoHorarioFn = fetchImpactoHorario,
  confirmFn = (mensaje) => window.confirm(mensaje),
} = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(
    buildFranjasPanel({ fetchConfigFn, updateConfigFn, fetchImpactoHorarioFn, confirmFn }),
    buildDiasLaborablesPanel({ fetchConfigFn, updateConfigFn }),
    buildPlazasPanel({ fetchConfigFn, updateConfigFn }),
    // A lo ancho de las dos columnas: es una rejilla de días por horas y
    // partida por la mitad no se lee.
    buildReservasPanel({ fetchConfigFn, updateConfigFn })
  );
  return wrap;
}
