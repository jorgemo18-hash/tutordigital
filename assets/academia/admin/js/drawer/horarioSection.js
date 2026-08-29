import { toMinutos, toHHMM, generarHoras } from "../../../../shared/js/horarioFranjas.js";
import { claveFranja, estadoFranja } from "./horario/ocupacionCliente.js";
import { buildProfesorSelector, profesorDeFranja } from "./horario/profesorSelector.js";

// 7 incluido aunque Ajustes no ofrezca el domingo todavía: la BD lo admite
// desde la migración 102, y sin entrada aquí una fila con dia_semana=7
// pintaría una columna con la cabecera "undefined" en vez de fallar visible.
const NOMBRES_DIA = { 1: "LU", 2: "MA", 3: "MI", 4: "JU", 5: "VI", 6: "SA", 7: "DO" };
const DIAS_POR_DEFECTO = [1, 2, 3, 4, 5];

function formatHora(hora) {
  return String(hora || "").slice(0, 5);
}

function diasDesdeConfig(diasLaborables) {
  const valores = Array.isArray(diasLaborables) && diasLaborables.length ? diasLaborables : DIAS_POR_DEFECTO;
  return [...valores].sort((a, b) => a - b).map((value) => ({ value, label: NOMBRES_DIA[value] || `D${value}` }));
}

// Cuántos OTROS alumnos ocupan ya la franja de esta celda. Se pinta solo si
// hay alguno: una rejilla llena de ceros es ruido. Idempotente — se llama
// tanto al construir como al llegar la ocupación.
function pintarOcupacion(cell, ocupados, maxPorFranja) {
  cell.querySelector(".ac-horario-ocupacion")?.remove();
  cell.classList.remove(
    "ac-horario-cell--ocupada",
    "ac-horario-cell--lleno",
    "ac-horario-cell--excedido"
  );
  if (!ocupados) return;

  const estado = estadoFranja(ocupados, maxPorFranja);
  const contador = document.createElement("span");
  contador.className = "ac-horario-ocupacion";
  contador.textContent = maxPorFranja ? `${ocupados}/${maxPorFranja}` : String(ocupados);
  contador.title = maxPorFranja
    ? `${ocupados} de ${maxPorFranja} plazas ocupadas por otros alumnos`
    : `${ocupados} ${ocupados === 1 ? "alumno" : "alumnos"} más en esta franja`;
  cell.appendChild(contador);
  cell.classList.add(`ac-horario-cell--${estado}`);
}

