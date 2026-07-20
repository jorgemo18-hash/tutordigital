import { fetchEconomicoFamilia } from "../api.js";
import { buildAlumnoEconomicoRow } from "./familia/alumnoEconomicoRow.js";

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
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

    for (const alumno of data.alumnos) body.appendChild(buildAlumnoEconomicoRow(alumno));

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
