import { buildIcon } from "../../../icons.js";
import { fetchConfig, updateConfig, fetchImpactoHorario } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { toMinutos, toHHMM, generarHoras } from "../../../../../../shared/js/horarioFranjas.js";
import { buildPlazasPanel } from "../horario/plazasPanel.js";

const DIAS_LAB = [
  { num: 1, k: "L", label: "Lun" },
  { num: 2, k: "M", label: "Mar" },
  { num: 3, k: "X", label: "Mié" },
  { num: 4, k: "J", label: "Jue" },
  { num: 5, k: "V", label: "Vie" },
  { num: 6, k: "S", label: "Sáb" },
];

function tramosIguales(a, b) {
  return a.length === b.length && a.every((h, i) => h === b[i]);
}

// Una fila por tramo — reutiliza .ac-franja-edit/.ac-time-input/
// .ac-franja-dash/.ac-franja-dur (ya existían para la lista editable
// antigua) sobre <span> en vez de <input>: ya no son editables una a
// una, el único origen de verdad son los 3 campos de arriba.
function buildTramoPreviewRow(horaInicio, franjaDuracion) {
  const row = document.createElement("div");
  row.className = "ac-franja-edit";

  const inicio = document.createElement("span");
  inicio.className = "ac-time-input";
  inicio.style.textAlign = "center";
  inicio.textContent = horaInicio;

  const dash = document.createElement("span");
  dash.className = "ac-franja-dash";
  dash.textContent = "→";

  const fin = document.createElement("span");
  fin.className = "ac-time-input";
  fin.style.textAlign = "center";
  fin.textContent = toHHMM(toMinutos(horaInicio) + Number(franjaDuracion));

  const dur = document.createElement("span");
  dur.className = "ac-franja-dur";
  dur.textContent = `${franjaDuracion} min`;

  row.append(inicio, dash, fin, dur);
  return row;
}

function buildTramosPreview(franjaInicio, franjaFin, franjaDuracion) {
  const horas = generarHoras(franjaInicio, franjaFin, franjaDuracion);
  const wrap = document.createElement("div");
  if (!horas.length) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "Ningún tramo con estos valores — revisa inicio, fin y duración.";
    wrap.appendChild(empty);
    return wrap;
  }
  for (const hora of horas) wrap.appendChild(buildTramoPreviewRow(hora, franjaDuracion));
  return wrap;
}

// Franjas horarias — un solo modelo (decisión de producto 2026-07-31, ver
// docs/deuda-tecnica.md): el panel edita franja_inicio/franja_fin/
// franja_duracion de academia_config, la lista de tramos es una vista
// previa de solo lectura calculada con generarHoras(). Antes era un
// array editable en memoria que nunca llegó a guardar nada (ver
// docs/deuda-tecnica.md, hallazgo de la auditoría anterior).
// Exportado (no solo interno) para poder testearlo aislado del panel de
// Días laborables — ambos comparten el mismo wrap de buildHorarioTab, y
// los dos tienen su propio botón "Guardar" con la misma clase CSS.
export function buildFranjasPanel({ fetchConfigFn, updateConfigFn, fetchImpactoHorarioFn, confirmFn }) {
  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Franjas horarias", "Tramos disponibles para asignar clases en el horario de cada alumno."));

  const msgEl = document.createElement("span");
  msgEl.className = "ac-drawer-msg";
  panel.appendChild(msgEl);

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    let inicioActual = config.franja_inicio || "15:30";
    let finActual = config.franja_fin || "20:30";
    let duracionActual = Number(config.franja_duracion) || 60;

    const row = document.createElement("div");
    row.className = "ac-field-row three";

    const inicioInput = document.createElement("input");
    inicioInput.type = "time";
    inicioInput.className = "ac-time-input";
    inicioInput.value = inicioActual;

    const finInput = document.createElement("input");
    finInput.type = "time";
    finInput.className = "ac-time-input";
    finInput.value = finActual;

    const duracionInput = document.createElement("input");
    duracionInput.type = "number";
    duracionInput.className = "ac-input";
    duracionInput.min = "15";
    duracionInput.max = "240";
    duracionInput.step = "5";
    duracionInput.value = String(duracionActual);

    row.append(inicioInput, finInput, duracionInput);
    panel.appendChild(row);

    const previewSlot = document.createElement("div");
    previewSlot.style.marginTop = "10px";
    panel.appendChild(previewSlot);

    const { foot, hint } = buildPanelFoot("");

    function actualizarVista() {
      previewSlot.innerHTML = "";
      previewSlot.appendChild(buildTramosPreview(inicioInput.value, finInput.value, duracionInput.value));
      const n = generarHoras(inicioInput.value, finInput.value, duracionInput.value).length;
      hint.textContent = `${n} ${n === 1 ? "tramo" : "tramos"} configurados`;
    }
    actualizarVista();
    for (const input of [inicioInput, finInput, duracionInput]) {
      input.addEventListener("input", actualizarVista);
    }

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", onGuardar);
    foot.appendChild(saveBtn);
    panel.appendChild(foot);

    async function onGuardar() {
      msgEl.textContent = "";
      const nuevo = {
        franja_inicio: inicioInput.value,
        franja_fin: finInput.value,
        franja_duracion: Number(duracionInput.value),
      };

      const tramosAntes = generarHoras(inicioActual, finActual, duracionActual);
      const tramosDespues = generarHoras(nuevo.franja_inicio, nuevo.franja_fin, nuevo.franja_duracion);
      const cambiaronTramos = !tramosIguales(tramosAntes, tramosDespues);

      saveBtn.disabled = true;
      try {
        if (cambiaronTramos) {
          const huerfanos = await fetchImpactoHorarioFn(nuevo);
          if (huerfanos > 0) {
            const clase = huerfanos === 1 ? "clase asignada dejaría" : "clases asignadas dejarían";
            const pregunta = `${huerfanos} ${clase} de aparecer en el horario. ¿Guardar de todas formas?`;
            if (!confirmFn(pregunta)) {
              saveBtn.disabled = false;
              return;
            }
          }
        }

        await updateConfigFn(nuevo);
        inicioActual = nuevo.franja_inicio;
        finActual = nuevo.franja_fin;
        duracionActual = nuevo.franja_duracion;
        msgEl.textContent = "✓ Guardado";
        msgEl.className = "ac-drawer-msg ok";
      } catch (err) {
        msgEl.textContent = err.message || "No se pudo guardar.";
        msgEl.className = "ac-drawer-msg error";
      } finally {
        saveBtn.disabled = false;
      }
    }
  }

  fetchConfigFn()
    .then((config) => renderContenido(config || {}))
    .catch((err) => {
      cargando.textContent = err.message || "No se pudo cargar la configuración.";
      cargando.className = "ac-error";
    });

  return panel;
}

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
    buildPlazasPanel({ fetchConfigFn, updateConfigFn })
  );
  return wrap;
}