// `config`: {franja_inicio, franja_fin, franja_duracion, dias_laborables} de
// GET /academia/config. `horarioActual`: filas vigentes [{dia_semana,
// hora_inicio, hora_fin}] del alumno, para pre-marcar los checkboxes.
// `ocupacion`: Map `dia|HH:MM` -> nº de OTROS alumnos ya en esa franja (ver
// ocupacionCliente.js). Sin ella la rejilla se pinta igual que antes: es
// información, nunca un bloqueo — el sistema no sabe cuántas plazas tiene
// una franja y no puede decidir por el admin si le cabe uno más.
export function buildHorarioSection({ config = {}, horarioActual = [], ocupacion = new Map(), profesores = [] } = {}) {
  // null/0 = el centro no ha fijado plazas: se informa de la ocupación sin
  // compararla con nada (ver migración 106).
  const maxPorFranja = Number(config.max_alumnos_por_franja) || 0;
  const dias = diasDesdeConfig(config.dias_laborables);
  const horas = generarHoras(config.franja_inicio || "15:30", config.franja_fin || "20:30", config.franja_duracion || 60);
  const duracion = Number(config.franja_duracion) || 60;

  const marcadas = new Set(horarioActual.map((h) => `${h.dia_semana}|${formatHora(h.hora_inicio)}`));
  // Profesor que tenía cada franja antes de tocar nada: lo necesita
  // profesorDeFranja para conservarlo cuando el selector está en "(varios)".
  const profesorPrevioPorClave = new Map(
    (horarioActual || []).map((h) => [claveFranja(h.dia_semana, formatHora(h.hora_inicio)), h.profesor_id ?? null])
  );

  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "HORARIO";
  wrap.appendChild(title);
  const spacer = document.createElement("div");
  spacer.style.height = "10px";
  wrap.appendChild(spacer);

  const grid = document.createElement("div");
  grid.className = "ac-horario-grid";
  grid.style.gridTemplateColumns = `56px repeat(${dias.length}, 1fr)`;
  grid.appendChild(document.createElement("div"));
  for (const dia of dias) {
    const head = document.createElement("div");
    head.className = "ac-horario-head";
    head.textContent = dia.label;
    grid.appendChild(head);
  }

  const checkboxes = [];
  // Celdas indexadas por franja, para poder repintar solo los contadores
  // cuando llega la ocupación sin reconstruir la sección: rehacerla borraría
  // las casillas que el admin ya hubiera marcado.
  const celdasPorClave = new Map();
  for (const hora of horas) {
    const horaLabel = document.createElement("div");
    horaLabel.className = "ac-horario-hora";
    horaLabel.textContent = hora;
    grid.appendChild(horaLabel);

    for (const dia of dias) {
      const cell = document.createElement("div");
      cell.className = "ac-horario-cell";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = marcadas.has(`${dia.value}|${hora}`);
      checkbox.dataset.diaSemana = String(dia.value);
      checkbox.dataset.horaInicio = hora;
      cell.classList.toggle("ac-horario-cell--selected", checkbox.checked);
      checkbox.addEventListener("change", () => {
        cell.classList.toggle("ac-horario-cell--selected", checkbox.checked);
      });
      cell.appendChild(checkbox);

      const clave = claveFranja(dia.value, hora);
      celdasPorClave.set(clave, cell);
      pintarOcupacion(cell, ocupacion.get(clave) || 0, maxPorFranja);

      grid.appendChild(cell);
      checkboxes.push(checkbox);
    }
  }
  wrap.appendChild(grid);

  // Debajo de la rejilla, no encima: primero se eligen las horas y después
  // quién las da. Solo si el centro tiene profesores dados de alta — en un
  // centro sin ninguno, un desplegable con una sola opción vacía es ruido.
  //
  // HUECO RESERVADO, no un `if` que decide para siempre: la lista de
  // profesores llega del servidor DESPUÉS de pintar la ficha. Antes, cuando
  // llegaba, el drawer volvía a construir esta sección entera, y para no
  // borrar las casillas ya marcadas se saltaba ese repintado si el alumno
  // ya tenía horario. Resultado: el primer alumno que se abría tras cargar
  // la página se quedaba SIN selector. Con el hueco, el selector se mete
  // cuando llega la lista y la rejilla no se toca.
  const profesorSlot = document.createElement("div");
  wrap.appendChild(profesorSlot);
  let profesorCtl = null;

  function montarSelector(lista) {
    if (profesorCtl || !lista?.length) return;
    profesorCtl = buildProfesorSelector({ profesores: lista, horarioActual });
    const espacio = document.createElement("div");
    espacio.style.height = "12px";
    profesorSlot.append(espacio, profesorCtl.wrap);
  }
  montarSelector(profesores);

  return {
    wrap,
    // Actualiza los contadores en su sitio. El drawer abre al instante y la
    // ocupación llega después (ver refrescarOcupacion en alumnoDrawer.js);
    // sin esto habría que volver a render(), que borraría lo ya escrito.
    // La lista de profesores llega tarde: se mete el selector en su hueco
    // sin reconstruir nada. Idempotente — si ya está puesto, no hace nada.
    setProfesores(lista) {
      montarSelector(lista);
    },
    setOcupacion(nueva = new Map()) {
      for (const [clave, cell] of celdasPorClave) {
        pintarOcupacion(cell, nueva.get(clave) || 0, maxPorFranja);
      }
    },
    getValue: () =>
      checkboxes
        .filter((c) => c.checked)
        .map((c) => {
          const clave = claveFranja(c.dataset.diaSemana, c.dataset.horaInicio);
          return {
            dia_semana: Number(c.dataset.diaSemana),
            hora_inicio: c.dataset.horaInicio,
            hora_fin: toHHMM(toMinutos(c.dataset.horaInicio) + duracion),
            profesor_id: profesorDeFranja(profesorCtl?.getValue() ?? "", profesorPrevioPorClave.get(clave) ?? null),
          };
        }),
  };
}
