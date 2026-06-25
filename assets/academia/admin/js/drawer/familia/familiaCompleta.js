import { fetchAlumnos } from "../../api.js";

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

function calcPrecioNeto(bruto, descuentoPct) {
  const b = Number(bruto) || 0;
  const d = Number(descuentoPct) || 0;
  return Math.round(b * (1 - d / 100) * 100) / 100;
}

function buildHermanoRow(alumno) {
  const row = document.createElement("div");
  row.className = "ac-familia-completa-row";
  const nombre = document.createElement("span");
  nombre.textContent = alumno.nombre;
  const precio = document.createElement("span");
  precio.textContent = formatEuros(alumno.tarifa_vigente?.precio_neto);
  row.append(nombre, precio);
  return row;
}

// Bloque "Familia completa" que aparece al vincular un alumno nuevo a una
// familia existente: lista de hermanos ya vinculados con su tarifa, la
// tarifa del alumno nuevo (leída en vivo de la sección Tarifa vía
// `getTarifaActual`, sin duplicar esos campos aquí) y el total conjunto.
export function buildFamiliaCompletaBlock({ familiaId, fetchAlumnosFn = fetchAlumnos, getTarifaActual }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-familia-completa";

  const title = document.createElement("div");
  title.className = "ac-familia-completa-title";
  title.textContent = "Familia completa";
  wrap.appendChild(title);

  const hermanosList = document.createElement("div");
  wrap.appendChild(hermanosList);

  const sep = document.createElement("div");
  sep.className = "ac-familia-completa-sep";
  wrap.appendChild(sep);

  const nuevoRow = document.createElement("div");
  nuevoRow.className = "ac-familia-completa-row";
  const nuevoLabel = document.createElement("span");
  nuevoLabel.textContent = "Tarifa del alumno nuevo";
  const nuevoValor = document.createElement("span");
  nuevoRow.append(nuevoLabel, nuevoValor);
  wrap.appendChild(nuevoRow);

  const totalRow = document.createElement("div");
  totalRow.className = "ac-familia-completa-total";
  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Total conjunto";
  const totalValor = document.createElement("span");
  totalRow.append(totalLabel, totalValor);
  wrap.appendChild(totalRow);

  let hermanos = [];

  function precioNetoNuevo() {
    const t = getTarifaActual?.();
    return t ? calcPrecioNeto(t.precio_bruto, t.descuento_pct) : 0;
  }

  function refresh() {
    const netoNuevo = precioNetoNuevo();
    const netoHermanos = hermanos.reduce((sum, a) => sum + Number(a.tarifa_vigente?.precio_neto || 0), 0);
    nuevoValor.textContent = formatEuros(netoNuevo);
    totalValor.textContent = formatEuros(netoHermanos + netoNuevo);
  }

  async function cargarHermanos() {
    hermanosList.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando hermanos…";
    hermanosList.appendChild(cargando);
    try {
      const todos = await fetchAlumnosFn({ activo: true });
      hermanos = todos.filter((a) => a.familia?.id === familiaId);
      hermanosList.innerHTML = "";
      if (!hermanos.length) {
        const empty = document.createElement("p");
        empty.className = "ac-empty";
        empty.textContent = "Sin otros alumnos vinculados todavía.";
        hermanosList.appendChild(empty);
      } else {
        hermanos.forEach((alumno) => hermanosList.appendChild(buildHermanoRow(alumno)));
      }
    } catch {
      hermanosList.innerHTML = "";
      const error = document.createElement("p");
      error.className = "ac-empty";
      error.textContent = "No se pudieron cargar los hermanos.";
      hermanosList.appendChild(error);
    }
    refresh();
  }
  cargarHermanos();

  return { wrap, refresh };
}
