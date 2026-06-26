import { fetchAlumno } from "../api.js";
import { renderAlumnos } from "../alumnosList.js";
import { createAlumnoDrawer } from "../drawer/alumnoDrawer.js";
import { showToast } from "../toast.js";

const MENSAJE_ALUMNO_CREADO = "Alumno creado. Puedes asignarle descuentos recurrentes desde su ficha.";

// El drawer se crea una sola vez (vive montado en document.body) y se
// reutiliza en cada visita a la sección — evita apilar overlays.
export function createAlumnosSection({ config }) {
  let listCtl = null;

  const drawer = createAlumnoDrawer(document.body, {
    config: config || {},
    // `esNuevo` solo llega en true tras crear (Guardar o Borrador) — no en
    // edición ni al archivar (ver guardarNuevo/guardarBorrador en
    // alumnoDrawer.js). La sección de descuentos recurrentes solo aparece
    // editando un alumno ya existente, así que el aviso es lo que comunica
    // que ahora sí puede volver a abrirlo para asignárselos.
    onSaved: (alumno, { esNuevo } = {}) => {
      listCtl?.reload();
      if (esNuevo) showToast(MENSAJE_ALUMNO_CREADO);
    },
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
