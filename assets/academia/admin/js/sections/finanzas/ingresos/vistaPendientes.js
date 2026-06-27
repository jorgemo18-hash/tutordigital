import { buildPeriodoSelector } from "../../envioFamilias/periodoSelector.js";
import { fetchPendientesIngresos } from "../../../apiFinanzas.js";
import { METODOS_PAGO, metodoPagoLabel } from "../../../drawer/familia/familiaFields.js";
import { buildTickCheckbox } from "./tickCheckbox.js";

function periodoActual() {
  const hoy = new Date();
  return { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };
}

// Alumno pagado: tachado y al final de la lista del grupo (no desaparece
// del todo — el admin sigue viendo quién ya pagó dentro de ese método).
// Borrador: todavía sin enviar a la familia, se marca aparte porque
// "pendiente" normalmente implica que la familia ya lo recibió.
function buildAlumnoRow(alumno, onCambiado) {
  const row = document.createElement("div");
  row.className = `ac-pago-alumno-row ${alumno.estado === "pagado" ? "pagado" : ""}`;

  row.appendChild(buildTickCheckbox({ reciboId: alumno.recibo_id, estado: alumno.estado, onCambiado }));

  // Nombre y cuota van en la misma línea (la cuota nunca se corta);
  // "Sin enviar" va debajo del nombre, en su propia línea, solo si aplica
  // — antes los tres compartían una sola fila y el nombre se truncaba.
  const info = document.createElement("div");
  info.className = "ac-pago-alumno-info";

  const linea1 = document.createElement("div");
  linea1.className = "ac-pago-alumno-linea1";
  const nombre = document.createElement("span");
  nombre.className = "ac-pago-alumno-nombre";
  nombre.textContent = alumno.alumno_nombre;
  const cuota = document.createElement("span");
  cuota.className = "ac-pago-alumno-cuota";
  cuota.textContent = `${alumno.cuota.toFixed(2)} €`;
  linea1.append(nombre, cuota);
  info.appendChild(linea1);

  if (alumno.estado === "borrador") {
    const sinEnviar = document.createElement("span");
    sinEnviar.className = "ac-pago-alumno-sinenviar";
    sinEnviar.textContent = "Sin enviar";
    info.appendChild(sinEnviar);
  }

  row.appendChild(info);
  return row;
}

function buildGrupoCard(grupo, onCambiado) {
  const panel = document.createElement("div");
  panel.className = "ac-panel ac-pago-grupo-card";

  const titulo = document.createElement("div");
  titulo.className = "ac-panel-title";
  titulo.textContent = metodoPagoLabel(grupo.metodo_pago);
  panel.appendChild(titulo);

  const cobrados = grupo.alumnos.filter((a) => a.estado === "pagado");
  const importeCobrado = cobrados.reduce((s, a) => s + a.cuota, 0);
  const importeTotal = grupo.alumnos.reduce((s, a) => s + a.cuota, 0);

  const stats = document.createElement("div");
  stats.className = "ac-pago-grupo-stats";
  const statAlumnos = document.createElement("div");
  statAlumnos.className = "ac-pago-grupo-stat";
  statAlumnos.textContent = `${cobrados.length} / ${grupo.alumnos.length} alumnos cobrados`;
  const statImporte = document.createElement("div");
  statImporte.className = "ac-pago-grupo-stat";
  statImporte.textContent = `${importeCobrado.toFixed(2)} € / ${importeTotal.toFixed(2)} €`;
  stats.append(statAlumnos, statImporte);
  panel.appendChild(stats);

  if (!grupo.alumnos.length) {
    const empty = document.createElement("p");
    empty.className = "ac-empty";
    empty.textContent = "Sin alumnos con este método de pago.";
    panel.appendChild(empty);
    return panel;
  }

  // Pendientes/enviados primero, pagados al final (tachados) — así el
  // grupo siempre muestra arriba lo que todavía necesita atención.
  const ordenados = [...grupo.alumnos].sort((a, b) => (a.estado === "pagado") - (b.estado === "pagado"));
  for (const alumno of ordenados) panel.appendChild(buildAlumnoRow(alumno, onCambiado));

  return panel;
}

// Los 4 métodos conocidos siempre aparecen, en orden canónico (mismo que
// el selector de Familia, ver familiaFields.js) aunque ese mes no tengan
// ningún alumno. Si el backend devuelve un metodo_pago que no es ninguno
// de los 4 (null o algo inesperado), se añade aparte al final — para no
// perder esos recibos en vez de descartarlos silenciosamente.
function completarConTodosLosMetodos(gruposBackend) {
  const porMetodo = new Map(gruposBackend.map((g) => [g.metodo_pago, g.alumnos]));
  const canonicos = METODOS_PAGO.map((m) => ({ metodo_pago: m.value, alumnos: porMetodo.get(m.value) || [] }));
  const valoresCanonicos = new Set(METODOS_PAGO.map((m) => m.value));
  const extras = gruposBackend.filter((g) => !valoresCanonicos.has(g.metodo_pago));
  return [...canonicos, ...extras];
}

// Vista "Pendientes" de Ingresos — recibos del mes seleccionado,
// agrupados por método de pago de la familia. Mantiene su propio estado
// de período (se reinicia al mes actual si se vuelve a montar, igual que
// el resto de pestañas de Finanzas).
export function renderVistaPendientes(container) {
  let { mes, anio } = periodoActual();

  async function cargar() {
    container.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    container.appendChild(cargando);

    let grupos;
    try {
      grupos = await fetchPendientesIngresos({ mes, anio });
    } catch (err) {
      container.innerHTML = "";
      const p = document.createElement("p");
      p.className = "ac-error";
      p.textContent = err.message || "No se pudieron cargar los pendientes.";
      container.appendChild(p);
      return;
    }

    container.innerHTML = "";
    const selectorWrap = document.createElement("div");
    selectorWrap.style.marginBottom = "18px";
    selectorWrap.appendChild(
      buildPeriodoSelector({
        mes, anio, anioActualSistema: periodoActual().anio,
        onChange: (periodo) => { mes = periodo.mes; anio = periodo.anio; cargar(); },
      })
    );
    container.appendChild(selectorWrap);

    const grid = document.createElement("div");
    grid.className = "ac-pago-grupos";
    for (const grupo of completarConTodosLosMetodos(grupos)) grid.appendChild(buildGrupoCard(grupo, cargar));
    container.appendChild(grid);
  }

  cargar();
}
