import { fetchAlumnos } from "../../api.js";

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

function calcPrecioNeto(bruto, descuentoPct) {
  const b = Number(bruto) || 0;
  const d = Number(descuentoPct) || 0;
  return Math.round(b * (1 - d / 100) * 100) / 100;
}

function buildHermanoRow(alumno, precioNetoOverride) {
  const row = document.createElement("div");
  row.className = "ac-familia-completa-row";
  const nombre = document.createElement("span");
  nombre.textContent = alumno.nombre;
  const precio = document.createElement("span");
  const neto = precioNetoOverride != null ? precioNetoOverride : Number(alumno.tarifa_vigente?.precio_neto || 0);
  precio.textContent = formatEuros(neto);
  row.append(nombre, precio);
  return { row, precioEl: precio };
}

// Bloque "Familia completa": cada alumno de la familia aparece exactamente
// una vez. Se usa en tres flujos, todos resueltos por la MISMA comprobación
// (yaEsMiembro: ¿el alumno del drawer ya está en la lista de miembros que
// devuelve el backend para `familiaId`?), sin caso especial por flujo:
//   - Editar un alumno que YA pertenece a la familia mostrada: sale en la
//     lista de miembros que trae el backend — no se añade ninguna fila
//     extra (antes SÍ se añadía, duplicándolo — bug reportado).
//   - Crear un alumno nuevo (alumnoId es null): nunca puede estar en esa
//     lista todavía — se añade su fila con el nombre que se esté
//     escribiendo en ese momento en "Datos del alumno".
//   - Previsualizar un cambio a OTRA familia (editando un alumno ya
//     existente): el backend todavía no lo tiene vinculado a la familia
//     destino (su familia_id real sigue siendo la de origen hasta Guardar),
//     así que tampoco sale en la lista — se añade su fila con su nombre.
// En los dos casos "se añade su fila", el precio se lee en vivo de
// getTarifaActual (sección Tarifa, sin guardar todavía) — igual que antes.
export function buildFamiliaCompletaBlock({ familiaId, alumnoId = null, fetchAlumnosFn = fetchAlumnos, getTarifaActual, getNombreActual }) {
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
  let yaEsMiembro = false;
  // Precio de la fila del propio alumno editado, cuando ya es miembro (ver
  // yaEsMiembro) — se guarda para poder refrescarlo en refresh() si cambia
  // la tarifa DESPUÉS de la carga inicial (buildHermanoRow solo se llama una
  // vez, en cargarHermanos(); sin esta referencia esa fila se quedaría con
  // el precio congelado del primer render).
  let precioElEditado = null;

  function precioNetoActual() {
    const t = getTarifaActual?.();
    return t ? calcPrecioNeto(t.precio_bruto, t.descuento_pct) : 0;
  }

  function refresh() {
    const netoActual = precioNetoActual();
    if (precioElEditado) precioElEditado.textContent = formatEuros(netoActual);

    let netoHermanos = 0;
    for (const h of hermanos) {
      netoHermanos += (alumnoId != null && h.id === alumnoId) ? netoActual : Number(h.tarifa_vigente?.precio_neto || 0);
    }
    nuevoRow.classList.toggle("hidden", yaEsMiembro);
    if (!yaEsMiembro) {
      nuevoLabel.textContent = getNombreActual?.() || "Alumno nuevo";
      nuevoValor.textContent = formatEuros(netoActual);
    }
    totalValor.textContent = formatEuros(netoHermanos + (yaEsMiembro ? 0 : netoActual));
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
      yaEsMiembro = alumnoId != null && hermanos.some((h) => h.id === alumnoId);
      precioElEditado = null;
      hermanosList.innerHTML = "";
      if (!hermanos.length) {
        const empty = document.createElement("p");
        empty.className = "ac-empty";
        empty.textContent = "Sin otros alumnos vinculados todavía.";
        hermanosList.appendChild(empty);
      } else {
        hermanos.forEach((alumno) => {
          const esElEditado = alumnoId != null && alumno.id === alumnoId;
          const { row, precioEl } = buildHermanoRow(alumno, esElEditado ? precioNetoActual() : null);
          if (esElEditado) precioElEditado = precioEl;
          hermanosList.appendChild(row);
        });
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
