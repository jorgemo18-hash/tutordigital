import { buildIcon } from "../../icons.js";
import { updateProfesor } from "../../apiProfesores.js";
import {
  fetchAlumnosDisponibles, fetchAlumnosDeProfesor, asignarAlumnoAProfesor, quitarAlumnoDeProfesor,
} from "../../apiProfesorAlumnos.js";
import { buildAlumnosAsignadosSection } from "./alumnosAsignadosSection.js";
import { createUnsavedChangesGuard } from "../../../../../shared/js/unsavedChanges/unsavedChangesGuard.js";
import { snapshotFormValues } from "../../../../../shared/js/unsavedChanges/snapshotFormValues.js";
import { attachCierreConGuarda } from "../../../../../shared/js/unsavedChanges/attachCierreConGuarda.js";

function buildCampo(label, value, tipo = "text") {
  const campo = document.createElement("div");
  campo.className = "ac-field";
  const labelEl = document.createElement("label");
  labelEl.className = "ac-field-label";
  labelEl.textContent = label;
  const input = document.createElement("input");
  input.type = tipo;
  input.className = "ac-input";
  input.value = value || "";
  campo.append(labelEl, input);
  return { wrap: campo, input };
}

// Drawer lateral del profesor — mismo patrón que gastoDrawer.js/
// alumnoDrawer.js (overlay+drawer con las clases ac-drawer-* compartidas;
// nunca modal, nunca expansión en tarjeta). Edita nombre/dirección/
// teléfono/NIF-DNI/fecha de alta (ver migraciones 094/095); email y
// activo/invitación se gestionan desde la propia tabla, no desde aquí.
export function createProfesorDrawer(root, {
  onSaved,
  updateProfesorFn = updateProfesor,
  fetchAlumnosDisponiblesFn = fetchAlumnosDisponibles,
  fetchAlumnosDeProfesorFn = fetchAlumnosDeProfesor,
  asignarFn = asignarAlumnoAProfesor,
  quitarFn = quitarAlumnoDeProfesor,
} = {}) {
  const overlay = document.createElement("div");
  overlay.className = "ac-drawer-overlay";
  const drawer = document.createElement("div");
  drawer.className = "ac-drawer";
  overlay.appendChild(drawer);
  root.appendChild(overlay);

  let profesorActual = null;
  // Reasignado en cada render() — el guard necesita leer los wraps
  // actuales, no una copia congelada de la primera apertura.
  let camposActuales = null;

  function close() {
    overlay.classList.remove("open");
  }

  // Cambios sin guardar de nombre/dirección/teléfono/NIF-DNI/fecha de
  // alta. La sección "Alumnos asignados" queda fuera a propósito: sus
  // checkboxes se guardan al instante contra el profesor (ver
  // alumnosAsignadosSection.js), no hay nada sin guardar que perder ahí.
  function snapshotProfesorForm() {
    if (!camposActuales) return [];
    return [
      camposActuales.nombre.wrap, camposActuales.direccion.wrap, camposActuales.telefono.wrap,
      camposActuales.nifDni.wrap, camposActuales.fechaAlta.wrap,
    ].flatMap((wrap) => snapshotFormValues(wrap));
  }
  const guard = createUnsavedChangesGuard({ getSnapshot: snapshotProfesorForm });
  const intentarCerrarAccidental = attachCierreConGuarda({ guard, cerrarFn: close });

  function buildFoot(campos, msg) {
    const foot = document.createElement("div");
    foot.className = "ac-drawer-foot";

    const cancelarBtn = document.createElement("button");
    cancelarBtn.type = "button";
    cancelarBtn.className = "ac-btn ghost";
    cancelarBtn.textContent = "Cancelar";
    cancelarBtn.addEventListener("click", close);

    const guardarBtn = document.createElement("button");
    guardarBtn.type = "button";
    guardarBtn.className = "ac-btn primary";
    guardarBtn.textContent = "Guardar cambios";
    guardarBtn.addEventListener("click", async () => {
      const displayName = campos.nombre.input.value.trim();
      if (!displayName) {
        msg.textContent = "El nombre es obligatorio.";
        msg.className = "ac-drawer-msg error";
        return;
      }
      guardarBtn.disabled = true;
      msg.textContent = "";
      try {
        await updateProfesorFn(profesorActual.id, {
          display_name: displayName,
          direccion: campos.direccion.input.value.trim() || null,
          telefono: campos.telefono.input.value.trim() || null,
          nif_dni: campos.nifDni.input.value.trim() || null,
          fecha_alta: campos.fechaAlta.input.value || null,
        });
        onSaved();
        close();
      } catch (err) {
        msg.textContent = err.message || "No se pudo guardar el profesor.";
        msg.className = "ac-drawer-msg error";
        guardarBtn.disabled = false;
      }
    });

    foot.append(cancelarBtn, guardarBtn);
    return foot;
  }

  function render() {
    drawer.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-drawer-head";
    const title = document.createElement("div");
    title.className = "ac-drawer-title";
    title.textContent = profesorActual.display_name || profesorActual.email;
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "ac-drawer-close";
    closeBtn.appendChild(buildIcon("close", { size: 14 }));
    closeBtn.addEventListener("click", close);
    head.append(title, closeBtn);

    camposActuales = {
      nombre: buildCampo("Nombre", profesorActual.display_name),
      direccion: buildCampo("Dirección", profesorActual.direccion),
      telefono: buildCampo("Teléfono", profesorActual.telefono, "tel"),
      nifDni: buildCampo("NIF / DNI", profesorActual.nif_dni),
      fechaAlta: buildCampo("Fecha de alta", profesorActual.fecha_alta, "date"),
    };
    const campos = camposActuales;

    const body = document.createElement("div");
    body.className = "ac-drawer-body";
    body.append(
      campos.nombre.wrap, campos.direccion.wrap, campos.telefono.wrap,
      campos.nifDni.wrap, campos.fechaAlta.wrap
    );

    // Asignar alumnos solo tiene sentido para un profesor que ya existe de
    // verdad (teacher_profiles creado) — una invitación aún pendiente no
    // tiene fila que referenciar todavía (ver tablaProfesores.js, que no
    // abre este drawer para esas filas).
    if (profesorActual.id) {
      const alumnosSection = buildAlumnosAsignadosSection({
        profesorId: profesorActual.id,
        fetchAlumnosDisponiblesFn,
        fetchAlumnosDeProfesorFn,
        asignarFn,
        quitarFn,
      });
      body.appendChild(alumnosSection.wrap);
    }

    const msg = document.createElement("div");
    msg.className = "ac-drawer-msg";

    drawer.append(head, body, msg, buildFoot(campos, msg));
    guard.marcarLimpio();
  }

  function open(profesor) {
    profesorActual = profesor;
    render();
    overlay.classList.add("open");
  }

  overlay.addEventListener("click", (ev) => { if (ev.target === overlay) intentarCerrarAccidental(); });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && overlay.classList.contains("open")) intentarCerrarAccidental();
  });

  return { open, close };
}
