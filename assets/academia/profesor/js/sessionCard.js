import { saveSesion } from "./api.js";

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

function buildHorarioBadge(entry) {
  if (!entry.horarios?.length) return null;
  const badge = document.createElement("span");
  badge.className = "sessionCardBadge";
  badge.textContent = entry.horarios
    .map((h) => `${formatHora(h.hora_inicio)}–${formatHora(h.hora_fin)}`)
    .join(", ");
  return badge;
}

function buildField(label, tag, attrs = {}) {
  const wrap = document.createElement("label");
  wrap.className = "sessionCardField";

  const span = document.createElement("span");
  span.textContent = label;
  wrap.appendChild(span);

  const input = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    input[key] = value;
  });
  wrap.appendChild(input);

  return { wrap, input };
}

export function buildSessionCard(entry, fecha, { saveSesionFn = saveSesion } = {}) {
  const card = document.createElement("article");
  card.className = "sessionCard";
  if (entry.origen === "extra") card.classList.add("sessionCardExtra");

  const header = document.createElement("header");
  header.className = "sessionCardHeader";
  const title = document.createElement("h4");
  title.textContent = entry.nombre || "(sin nombre)";
  header.appendChild(title);
  if (entry.curso) {
    const curso = document.createElement("span");
    curso.className = "sessionCardCurso";
    curso.textContent = entry.curso;
    header.appendChild(curso);
  }
  const badge = buildHorarioBadge(entry);
  if (badge) header.appendChild(badge);
  card.appendChild(header);

  const sesion = entry.sesion || {};
  const claseFields = document.createElement("div");
  claseFields.className = "sessionCardClaseFields";
  const asignatura = buildField("Asignatura", "input", { type: "text", value: sesion.asignatura || "" });
  const tema = buildField("Tema", "input", { type: "text", value: sesion.tema || "" });
  const comentario = buildField("Comentario", "textarea", { value: sesion.comentario || "", rows: 2 });
  claseFields.append(asignatura.wrap, tema.wrap, comentario.wrap);
  card.appendChild(claseFields);

  const ausenciaFields = document.createElement("div");
  ausenciaFields.className = "sessionCardAusenciaFields hidden";
  const motivo = buildField("Motivo de ausencia", "textarea", { value: sesion.motivo_ausencia || "", rows: 2 });
  ausenciaFields.appendChild(motivo.wrap);
  card.appendChild(ausenciaFields);

  let tipo = sesion.tipo === "ausencia" ? "ausencia" : "clase";

  function applyTipo() {
    const isAusente = tipo === "ausencia";
    claseFields.classList.toggle("hidden", isAusente);
    ausenciaFields.classList.toggle("hidden", !isAusente);
    ausenteBtn.textContent = isAusente ? "Quitar ausencia" : "Marcar ausente";
    ausenteBtn.classList.toggle("isActive", isAusente);
  }

  const actions = document.createElement("div");
  actions.className = "sessionCardActions";

  const ausenteBtn = document.createElement("button");
  ausenteBtn.type = "button";
  ausenteBtn.className = "sessionCardAusenteBtn";
  ausenteBtn.addEventListener("click", () => {
    tipo = tipo === "ausencia" ? "clase" : "ausencia";
    applyTipo();
  });
  actions.appendChild(ausenteBtn);

  const status = document.createElement("span");
  status.className = "sessionCardStatus";
  actions.appendChild(status);

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "sessionCardSaveBtn";
  saveBtn.textContent = "Guardar";
  saveBtn.addEventListener("click", async () => {
    if (tipo === "clase" && (!asignatura.input.value.trim() || !tema.input.value.trim())) {
      status.textContent = "Asignatura y tema son obligatorios.";
      status.classList.add("isError");
      return;
    }
    status.textContent = "Guardando…";
    status.classList.remove("isError");
    saveBtn.disabled = true;
    try {
      await saveSesionFn({
        alumno_id: entry.alumno_id,
        fecha,
        tipo,
        asignatura: asignatura.input.value.trim() || null,
        tema: tema.input.value.trim() || null,
        comentario: comentario.input.value.trim() || null,
        motivo_ausencia: motivo.input.value.trim() || null,
      });
      status.textContent = "Guardado.";
    } catch (err) {
      status.textContent = err.message || "Error al guardar.";
      status.classList.add("isError");
    } finally {
      saveBtn.disabled = false;
    }
  });
  actions.appendChild(saveBtn);

  card.appendChild(actions);
  applyTipo();
  return card;
}
