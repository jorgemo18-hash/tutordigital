import { buildIcon } from "./icons.js";
import { saveSesion } from "./api.js";
import { buildAsignaturaBlock } from "./asignaturaBlock.js";
import { buildNotasExamenSection } from "./notaExamenBlock.js";

const MAX_ASIGNATURAS = 3;

// Asignaturas ya guardadas para precargar los bloques al reabrir el drawer.
// Si la sesión es antigua (solo asignatura/tema sueltos) cae en un único bloque.
function asignaturasIniciales(entry) {
  const guardadas = entry.sesion?.asignaturas;
  if (Array.isArray(guardadas) && guardadas.length) return guardadas;
  if (entry.sesion?.asignatura) return [{ nombre: entry.sesion.asignatura, tema: entry.sesion.tema || "" }];
  return [{ nombre: "", tema: "" }];
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

// Formulario "en clase": asignatura(s) + tema, notas de examen, comentario,
// y las acciones "Marcar ausente"/"Guardar". Es el contenido por defecto del
// drawer, y al que se vuelve al pulsar "Reactivar" desde el modo ausente.
export function buildClaseBody(entry, fecha, { onMarcarAusente, onGuardado, saveSesionFn = saveSesion }) {
  const body = document.createElement("div");
  body.className = "ac-drawer-body";

  const bloquesWrap = document.createElement("div");
  body.appendChild(bloquesWrap);

  // Creado ya aquí (aunque se añade al DOM más abajo, junto a "actions")
  // porque refreshSaveState() lo necesita y se dispara desde el bucle de
  // precarga de asignaturas más abajo — declararlo después (con const)
  // lanzaba "Cannot access 'saveBtn' before initialization".
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.appendChild(buildIcon("check", { size: 15 }));
  saveBtn.appendChild(document.createTextNode("Guardar"));

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-chip";
  addBtn.textContent = "+ Añadir otra asignatura";
  addBtn.addEventListener("click", () => addBloque());

  const bloques = [];
  function renderBloques() {
    bloquesWrap.innerHTML = "";
    for (const bloque of bloques) bloquesWrap.appendChild(bloque.wrap);
    addBtn.classList.toggle("hidden", bloques.length >= MAX_ASIGNATURAS);
    refreshSaveState();
  }
  function removeBloque(entryRef) {
    const idx = bloques.indexOf(entryRef);
    if (idx === -1) return;
    bloques.splice(idx, 1);
    renderBloques();
  }
  function addBloque(nombreInicial = "", temaInicial = "") {
    const posicion = bloques.length + 1;
    const bloqueRef = {};
    const built = buildAsignaturaBlock(posicion, {
      nombreInicial,
      temaInicial,
      onRemove: posicion > 1 ? () => removeBloque(bloqueRef) : null,
      onChange: refreshSaveState,
    });
    bloqueRef.wrap = built.wrap;
    bloqueRef.getValue = built.getValue;
    bloques.push(bloqueRef);
    renderBloques();
  }
  for (const a of asignaturasIniciales(entry)) addBloque(a.nombre, a.tema);
  body.appendChild(addBtn);

  body.appendChild(buildNotasExamenSection(entry, fecha));

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
  ausenteBtn.addEventListener("click", onMarcarAusente);
  actions.append(ausenteBtn, msg);

  function refreshSaveState() {
    saveBtn.disabled = !bloques[0]?.getValue().nombre;
  }
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
      const saved = await saveSesionFn({
        alumno_id: entry.alumno_id,
        fecha,
        tipo: "clase",
        asignaturas: valores.filter((v) => v.nombre),
        comentario: comentario.input.value.trim() || null,
        motivo_ausencia: null,
      });
      onGuardado(saved);
    } catch (err) {
      msg.textContent = err.message || "Error al guardar.";
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(saveBtn);
  refreshSaveState();

  body.appendChild(actions);
  return body;
}

// Formulario de ausencia: motivo (opcional) + Confirmar/Deshacer.
export function buildAusenciaEditBody(entry, fecha, { onCancelarAusencia, onGuardado, saveSesionFn = saveSesion }) {
  const body = document.createElement("div");
  body.className = "ac-drawer-body";

  const motivo = buildField("Motivo de ausencia — opcional, se guarda en el historial", "textarea", {
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
  deshacerBtn.addEventListener("click", onCancelarAusencia);
  actions.append(deshacerBtn, msg);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.appendChild(buildIcon("check", { size: 15 }));
  saveBtn.appendChild(document.createTextNode("Confirmar ausencia"));
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    try {
      const saved = await saveSesionFn({
        alumno_id: entry.alumno_id,
        fecha,
        tipo: "ausencia",
        asignaturas: [],
        comentario: null,
        motivo_ausencia: motivo.input.value.trim() || null,
      });
      onGuardado(saved);
    } catch (err) {
      msg.textContent = err.message || "Error al guardar.";
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(saveBtn);

  body.appendChild(actions);
  return body;
}

// Vista de solo lectura cuando el alumno ya está marcado ausente — motivo +
// "Reactivar" para volver al formulario de clase.
export function buildAusenteReadonly(entry, { onReactivar }) {
  const body = document.createElement("div");
  body.className = "ac-drawer-body";

  const box = document.createElement("div");
  box.className = "ac-absent-reason";
  box.appendChild(buildIcon("x", { size: 13 }));
  box.appendChild(document.createTextNode(entry.sesion?.motivo_ausencia || "Ausente"));
  const reactivarBtn = document.createElement("button");
  reactivarBtn.type = "button";
  reactivarBtn.className = "ac-btn ghost";
  reactivarBtn.textContent = "Reactivar";
  reactivarBtn.addEventListener("click", onReactivar);
  box.appendChild(reactivarBtn);

  body.appendChild(box);
  return body;
}
