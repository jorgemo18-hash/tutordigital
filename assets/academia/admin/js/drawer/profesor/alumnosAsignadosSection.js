// Checklist de TODOS los alumnos activos del tenant, marcando los ya
// asignados a este profesor — cada toggle se persiste al instante (añade
// o quita), sin botón "Guardar" aparte. Dependencias inyectadas
// explícitas (nunca cierra sobre imports del módulo padre) para poder
// testear sin red real.
export function buildAlumnosAsignadosSection({
  profesorId,
  fetchAlumnosDisponiblesFn,
  fetchAlumnosDeProfesorFn,
  asignarFn,
  quitarFn,
}) {
  const wrap = document.createElement("div");
  wrap.className = "ac-field";

  const label = document.createElement("label");
  label.className = "ac-field-label";
  label.textContent = "Alumnos asignados";
  wrap.appendChild(label);

  const lista = document.createElement("div");
  lista.className = "ac-profesor-alumnos-lista";
  wrap.appendChild(lista);

  const msg = document.createElement("span");
  msg.className = "ac-drawer-msg";
  wrap.appendChild(msg);

  async function toggle(alumnoId, checkbox) {
    checkbox.disabled = true;
    msg.textContent = "";
    try {
      if (checkbox.checked) await asignarFn(profesorId, alumnoId);
      else await quitarFn(profesorId, alumnoId);
    } catch (err) {
      checkbox.checked = !checkbox.checked;
      msg.textContent = err.message || "No se pudo actualizar la asignación.";
      msg.className = "ac-drawer-msg error";
    }
    checkbox.disabled = false;
  }

  function pintarFila(alumno, asignado) {
    const row = document.createElement("label");
    row.className = "ac-profesor-alumno-row";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = asignado;
    checkbox.addEventListener("change", () => toggle(alumno.id, checkbox));
    const texto = document.createElement("span");
    texto.textContent = alumno.curso ? `${alumno.nombre} · ${alumno.curso}` : alumno.nombre;
    row.append(checkbox, texto);
    return row;
  }

  async function cargar() {
    lista.innerHTML = "";
    lista.appendChild(Object.assign(document.createElement("p"), { className: "ac-loading", textContent: "Cargando…" }));
    try {
      const [disponibles, asignados] = await Promise.all([
        fetchAlumnosDisponiblesFn(),
        fetchAlumnosDeProfesorFn(profesorId),
      ]);
      const asignadosIds = new Set(asignados.map((a) => a.id));
      lista.innerHTML = "";
      if (!disponibles.length) {
        lista.appendChild(Object.assign(document.createElement("p"), { className: "ac-empty", textContent: "No hay alumnos activos en el centro." }));
        return;
      }
      for (const alumno of disponibles) {
        lista.appendChild(pintarFila(alumno, asignadosIds.has(alumno.id)));
      }
    } catch (err) {
      lista.innerHTML = "";
      msg.textContent = err.message || "No se pudieron cargar los alumnos.";
      msg.className = "ac-drawer-msg error";
    }
  }

  cargar();
  return { wrap };
}
