import { fetchConfig, updateConfig } from "../../../api.js";
import { buildPanelHead, buildPanelFoot } from "../panelChrome.js";
import { bloquesDeConfig, etiquetaBloque } from "../../../../../../shared/js/horarioBloques.js";
import { NIVELES } from "../../../../../../shared/js/niveles.js";
import { reservasVigentes, reservaDe, conReserva } from "../../../../../../shared/js/horarioReservas.js";

const TITULO = "Cursos por hora";
const DESC =
  "Si reservas alguna hora para un curso concreto, márcala aquí y saldrá impresa en la hoja para " +
  "familias. Es un rótulo: no impide meter en esa hora a un alumno de otro nivel.";

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

function buildSelect(valor, onCambio) {
  const select = document.createElement("select");
  select.className = "ac-select ac-reserva-select";

  const libre = document.createElement("option");
  libre.value = "";
  // Un guion y no "Libre": la casilla vacía significa "cualquier curso", no
  // "esa hora está libre" — con plazas es otra cosa distinta y confundirlas
  // en Ajustes acabaría en un papel que dice lo que no es.
  libre.textContent = "—";
  select.appendChild(libre);

  for (const nivel of NIVELES) {
    const opt = document.createElement("option");
    opt.value = nivel.id;
    opt.textContent = nivel.label;
    select.appendChild(opt);
  }

  select.value = valor || "";
  select.addEventListener("change", () => onCambio(select.value));
  return select;
}

function buildRejilla(bloques, dias, leer, escribir) {
  const tabla = document.createElement("table");
  tabla.className = "ac-reservas";

  const thead = document.createElement("thead");
  const filaCabecera = document.createElement("tr");
  filaCabecera.appendChild(document.createElement("th"));
  for (const dia of dias) {
    const th = document.createElement("th");
    th.className = "ac-reserva-dia";
    th.textContent = dia.label;
    filaCabecera.appendChild(th);
  }
  thead.appendChild(filaCabecera);

  const tbody = document.createElement("tbody");
  for (const bloque of bloques) {
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.className = "ac-reserva-hora";
    th.textContent = etiquetaBloque(bloque);
    tr.appendChild(th);
    for (const dia of dias) {
      const td = document.createElement("td");
      td.appendChild(buildSelect(leer(dia.num, bloque), (nivel) => escribir(dia.num, bloque, nivel)));
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  tabla.append(thead, tbody);
  return tabla;
}

// Ajustes › Horario › "Cursos por hora". La rejilla que se dibuja aquí es
// la MISMA que la del cuadrante y la de la hoja para familias
// (bloquesDeConfig): una fila por clase del centro, no por media hora. Si
// se dibujara aparte, cambiar la duración de la clase dejaría este panel
// diciendo una cosa y el cuadrante otra.
export function buildReservasPanel({ fetchConfigFn = fetchConfig, updateConfigFn = updateConfig } = {}) {
  const panel = document.createElement("div");
  panel.className = "ac-panel ancho";
  panel.appendChild(buildPanelHead(TITULO, DESC));

  const cargando = document.createElement("p");
  cargando.className = "ac-loading";
  cargando.textContent = "Cargando…";
  panel.appendChild(cargando);

  function renderContenido(config) {
    cargando.remove();

    const bloques = bloquesDeConfig(config);
    const dias = diasDeConfig(config);
    // Se limpian de entrada las reservas de horas que ya no existen (el
    // centro cambió su apertura): así lo que se ve es lo que hay, y al
    // guardar no se devuelven a la base de datos.
    let reservas = reservasVigentes(config?.horario_reservas, { dias: dias.map((d) => d.num), bloques });

    const { foot, hint } = buildPanelFoot("Deja el guion en las horas abiertas a cualquier curso");

    if (!bloques.length || !dias.length) {
      const vacio = document.createElement("p");
      vacio.className = "ac-empty";
      vacio.textContent = "Configura primero el horario de apertura y los días laborables.";
      panel.append(vacio, foot);
      return;
    }

    panel.appendChild(buildRejilla(
      bloques,
      dias,
      (dia, bloque) => reservaDe(reservas, dia, bloque),
      (dia, bloque, nivel) => {
        reservas = conReserva(reservas, dia, bloque, nivel);
        hint.textContent = "Sin guardar";
      }
    ));

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "ac-btn primary";
    saveBtn.textContent = "Guardar";
    saveBtn.addEventListener("click", async () => {
      saveBtn.disabled = true;
      try {
        await updateConfigFn({ horario_reservas: reservas });
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
