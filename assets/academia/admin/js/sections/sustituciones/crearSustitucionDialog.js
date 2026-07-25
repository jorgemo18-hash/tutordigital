// Mismo patrón que invitarDialog.js (profesores): overlay/panel propios,
// Promise resuelta con los datos o null si se cancela. A diferencia del
// profesor (que solo autodeclara para hoy, sin fechas), el admin elige
// CUALQUIER rango y CUALQUIER profesor como sustituto — sin esa
// restricción, es la propia ruta la que la aplica solo cuando quien pide
// la creación es un profesor.
function buildSelect(label, profesores) {
  const campo = document.createElement("div");
  campo.className = "ac-field";
  const labelEl = document.createElement("label");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  const select = document.createElement("select");
  select.className = "ac-input";
  for (const p of profesores) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.display_name;
    select.appendChild(opt);
  }
  campo.append(labelEl, select);
  return { campo, select };
}

function buildFecha(label) {
  const campo = document.createElement("div");
  campo.className = "ac-field";
  const labelEl = document.createElement("label");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  const input = document.createElement("input");
  input.type = "date";
  input.className = "ac-input";
  campo.append(labelEl, input);
  return { campo, input };
}

export function abrirCrearSustitucionDialog(profesores, { hoyISO }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ac-modal-overlay";
    const panel = document.createElement("div");
    panel.className = "ac-modal-panel";

    const titulo = document.createElement("p");
    titulo.className = "ac-modal-titulo";
    titulo.textContent = "Nueva sustitución";
    panel.appendChild(titulo);

    const { campo: campoSustituto, select: selectSustituto } = buildSelect("Sustituto (quién cubre)", profesores);
    const { campo: campoSustituido, select: selectSustituido } = buildSelect("Sustituido (a quién cubre)", profesores);
    if (profesores.length > 1) selectSustituido.selectedIndex = 1;
    panel.append(campoSustituto, campoSustituido);

    const { campo: campoInicio, input: inputInicio } = buildFecha("Fecha de inicio");
    const { campo: campoFin, input: inputFin } = buildFecha("Fecha de fin");
    inputInicio.value = hoyISO;
    inputFin.value = hoyISO;
    panel.append(campoInicio, campoFin);

    const aviso = document.createElement("span");
    aviso.className = "ac-drawer-msg error";
    panel.appendChild(aviso);

    const acciones = document.createElement("div");
    acciones.className = "ac-modal-acciones";

    function cerrar(valor) {
      document.removeEventListener("keydown", onKeydown);
      overlay.remove();
      resolve(valor);
    }
    function onKeydown(e) {
      if (e.key === "Escape") cerrar(null);
    }

    const crearBtn = document.createElement("button");
    crearBtn.type = "button";
    crearBtn.className = "ac-btn primary";
    crearBtn.textContent = "Crear sustitución";
    crearBtn.addEventListener("click", () => {
      if (selectSustituto.value === selectSustituido.value) {
        aviso.textContent = "El sustituto y el sustituido no pueden ser el mismo profesor.";
        return;
      }
      if (!inputInicio.value || !inputFin.value) {
        aviso.textContent = "Indica fecha de inicio y de fin.";
        return;
      }
      if (inputFin.value < inputInicio.value) {
        aviso.textContent = "La fecha de fin no puede ser anterior a la de inicio.";
        return;
      }
      cerrar({
        profesor_sustituto_id: selectSustituto.value,
        profesor_sustituido_id: selectSustituido.value,
        fecha_inicio: inputInicio.value,
        fecha_fin: inputFin.value,
      });
    });
    acciones.appendChild(crearBtn);

    const cancelarBtn = document.createElement("button");
    cancelarBtn.type = "button";
    cancelarBtn.className = "ac-btn ghost";
    cancelarBtn.textContent = "Cancelar";
    cancelarBtn.addEventListener("click", () => cerrar(null));
    acciones.appendChild(cancelarBtn);

    panel.appendChild(acciones);
    overlay.appendChild(panel);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(null); });
    document.addEventListener("keydown", onKeydown);
    document.body.appendChild(overlay);
  });
}
