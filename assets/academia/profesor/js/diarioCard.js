import { saveSesion } from "./api.js";
import { buildIcon } from "./icons.js";
import { nivelInfo } from "./nivel.js";

const ASIGNATURAS = ["Matemáticas", "Lengua", "Inglés", "Física y Química", "Biología", "Historia"];

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
    const subj = document.createElement("span");
    subj.className = "subj";
    subj.textContent = entry.sesion?.asignatura || "";
    summary.append(subj, document.createTextNode(` · ${entry.sesion?.tema || ""}`));
  } else if (estado === "ausente") {
    summary.textContent = entry.sesion?.motivo_ausencia || "Ausente";
  }
  return summary;
}

function buildHead(entry, estado, open, onToggle) {
  const head = document.createElement("div");
  head.className = "ac-card-head";
  head.addEventListener("click", onToggle);

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
  if (!open && estado !== "pendiente") id.appendChild(buildSummaryLine(entry, estado));
  head.appendChild(id);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.alignItems = "center";
  right.style.gap = "12px";
  right.appendChild(buildStatePill(estado));
  const chev = document.createElement("span");
  chev.className = `ac-chev ${open ? "open" : ""}`;
  chev.appendChild(buildIcon("down", { size: 16 }));
  right.appendChild(chev);
  head.appendChild(right);

  return head;
}

function buildField(label, tag, attrs = {}) {
  const wrap = document.createElement("div");
  const span = document.createElement("label");
  span.className = "ac-field-label";
  span.textContent = label;
  wrap.appendChild(span);
  const input = document.createElement(tag);
  input.className = tag === "textarea" ? "ac-textarea" : "ac-input";
  Object.entries(attrs).forEach(([key, value]) => { input[key] = value; });
  wrap.appendChild(input);
  return { wrap, input };
}

function buildChips(asignaturaInput) {
  const wrap = document.createElement("div");
  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Asignatura";
  wrap.appendChild(label);

  const chips = document.createElement("div");
  chips.className = "ac-chips";
  const buttons = ASIGNATURAS.map((a) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "ac-chip";
    chip.textContent = a;
    chip.addEventListener("click", () => {
      asignaturaInput.value = a;
      refreshChips();
    });
    chips.appendChild(chip);
    return { label: a, el: chip };
  });
  function refreshChips() {
    for (const { label: a, el } of buttons) el.classList.toggle("on", asignaturaInput.value === a);
  }
  asignaturaInput.addEventListener("input", refreshChips);
  refreshChips();
  wrap.appendChild(chips);
  return wrap;
}

