import { buildIcon } from "../../icons.js";

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

// Un CHECK en BD ya impide guardar sustituto===sustituido (migración
// 097) — esto es solo para que la propia UI no deje llegar a intentarlo:
// deshabilita en `otro` la opción que ya está elegida en `elegido`, y si
// `otro` se queda apuntando a esa opción ahora inválida, lo mueve a la
// primera disponible.
function excluirSeleccionDe(elegido, otro) {
  for (const opt of otro.options) opt.disabled = opt.value === elegido.value;
  if (otro.value === elegido.value) {
    const alternativa = [...otro.options].find((o) => !o.disabled);
    if (alternativa) otro.value = alternativa.value;
  }
}

// La visibilidad de alumnos se resuelve contra la fecha actual (ver
// resolverAlumnoIdsVisibles.js) — una sustitución cuyo rango no incluya
// hoy no le da al profesor ningún alumno HOY, aunque sea perfectamente
// válida para cuando llegue (o hasta que llegara, si ya pasó).
export function rangoIncluyeHoy(fechaInicio, fechaFin, hoyISO) {
  return Boolean(fechaInicio) && Boolean(fechaFin) && fechaInicio <= hoyISO && hoyISO <= fechaFin;
}

// Drawer lateral "Nueva sustitución" — mismo patrón que gastoDrawer.js/
// alumnoDrawer.js/profesorDrawer.js (creado una vez con createSustitucionDrawer,
// montado en document.body, `.ac-drawer-*`). A diferencia de esos, aquí solo
// hay modo "crear" (las sustituciones no se editan, solo se revocan desde la
// tabla) — por eso `open(profesores)` no acepta una entidad existente.
export function createSustitucionDrawer(root, { onGuardar, hoyISO }) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  function close() {
    overlay.classList.remove("open");
  }

  function render(profesores) {
    drawer.innerHTML = "";
    const hoy = hoyISO();

    const head = document.createElement("div");
    head.className = "ac-drawer-head";
    const title = document.createElement("div");
    title.className = "ac-drawer-title";
    title.textContent = "Nueva sustitución";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ac-drawer-close";
    closeBtn.appendChild(buildIcon("close", { size: 14 }));
    closeBtn.addEventListener("click", close);
    head.append(title, closeBtn);

    const body = document.createElement("div");
    body.className = "ac-drawer-body";

    const { campo: campoSustituto, select: selectSustituto } = buildSelect("Sustituto (quién cubre)", profesores);
    const { campo: campoSustituido, select: selectSustituido } = buildSelect("Sustituido (a quién cubre)", profesores);
    if (profesores.length > 1) selectSustituido.selectedIndex = 1;
    body.append(campoSustituto, campoSustituido);

    excluirSeleccionDe(selectSustituto, selectSustituido);
    selectSustituto.addEventListener("change", () => excluirSeleccionDe(selectSustituto, selectSustituido));

    const { campo: campoInicio, input: inputInicio } = buildFecha("Fecha de inicio");
    const { campo: campoFin, input: inputFin } = buildFecha("Fecha de fin");
    inputInicio.value = hoy;
    inputFin.value = hoy;
    body.append(campoInicio, campoFin);

    // Distinto del `msg` de abajo (bloqueante, error de validación): esto
    // es solo informativo, nunca impide crear la sustitución.
    const avisoSinHoy = document.createElement("p");
    avisoSinHoy.className = "ac-nota hidden";
    avisoSinHoy.textContent = "Esta sustitución no incluye el día de hoy: el profesor no verá los alumnos hasta que llegue la fecha de inicio.";
    body.appendChild(avisoSinHoy);

    function actualizarAvisoSinHoy() {
      avisoSinHoy.classList.toggle("hidden", rangoIncluyeHoy(inputInicio.value, inputFin.value, hoy));
    }
    inputInicio.addEventListener("change", actualizarAvisoSinHoy);
    inputFin.addEventListener("change", actualizarAvisoSinHoy);
    actualizarAvisoSinHoy();

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";

    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "ac-btn ghost";
    cancelBtn.textContent = "Cancelar";
    cancelBtn.addEventListener("click", close);

    const right = document.createElement("div");
    right.className = "ac-drawer-foot-right";
    const crearBtn = document.createElement("button");
    crearBtn.type = "button";
    crearBtn.className = "ac-btn primary";
    crearBtn.textContent = "Crear sustitución";
    crearBtn.addEventListener("click", async () => {
      if (selectSustituto.value === selectSustituido.value) {
        msg.textContent = "El sustituto y el sustituido no pueden ser el mismo profesor.";
        msg.className = "ac-drawer-msg error";
        return;
      }
      if (!inputInicio.value || !inputFin.value) {
        msg.textContent = "Indica fecha de inicio y de fin.";
        msg.className = "ac-drawer-msg error";
        return;
      }
      if (inputFin.value < inputInicio.value) {
        msg.textContent = "La fecha de fin no puede ser anterior a la de inicio.";
        msg.className = "ac-drawer-msg error";
        return;
      }
      crearBtn.disabled = true;
      msg.textContent = "";
      try {
        await onGuardar({
          profesor_sustituto_id: selectSustituto.value,
          profesor_sustituido_id: selectSustituido.value,
          fecha_inicio: inputInicio.value,
          fecha_fin: inputFin.value,
        });
        close();
      } catch (err) {
        msg.textContent = err.message || "No se pudo crear la sustitución.";
        msg.className = "ac-drawer-msg error";
        crearBtn.disabled = false;
      }
    });
    right.appendChild(crearBtn);

    foot.append(cancelBtn, right);
    drawer.append(head, body, msg, foot);
  }

  function open(profesores) {
    render(profesores);
    overlay.classList.add("open");
  }

  return { open, close };
}
