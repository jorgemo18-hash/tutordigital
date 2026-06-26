import { buildIcon } from "../../../icons.js";
import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";

// academia_config no guarda una lista de franjas — solo franja_inicio/
// franja_fin/franja_duracion (un único rango+intervalo, ver
// academia.horario.routes.js). Esta lista editable es la misma vista
// visual que ya existía antes del rediseño (sin persistencia todavía):
// reconciliarla con el modelo real de 3 campos escalares es un cambio de
// alcance mayor que esta tarea, así que se mantiene como estaba.
const FRANJAS_SEED = [
  { id: "f1", inicio: "15:30", fin: "16:30" },
  { id: "f2", inicio: "16:30", fin: "17:30" },
  { id: "f3", inicio: "17:30", fin: "18:30" },
  { id: "f4", inicio: "18:30", fin: "19:30" },
  { id: "f5", inicio: "19:30", fin: "20:30" },
];

const DIAS_LAB = [
  { num: 1, k: "L", label: "Lun" },
  { num: 2, k: "M", label: "Mar" },
  { num: 3, k: "X", label: "Mié" },
  { num: 4, k: "J", label: "Jue" },
  { num: 5, k: "V", label: "Vie" },
  { num: 6, k: "S", label: "Sáb" },
];

function toMin(t) {
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function durFranja(inicio, fin) {
  const d = toMin(fin) - toMin(inicio);
  if (Number.isNaN(d) || d <= 0) return "—";
  return d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ""}` : `${d} min`;
}

function buildFranjaRow(franja, onCambio, onEliminar) {
  const row = document.createElement("div");
  row.className = "ac-franja-edit";

  const inicio = document.createElement("input");
  inicio.type = "time";
  inicio.className = "ac-time-input";
  inicio.value = franja.inicio;
  inicio.addEventListener("change", () => onCambio(franja.id, "inicio", inicio.value));

  const dash = document.createElement("span");
  dash.className = "ac-franja-dash";
  dash.textContent = "→";

  const fin = document.createElement("input");
  fin.type = "time";
  fin.className = "ac-time-input";
  fin.value = franja.fin;
  fin.addEventListener("change", () => onCambio(franja.id, "fin", fin.value));

  const dur = document.createElement("span");
  dur.className = "ac-franja-dur";
  dur.textContent = durFranja(franja.inicio, franja.fin);

  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.className = "ac-icon-btn danger";
  delBtn.title = "Eliminar franja";
  delBtn.appendChild(buildIcon("trash", { size: 14 }));
  delBtn.addEventListener("click", () => onEliminar(franja.id));

  row.append(inicio, dash, fin, dur, delBtn);
  return row;
}

function buildFranjasPanel() {
  let franjas = [...FRANJAS_SEED];

  const panel = document.createElement("div");
  panel.className = "ac-panel";
  panel.appendChild(buildPanelHead("Franjas horarias", "Tramos disponibles para asignar clases en el horario de cada alumno."));

  const listSlot = document.createElement("div");
  panel.appendChild(listSlot);

  function renderLista() {
    listSlot.innerHTML = "";
    for (const franja of franjas) {
      listSlot.appendChild(
        buildFranjaRow(
          franja,
          (id, campo, valor) => { franjas = franjas.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)); renderLista(); },
          (id) => { franjas = franjas.filter((f) => f.id !== id); renderLista(); }
        )
      );
    }
  }
  renderLista();

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-btn ghost";
  addBtn.style.marginTop = "4px";
  addBtn.append(buildIcon("plus", { size: 13 }), document.createTextNode(" Añadir franja"));
  addBtn.addEventListener("click", () => {
    franjas = [...franjas, { id: `f_${franjas.length}_${franjas.length ? toMin(franjas[franjas.length - 1].fin) : 0}`, inicio: "09:00", fin: "10:00" }];
    renderLista();
  });
  panel.appendChild(addBtn);

  const { foot, hint } = buildPanelFoot(`${franjas.length} tramos configurados`);
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.textContent = "Guardar";
  saveBtn.addEventListener("click", () => {
    hint.textContent = `${franjas.length} tramos configurados — sin guardar en el servidor todavía`;
  });
  foot.appendChild(saveBtn);
  panel.appendChild(foot);

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

export function buildHorarioTab({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-set-grid two";
  wrap.append(buildFranjasPanel(), buildDiasLaborablesPanel({ fetchConfigFn, updateConfigFn }));
  return wrap;
}
