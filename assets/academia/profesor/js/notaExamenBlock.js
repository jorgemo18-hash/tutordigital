import { saveNotaExamen } from "./api.js";
import { buildAsignaturaSelector } from "./asignaturaBlock.js";

// Un bloque de nota de examen: asignatura (chips + "Otra"), nota 0–10 y tema
// opcional. Se guarda de forma independiente del resto de la tarjeta — el
// botón "Guardar nota" hace su propio POST, no espera al guardado de sesión.
function buildNotaExamenBlock({ alumnoId, fecha, onRemove, saveNotaFn = saveNotaExamen } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-asignatura-block";

  const head = document.createElement("div");
  head.className = "ac-asignatura-block-head";
  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Nota de examen";
  head.appendChild(label);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "ac-block-remove";
  removeBtn.setAttribute("aria-label", "Quitar nota de examen");
  removeBtn.textContent = "×";
  removeBtn.addEventListener("click", () => onRemove?.());
  head.appendChild(removeBtn);
  wrap.appendChild(head);

  const selector = buildAsignaturaSelector({});
  wrap.appendChild(selector.wrap);

  const notaLabel = document.createElement("label");
  notaLabel.className = "ac-field-label ac-field-label-spaced";
  notaLabel.textContent = "Nota (0–10)";
  wrap.appendChild(notaLabel);
  const notaInput = document.createElement("input");
  notaInput.type = "number";
  notaInput.className = "ac-input";
  notaInput.min = "0";
  notaInput.max = "10";
  notaInput.step = "0.25";
  notaInput.placeholder = "Ej. 7.5";
  wrap.appendChild(notaInput);

  const temaLabel = document.createElement("label");
  temaLabel.className = "ac-field-label ac-field-label-spaced";
  temaLabel.textContent = "Tema del examen · opcional";
  wrap.appendChild(temaLabel);
  const temaInput = document.createElement("input");
  temaInput.type = "text";
  temaInput.className = "ac-input";
  wrap.appendChild(temaInput);

  const actions = document.createElement("div");
  actions.className = "ac-card-actions";
  const msg = document.createElement("span");
  msg.className = "ac-field-msg";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "ac-btn ghost";
  cancelBtn.textContent = "Cancelar";
  cancelBtn.addEventListener("click", () => onRemove?.());
  actions.append(cancelBtn, msg);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "ac-btn primary";
  saveBtn.textContent = "Guardar nota";
  saveBtn.addEventListener("click", async () => {
    const asignatura = selector.getValor();
    const nota = Number(notaInput.value);
    if (!asignatura) { msg.textContent = "Elige una asignatura."; return; }
    if (notaInput.value === "" || Number.isNaN(nota) || nota < 0 || nota > 10) {
      msg.textContent = "La nota debe estar entre 0 y 10.";
      return;
    }
    msg.textContent = "";
    saveBtn.disabled = true;
    try {
      await saveNotaFn({ alumno_id: alumnoId, fecha, asignatura, tema: temaInput.value.trim() || null, nota });
      msg.textContent = "✓ Nota guardada.";
      msg.classList.add("isSuccess");
      cancelBtn.textContent = "Cerrar";
      for (const el of wrap.querySelectorAll("input, .ac-chip")) el.disabled = true;
    } catch (err) {
      msg.textContent = err.message || "Error al guardar.";
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(saveBtn);
  wrap.appendChild(actions);

  return wrap;
}

// Sección colapsada "+ Añadir nota de examen" de la tarjeta del diario.
// Al expandirla siembra un primer bloque; "+ Añadir otra nota" añade más,
// sin límite — cada bloque se guarda y se quita de forma independiente.
export function buildNotasExamenSection(entry, fecha) {
  const section = document.createElement("div");

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "ac-chip ac-notas-toggle";
  toggle.textContent = "＋ Añadir nota de examen";
  section.appendChild(toggle);

  const body = document.createElement("div");
  body.className = "hidden";
  const listWrap = document.createElement("div");
  body.appendChild(listWrap);

  function addBloque() {
    let bloqueEl;
    bloqueEl = buildNotaExamenBlock({
      alumnoId: entry.alumno_id,
      fecha,
      onRemove: () => bloqueEl.remove(),
    });
    listWrap.appendChild(bloqueEl);
  }

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "ac-chip";
  addBtn.textContent = "+ Añadir otra nota";
  addBtn.addEventListener("click", addBloque);
  body.appendChild(addBtn);
  section.appendChild(body);

  let expandido = false;
  toggle.addEventListener("click", () => {
    expandido = !expandido;
    body.classList.toggle("hidden", !expandido);
    toggle.classList.toggle("on", expandido);
    if (expandido && listWrap.children.length === 0) addBloque();
  });

  return section;
}
