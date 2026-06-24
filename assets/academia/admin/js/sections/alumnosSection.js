import { fetchAlumno } from "../api.js";
import { renderAlumnos } from "../alumnosList.js";
import { createAlumnoDrawer } from "../drawer/alumnoDrawer.js";

// El drawer se crea una sola vez (vive montado en document.body) y se
// reutiliza en cada visita a la sección — evita apilar overlays.
export function createAlumnosSection({ familias, config }) {
  let listCtl = null;

  const drawer = createAlumnoDrawer(document.body, {
    familias,
    config: config || {},
    onSaved: () => listCtl?.reload(),
  });

  async function render(container) {
    listCtl = await renderAlumnos(container, {
      onNuevoAlumno: () => drawer.open(null),
      // La fila de la lista trae solo un resumen (tarifa_vigente, sin
      // horario); el drawer necesita el alumno completo.
      onAbrirAlumno: async (alumnoResumen) => {
        try {
          const alumno = await fetchAlumno(alumnoResumen.id);
          drawer.open(alumno);
        } catch {
          drawer.open(alumnoResumen);
        }
      },
    });
  }

  return { render };
}
