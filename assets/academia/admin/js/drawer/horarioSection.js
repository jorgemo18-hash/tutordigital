import { filasDeRejilla, celdasPorClase, fusionarCeldas, celdasDeFranjas } from "../../../../shared/js/horarioTramos.js";
import { claveFranja, estadoFranja } from "./horario/ocupacionCliente.js";
import { buildProfesorSelector, profesorDeFranja } from "./horario/profesorSelector.js";
import { buildResumenFranjas, textoFranjas } from "./horario/resumenFranjas.js";
import { buildFranjasAMedida, repartirFranjas } from "./horario/franjasAMedida.js";

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
  // La rejilla va SIEMPRE de media en media hora (ver horarioTramos.js);
  // `franja_duracion` ya no dibuja las filas, solo dice cuántas casillas
  // marca un clic — la clase estándar del centro.
  const horas = filasDeRejilla(config.franja_inicio, config.franja_fin);
  const celdasClaseEstandar = celdasPorClase(config.franja_duracion);

  // Lo que la rejilla puede representar y lo que no. Una franja fuera de la
  // rejilla (a las 16:15, o después del cierre) no tiene casilla que marcar
  // y, hasta ahora, el siguiente guardado de la ficha se la llevaba por
  // delante sin decir nada — ver franjasAMedida.js.
  const { enRejilla, aMedida } = repartirFranjas(horarioActual, horas);

  // Cada casilla que ya tiene el alumno, con la franja de la que viene: hace
  // falta para pre-marcarlas TODAS (no solo la de inicio, que recortaría la
  // clase a media hora al guardar) y para conservar su profesor.
  const celdasActuales = celdasDeFranjas(enRejilla);
  const profesorPrevioPorClave = new Map(
    [...celdasActuales.entries()].map(([clave, franja]) => [clave, franja?.profesor_id ?? null])
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
  // Casillas indexadas por clave `dia|HH:MM`, para poder marcar las
  // siguientes al completar una clase estándar sin recorrer el DOM.
  const checkboxPorClave = new Map();
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
      checkbox.checked = celdasActuales.has(`${dia.value}|${hora}`);
      checkbox.dataset.diaSemana = String(dia.value);
      checkbox.dataset.horaInicio = hora;
      cell.classList.toggle("ac-horario-cell--selected", checkbox.checked);
      checkbox.addEventListener("change", () => {
        cell.classList.toggle("ac-horario-cell--selected", checkbox.checked);
        // Marcar una casilla marca la clase ESTÁNDAR entera (si dura 90
        // minutos, tres casillas): con la rejilla de media hora, obligar a
        // marcar una por una triplicaría los clics del caso normal, que es
        // el 95% de las altas. Desmarcar quita solo esa: así se recorta a
        // 16:00-17:00 sin pelearse con la rejilla.
        if (checkbox.checked) marcarClaseEstandar(dia.value, hora);
        refrescarResumen();
      });
      cell.appendChild(checkbox);

      const clave = claveFranja(dia.value, hora);
      celdasPorClave.set(clave, cell);
      checkboxPorClave.set(clave, checkbox);
      pintarOcupacion(cell, ocupacion.get(clave) || 0, maxPorFranja);

      grid.appendChild(cell);
      checkboxes.push(checkbox);
    }
  }
  wrap.appendChild(grid);

  // Las casillas marcadas, ya fundidas en clases: contiguas del mismo día
  // = UNA franja (ver horarioTramos.js). Sin fundir, una clase de hora y
  // media serían tres filas en la base de datos.
  function franjasSeleccionadas() {
    return fusionarCeldas(
      checkboxes.filter((c) => c.checked).map((c) => ({
        dia_semana: Number(c.dataset.diaSemana),
        hora_inicio: c.dataset.horaInicio,
      }))
    );
  }

  // Lo que se va a guardar: la rejilla más las franjas a medida.
  function todasLasFranjas() {
    return [...franjasSeleccionadas(), ...aMedidaCtl.getFranjas()];
  }

  // Marca las casillas siguientes del mismo día hasta completar la clase
  // estándar. No pisa nada: las que ya estaban marcadas siguen marcadas, y
  // si la clase se sale del horario del centro simplemente se marca lo que
  // cabe (no se inventan filas que la rejilla no tiene).
  function marcarClaseEstandar(dia, horaInicio) {
    const desde = horas.indexOf(horaInicio);
    if (desde < 0) return;
    for (let i = desde + 1; i < desde + celdasClaseEstandar && i < horas.length; i++) {
      const checkbox = checkboxPorClave.get(claveFranja(dia, horas[i]));
      if (!checkbox || checkbox.checked) continue;
      checkbox.checked = true;
      celdasPorClave.get(claveFranja(dia, horas[i]))?.classList.add("ac-horario-cell--selected");
    }
  }

  const aMedidaCtl = buildFranjasAMedida({
    franjasIniciales: aMedida,
    dias,
    duracionPorDefecto: Number(config.franja_duracion) || 60,
    onCambio: () => refrescarResumen(),
  });
  wrap.appendChild(aMedidaCtl.wrap);

  const resumen = buildResumenFranjas(todasLasFranjas());
  wrap.appendChild(resumen);
  function refrescarResumen() {
    resumen.textContent = textoFranjas(todasLasFranjas());
  }

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
      todasLasFranjas().map((franja) => ({
        ...franja,
        // El profesor que tenía la franja de la que sale la primera casilla:
        // es lo que conserva "(varios)" cuando un alumno tiene días con
        // profesores distintos.
        profesor_id: profesorDeFranja(
          profesorCtl?.getValue() ?? "",
          // Una franja a medida trae su propio profesor; una de la rejilla,
          // el de la franja de la que salía su primera casilla. Es lo que
          // conserva "(varios)" cuando el alumno tiene días con profesores
          // distintos.
          franja.profesor_id ?? profesorPrevioPorClave.get(claveFranja(franja.dia_semana, franja.hora_inicio)) ?? null
        ),
      })),
  };
}
