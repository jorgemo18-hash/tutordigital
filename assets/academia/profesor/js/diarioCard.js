import { buildIcon } from "./icons.js";
import { nivelInfo } from "./nivel.js";

export function estadoDeEntry(entry) {
  if (!entry.sesion) return "pendiente";
  return entry.sesion.tipo === "ausencia" ? "ausente" : "guardado";
}

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

function horaDeEntry(entry) {
  return entry.horarios?.[0] ? formatHora(entry.horarios[0].hora_inicio) : "Extra";
}

const ESTADO_INFO = {
  pendiente: { cls: "pending", label: "Pendiente", icon: null },
  guardado: { cls: "saved", label: "Guardado", icon: "check" },
  ausente: { cls: "absent", label: "Ausente", icon: "x" },
};

function buildStatePill(estado) {
  const info = ESTADO_INFO[estado];
  const pill = document.createElement("span");
  pill.className = `ac-state ${info.cls}`;
  if (info.icon) pill.appendChild(buildIcon(info.icon, { size: 12 }));
  pill.appendChild(document.createTextNode(info.label));
  return pill;
}

function buildSummaryLine(entry, estado) {
  const summary = document.createElement("div");
  summary.className = "ac-card-summary";
  if (estado === "guardado") {
    const nombres = (entry.sesion?.asignaturas?.length ? entry.sesion.asignaturas : null)
      ?.map((a) => a.nombre)
      .filter(Boolean)
      .join(" + ") || entry.sesion?.asignatura || "";
    const subj = document.createElement("span");
    subj.className = "subj";
    subj.textContent = nombres;
    summary.append(subj, document.createTextNode(` · ${entry.sesion?.tema || ""}`));
  } else if (estado === "ausente") {
    summary.textContent = entry.sesion?.motivo_ausencia || "Ausente";
  }
  return summary;
}

// Fila clicable del diario — abre el drawer de detalle (ver diarioDrawer.js)
// en vez de desplegarse en acordeón. Solo pinta el estado actual del
// alumno; toda la edición vive en el drawer.
export function buildDiarioRow(entry, { onAbrir }) {
  const estado = estadoDeEntry(entry);
  const card = document.createElement("article");
  card.className = `ac-card ${estado}`;

  const head = document.createElement("div");
  head.className = "ac-card-head";
  head.addEventListener("click", () => onAbrir(entry));

  const hora = document.createElement("span");
  hora.className = "ac-card-hora";
  hora.textContent = horaDeEntry(entry);
  head.appendChild(hora);

  const id = document.createElement("div");
  id.className = "ac-card-id";
  const nameRow = document.createElement("div");
  nameRow.className = "ac-card-namerow";
  const name = document.createElement("span");
  name.className = "ac-card-name";
  name.textContent = entry.nombre || "(sin nombre)";
  const course = document.createElement("span");
  course.className = "ac-card-course";
  course.textContent = entry.curso || "";
  const lv = nivelInfo(entry.nivel);
  const lvTag = document.createElement("span");
  lvTag.className = `ac-lv ${lv.cls}`;
  lvTag.textContent = lv.label;
  nameRow.append(name, course, lvTag);
  id.appendChild(nameRow);
  if (estado !== "pendiente") id.appendChild(buildSummaryLine(entry, estado));
  head.appendChild(id);

  head.appendChild(buildStatePill(estado));

  card.appendChild(head);
  return card;
}
