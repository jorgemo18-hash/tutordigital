import { saveSesion } from "./api.js";
import { buildIcon } from "./icons.js";
import { nivelInfo } from "./nivel.js";
import { buildAsignaturaBlock } from "./asignaturaBlock.js";

const MAX_ASIGNATURAS = 3;

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

// Asignaturas ya guardadas para precargar los bloques al reabrir la tarjeta.
// Si la sesión es antigua (solo asignatura/tema sueltos) cae en un único bloque.
function asignaturasIniciales(entry) {
  const guardadas = entry.sesion?.asignaturas;
  if (Array.isArray(guardadas) && guardadas.length) return guardadas;
  if (entry.sesion?.asignatura) return [{ nombre: entry.sesion.asignatura, tema: entry.sesion.tema || "" }];
  return [{ nombre: "", tema: "" }];
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

function buildHead(entry, estadoVisual, open, onToggle) {
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
  if (!open && estadoVisual !== "pendiente") id.appendChild(buildSummaryLine(entry, estadoVisual));
  head.appendChild(id);

  const right = document.createElement("div");
  right.style.display = "flex";
  right.style.alignItems = "center";
  right.style.gap = "12px";
  right.appendChild(buildStatePill(estadoVisual));
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

function buildClaseBody(entry, fecha, callbacks, { saveSesionFn }) {
  const body = document.createElement("div");
  body.className = "ac-card-body";

  const bloquesWrap = document.createElement("div");
  body.appendChild(bloquesWrap);

  const bloques = [];
  function renderBloques() {
    bloquesWrap.innerHTML = "";
    for (const bloque of bloques) bloquesWrap.appendChild(bloque.wrap);
    addBtn.classList.toggle("hidden", bloques.length >= MAX_ASIGNATURAS);
  }
  function addBloque(nombreInicial = "", temaInicial = "") {
    const bloque = buildAsignaturaBlock(bloques.length + 1, { nombreInicial, temaInicial });
    bloques.push(bloque);
    renderBloques();
  }
  for (const a of asignaturasIniciales(entry)) addBloque(a.nombre, a.tema);

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-chip";
  addBtn.textContent = "+ Añadir otra asignatura";
  addBtn.addEventListener("click", () => addBloque());
  body.appendChild(addBtn);
  renderBloques();

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
    const valores = bloques.map((b) => b.getValue());
    const principal = valores[0];
    if (!principal.nombre || !principal.tema) {
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
        asignaturas: valores.filter((v) => v.nombre),
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

  const motivo = buildField("Motivo de ausencia (opcional) — se incluye en el email a la familia", "textarea", {
    rows: 2,
    placeholder: "Ej. Avisó la familia: enferma",
    value: entry.sesion?.motivo_ausencia || "",
  });
  body.appendChild(motivo.wrap);

  const actions = document.createElement("div");
  actions.className = "ac-card-actions";
  const msg = document.createElement("span");
  msg.className = "ac-field-msg";

  const deshacerBtn = document.createElement("button");
  deshacerBtn.type = "button";
  deshacerBtn.className = "ac-btn ghost";
  deshacerBtn.textContent = "Deshacer";
  deshacerBtn.addEventListener("click", callbacks.onCancelarAusencia);
  actions.append(deshacerBtn, msg);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.appendChild(buildIcon("check", { size: 15 }));
  saveBtn.appendChild(document.createTextNode("Confirmar ausencia"));
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      await saveSesionFn({
        alumno_id: entry.alumno_id,
        fecha,
        tipo: "ausencia",
        asignaturas: [],
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
  const estadoGuardado = estadoDeEntry(entry);
  let modo = estadoGuardado === "ausente" ? "ausente" : "clase";

  const card = document.createElement("article");

  function render() {
    // Estado visual: en cuanto se pulsa "Marcar ausente" la tarjeta ya se ve
    // como ausente, aunque todavía no se haya confirmado contra el backend.
    const estadoVisual = modo === "ausencia-edit" ? "ausente" : estadoGuardado;
    card.className = `ac-card ${estadoVisual}`;
    card.innerHTML = "";
    card.appendChild(buildHead(entry, estadoVisual, open, onToggle));
    if (!open) return;

    const callbacks = {
      onMarcarAusente: () => { modo = "ausencia-edit"; render(); },
      // "ausencia-edit" solo se entra desde "clase" (ver onMarcarAusente en
      // buildClaseBody), así que Deshacer siempre vuelve ahí.
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