function buildClaseBody(entry, fecha, callbacks, { saveSesionFn }) {
  const body = document.createElement("div");
  body.className = "ac-card-body";

  const asignaturaInput = document.createElement("input");
  asignaturaInput.type = "text";
  asignaturaInput.className = "ac-input";
  asignaturaInput.placeholder = "Asignatura (elige una sugerida o escribe la tuya)";
  asignaturaInput.value = entry.sesion?.asignatura || "";
  body.appendChild(buildChips(asignaturaInput));
  body.appendChild(asignaturaInput);

  const tema = buildField("Tema trabajado", "input", {
    type: "text",
    placeholder: "Ej. Ecuaciones de primer grado, ejercicios 4 a 9",
    value: entry.sesion?.tema || "",
  });
  body.appendChild(tema.wrap);

  const comentario = buildField("Comentario · opcional", "textarea", {
    rows: 2,
    placeholder: "Observaciones para el seguimiento del alumno…",
    value: entry.sesion?.comentario || "",
  });
  body.appendChild(comentario.wrap);

  const actions = document.createElement("div");
  actions.className = "ac-card-actions";

  const msg = document.createElement("span");
  msg.className = "ac-field-msg";

  const ausenteBtn = document.createElement("button");
  ausenteBtn.type = "button";
  ausenteBtn.className = "ac-btn ghost";
  ausenteBtn.appendChild(buildIcon("x", { size: 15 }));
  ausenteBtn.appendChild(document.createTextNode("Marcar ausente"));
  ausenteBtn.addEventListener("click", callbacks.onMarcarAusente);
  actions.append(ausenteBtn, msg);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.appendChild(buildIcon("check", { size: 15 }));
  saveBtn.appendChild(document.createTextNode("Guardar"));
  saveBtn.addEventListener("click", async () => {
    if (!asignaturaInput.value.trim() || !tema.input.value.trim()) {
      msg.textContent = "Asignatura y tema son obligatorios.";
      return;
    }
    msg.textContent = "";
    saveBtn.disabled = true;
    try {
      await saveSesionFn({
        alumno_id: entry.alumno_id,
        fecha,
        tipo: "clase",
        asignatura: asignaturaInput.value.trim(),
        tema: tema.input.value.trim(),
        comentario: comentario.input.value.trim() || null,
        motivo_ausencia: null,
      });
      callbacks.onSaved();
    } catch (err) {
      msg.textContent = err.message || "Error al guardar.";
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(saveBtn);

  body.appendChild(actions);
  return body;
}

function buildAusenciaEditBody(entry, fecha, callbacks, { saveSesionFn }) {
  const body = document.createElement("div");
  body.className = "ac-card-body";

  const motivo = buildField("Motivo de ausencia", "textarea", {
    rows: 2,
    placeholder: "Ej. Avisó la familia: enferma",
    value: entry.sesion?.motivo_ausencia || "",
  });
  body.appendChild(motivo.wrap);

  const actions = document.createElement("div");
  actions.className = "ac-card-actions";
  const msg = document.createElement("span");
  msg.className = "ac-field-msg";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "ac-btn ghost";
  cancelBtn.textContent = "Cancelar";
  cancelBtn.addEventListener("click", callbacks.onCancelarAusencia);
  actions.append(cancelBtn, msg);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.appendChild(buildIcon("check", { size: 15 }));
  saveBtn.appendChild(document.createTextNode("Guardar ausencia"));
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      await saveSesionFn({
        alumno_id: entry.alumno_id,
        fecha,
        tipo: "ausencia",
        asignatura: null,
        tema: null,
        comentario: null,
        motivo_ausencia: motivo.input.value.trim() || null,
      });
      callbacks.onSaved();
    } catch (err) {
      msg.textContent = err.message || "Error al guardar.";
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(saveBtn);

  body.appendChild(actions);
  return body;
}

function buildAusenteReadonly(entry, callbacks) {
  const box = document.createElement("div");
  box.className = "ac-absent-reason";
  box.appendChild(buildIcon("x", { size: 13 }));
  box.appendChild(document.createTextNode(entry.sesion?.motivo_ausencia || "Ausente"));
  const reactivarBtn = document.createElement("button");
  reactivarBtn.type = "button";
  reactivarBtn.className = "ac-btn ghost";
  reactivarBtn.textContent = "Reactivar";
  reactivarBtn.addEventListener("click", callbacks.onReactivar);
  box.appendChild(reactivarBtn);
  return box;
}

export function buildDiarioCard(entry, fecha, { open, onToggle, onSaved, saveSesionFn = saveSesion } = {}) {
  const estado = estadoDeEntry(entry);
  let modo = estado === "ausente" ? "ausente" : "clase";

  const card = document.createElement("article");

  function render() {
    card.className = `ac-card ${estado}`;
    card.innerHTML = "";
    card.appendChild(buildHead(entry, estado, open, onToggle));
    if (!open) return;

    const callbacks = {
      onMarcarAusente: () => { modo = "ausencia-edit"; render(); },
      onCancelarAusencia: () => { modo = "clase"; render(); },
      onReactivar: () => { modo = "clase"; render(); },
      onSaved,
    };

    if (modo === "ausencia-edit") {
      card.appendChild(buildAusenciaEditBody(entry, fecha, callbacks, { saveSesionFn }));
    } else if (modo === "ausente") {
      card.appendChild(buildAusenteReadonly(entry, callbacks));
    } else {
      card.appendChild(buildClaseBody(entry, fecha, callbacks, { saveSesionFn }));
    }
  }

  render();
  return card;
}
