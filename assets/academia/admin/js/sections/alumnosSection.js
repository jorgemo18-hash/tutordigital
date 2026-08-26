import { fetchAlumno } from "../api.js";
import { renderAlumnos } from "../alumnosList.js";
import { createAlumnoDrawer } from "../drawer/alumnoDrawer.js";
import { showToast } from "../toast.js";

const MENSAJE_ALUMNO_CREADO = "Alumno creado. Puedes asignarle descuentos recurrentes desde su ficha.";
const MENSAJE_ACCESO_WARNING = "Alumno creado. No se pudo enviar el acceso al tutor. Puedes reintentarlo desde la ficha del alumno.";

// El drawer se crea una sola vez (vive montado en document.body) y se
// reutiliza en cada visita a la sección — evita apilar overlays.
export function createAlumnosSection({ config }) {
  let listCtl = null;
  // Alta en curso lanzada desde fuera (hoy, "Matricular" de la lista de
  // espera). Se guarda el `resolve` de su promesa para contestarle cuando
  // el drawer se cierre: true si el alta llegó a ocurrir, false si el
  // admin canceló. `resuelto` evita contestar dos veces — al guardar
  // llegan onSaved y onCerrado, en ese orden.
  let matriculaPendiente = null;

  function responderMatricula(creado) {
    if (!matriculaPendiente || matriculaPendiente.resuelto) return;
    matriculaPendiente.resuelto = true;
    matriculaPendiente.resolve(creado);
    matriculaPendiente = null;
  }

  const drawer = createAlumnoDrawer(document.body, {
    config: config || {},
    // `esNuevo` solo llega en true tras crear (Guardar o Borrador) — no en
    // edición ni al archivar (ver guardarNuevo/guardarBorrador en
    // alumnoDrawer.js). La sección de descuentos recurrentes solo aparece
    // editando un alumno ya existente, así que el aviso es lo que comunica
    // que ahora sí puede volver a abrirlo para asignárselos.
    onSaved: (alumno, { esNuevo, accesoWarning } = {}) => {
      listCtl?.reload();
      if (esNuevo) responderMatricula(true);
      if (accesoWarning) showToast(MENSAJE_ACCESO_WARNING, { duracionMs: 8000 });
      else if (esNuevo) showToast(MENSAJE_ALUMNO_CREADO);
    },
    // Cerrado sin haber creado nada: la matrícula pendiente se resuelve en
    // false y quien la pidió deja el contacto donde estaba.
    onCerrado: () => responderMatricula(false),
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

  // Abre un alta nueva con los datos ya puestos y resuelve a true solo si
  // el alumno se creó de verdad. Lo usa la lista de espera, que borra el
  // contacto únicamente cuando esta promesa dice que sí — nunca antes (ver
  // listaEsperaSection.js).
  function matricular(prefill) {
    return new Promise((resolve) => {
      responderMatricula(false); // por si quedó una anterior sin cerrar
      matriculaPendiente = { resolve, resuelto: false };
      drawer.open(null, { prefill });
    });
  }

  return { render, matricular };
}
