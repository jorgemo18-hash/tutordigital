import { fetchEconomicoFamilia } from "../api.js";

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

// El único caso conocido de "dato huérfano" en esta zona (línea de recibo
// con alumno_id NULL, ver TUTORDIGITAL-BACKEND-5) no puede darse aquí: la
// respuesta viene de economicoFamilia.js, que construye la lista de
// hermanos desde academia_alumnos, nunca desde academia_recibos_lineas —
// por eso `alumno.nombre` siempre existe y no hace falta un fallback
// "(alumno eliminado)" en esta pantalla.
function buildAlumnoRow(alumno) {
  const row = document.createElement("div");
  row.className = "ac-econ-fila";

  const nombre = document.createElement("div");
  nombre.className = "ac-econ-nombre";
  nombre.textContent = alumno.nombre;
  row.appendChild(nombre);

  const tarifaLinea = document.createElement("div");
  tarifaLinea.className = "ac-familia-completa-row";
  const tarifaLabel = document.createElement("span");
  tarifaLabel.textContent = "Tarifa";
  const tarifaValor = document.createElement("span");
  tarifaValor.textContent = alumno.tarifa ? formatEuros(alumno.tarifa.precio_bruto) : "Sin tarifa asignada";
  tarifaLinea.append(tarifaLabel, tarifaValor);
  row.appendChild(tarifaLinea);

  for (const d of alumno.descuentos || []) {
    const dLinea = document.createElement("div");
    dLinea.className = "ac-familia-completa-row ac-econ-descuento";
    const dLabel = document.createElement("span");
    dLabel.textContent = `${d.concepto} (-${Number(d.porcentaje).toFixed(2)}%)`;
    const dValor = document.createElement("span");
    dValor.textContent = `-${formatEuros(d.importe)}`;
    dLinea.append(dLabel, dValor);
    row.appendChild(dLinea);
  }

  const subtotalLinea = document.createElement("div");
  subtotalLinea.className = "ac-familia-completa-row ac-econ-subtotal";
  const subLabel = document.createElement("span");
  subLabel.textContent = "Subtotal";
  const subValor = document.createElement("span");
  subValor.textContent = formatEuros(alumno.subtotalNeto);
  subtotalLinea.append(subLabel, subValor);
  row.appendChild(subtotalLinea);

  return row;
}

// Bloque "Familia — foto económica" del drawer de alumno: tarifa +
// descuentos recurrentes vigentes de cada alumno activo de la familia, con
// el mismo cálculo que produce un recibo real (ver economicoFamilia.js —
// reutiliza desglosarDescuentosRecurrentes/calcularDescuento/round2, no los
// reimplementa). Etiquetado como estimado a propósito: un recibo real puede
// variar por intervalos tipo "primer mes" ya consumido, cambios de tarifa,
// o alumnos que se archiven entre ahora y la próxima generación.
//
// Se monta con la familiaId ACTUAL del alumno (o null si no tiene). Cuando
// el admin cambia de familia desde la sección Familia (Tarea 2) sin haber
// guardado todavía, alumnoDrawer.js llama a refresh(nuevaFamiliaId) para
// previsualizar la familia recién elegida — por eso esta sección se pide
// por familiaId y no por alumnoId (ver comentario en economicoFamilia.js).
export function buildEconomicoFamiliaSection({ familiaId = null, fetchEconomicoFn = fetchEconomicoFamilia }) {
  const wrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "ac-section-title";
  title.textContent = "FAMILIA — FOTO ECONÓMICA";
  wrap.appendChild(title);
  const sub = document.createElement("div");
  sub.className = "ac-econ-sub";
  sub.textContent = "Estimado con la tarifa y los descuentos vigentes hoy — el recibo real puede variar.";
  wrap.appendChild(sub);

  const body = document.createElement("div");
  wrap.appendChild(body);

  let currentFamiliaId = familiaId;

  function renderCargando() {
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-loading";
    p.textContent = "Cargando…";
    body.appendChild(p);
  }

  function renderVacio(mensaje) {
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-empty";
    p.textContent = mensaje;
    body.appendChild(p);
  }

  function renderError(mensaje) {
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "ac-error";
    p.textContent = mensaje;
    body.appendChild(p);
  }

  function renderDatos(data) {
    body.innerHTML = "";
    if (!data.alumnos.length) {
      renderVacio("Sin alumnos activos en esta familia.");
      return;
    }

    for (const alumno of data.alumnos) body.appendChild(buildAlumnoRow(alumno));

    const totalRow = document.createElement("div");
    totalRow.className = "ac-familia-completa-total ac-econ-total";
    const totalLabel = document.createElement("span");
    totalLabel.textContent = "Total mensual estimado";
    const totalValor = document.createElement("span");
    totalValor.textContent = formatEuros(data.totalNeto);
    totalRow.append(totalLabel, totalValor);
    body.appendChild(totalRow);
  }

  function cargar() {
    if (!currentFamiliaId) {
      renderVacio("Este alumno todavía no tiene familia asignada.");
      return;
    }
    renderCargando();
    fetchEconomicoFn(currentFamiliaId)
      .then(renderDatos)
      .catch((err) => renderError(err.message || "No se pudo cargar la foto económica de la familia."));
  }

  function refresh(nuevaFamiliaId) {
    currentFamiliaId = nuevaFamiliaId;
    cargar();
  }

  cargar();

  return { wrap, refresh };
}
