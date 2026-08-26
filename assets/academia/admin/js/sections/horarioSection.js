import { fetchHorarioCentro, fetchAlumnos } from "../api.js";
import { alumnosSinHorario } from "../drawer/horario/ocupacionCliente.js";
import { buildRejillaCentro } from "./horario/rejillaCentro.js";
import { buildSinHorarioLista } from "./horario/sinHorarioLista.js";

// Vista global del horario del centro. Existía la capacidad en el backend
// desde siempre (GET /academia/horario ya devolvía todas las franjas para el
// rol admin, sin filtro por profesor) pero ninguna pantalla la consumía: el
// admin asignaba franjas alumno por alumno sin poder ver nunca el cuadrante
// completo, lo que obligaba a llevar un Excel en paralelo.
//
// De solo lectura a propósito: asignar sigue haciéndose en la ficha del
// alumno, que es donde ya funciona y donde está el resto del contexto
// (tarifa, familia, descuentos). Duplicar la asignación aquí sería un
// segundo camino para escribir lo mismo, y este repo ya tiene cicatrices de
// eso.
export function createHorarioSection({ config = {} } = {}) {
  function render(container) {
    container.innerHTML = "";

    const head = document.createElement("div");
    head.className = "ac-body-head";
    const title = document.createElement("h1");
    title.className = "ac-title";
    title.textContent = "Horario";
    head.appendChild(title);
    container.appendChild(head);

    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    Promise.all([fetchHorarioCentro(), fetchAlumnos({ activo: true })])
      .then(([franjas, alumnos]) => {
        cargando.remove();

        const layout = document.createElement("div");
        layout.className = "ach-layout";

        const rejillaWrap = document.createElement("div");
        rejillaWrap.className = "ach-rejilla-wrap";
        // Una sola rejilla: academia_horario no guarda quién imparte cada
        // franja, y ningún centro tiene todavía un segundo profesor. Cuando
        // lo haya, aquí se recorren los grupos y se pinta una rejilla por
        // profesor — buildRejillaCentro ya acepta un título por grupo.
        rejillaWrap.appendChild(buildRejillaCentro({ franjas, config }));

        layout.appendChild(rejillaWrap);
        layout.appendChild(buildSinHorarioLista(alumnosSinHorario(alumnos, franjas)));
        container.appendChild(layout);
      })
      .catch((err) => {
        cargando.textContent = err.message || "No se pudo cargar el horario.";
        cargando.className = "ac-error";
      });
  }

  return { render };
}
