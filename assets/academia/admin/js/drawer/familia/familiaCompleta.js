import { fetchEconomicoFamilia } from "../../api.js";
import { buildAlumnoEconomicoRow } from "./alumnoEconomicoRow.js";

function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

// Tarifa propia del alumno en el formulario (bruto + descuento_pct fijo de
// tarifa) — concepto distinto e independiente de un descuento recurrente,
// se mantiene igual que antes.
function calcPrecioNeto(bruto, descuentoPct) {
  const b = Number(bruto) || 0;
  const d = Number(descuentoPct) || 0;
  return Math.round(b * (1 - d / 100) * 100) / 100;
}

// Bloque "Familia completa": cada alumno de la familia aparece exactamente
// una vez, con su desglose económico completo — tarifa bruta, una línea por
// cada descuento recurrente que le aplique este mes y su subtotal — nunca
// solo una cifra. El desglose de los miembros ya existentes viene de
// fetchEconomicoFamilia() (mismo endpoint y mismo motor de cálculo real que
// "Familia — foto económica": intervaloAplica/desglosarDescuentosRecurrentes/
// calcularDescuento/round2 en el backend, ver economicoFamilia.js) — nunca
// se recalcula nada de eso aquí. buildAlumnoEconomicoRow (compartida con
// economicoFamiliaSection.js) es lo único que pinta esas filas, para que
// ambos bloques se vean y calculen exactamente igual.
//
// Se usa en tres flujos, todos resueltos por la MISMA comprobación
// (yaEsMiembro: ¿el alumno del drawer ya sale en la respuesta del backend
// para `familiaId`?), sin caso especial por flujo:
//   - Editar un alumno que YA pertenece a la familia mostrada: sale en esa
//     respuesta — no se añade ninguna fila extra (si se añadiera, se
//     duplicaría — bug ya corregido antes).
//   - Crear un alumno nuevo (alumnoId es null): nunca puede salir en esa
//     respuesta todavía — se añade su fila con el nombre que se esté
//     escribiendo en "Datos del alumno". No tiene descuentos recurrentes
//     que mostrar (no existe como alumno_id todavía, así que no hay nada
//     que consultar) — su fila solo lleva tarifa y subtotal, sin líneas de
//     descuento; su neto sale de su tarifa propia (calcPrecioNeto), no del
//     motor de recibos.
//   - Previsualizar un cambio a OTRA familia (editando un alumno ya
//     existente): el backend todavía no lo tiene vinculado a la familia
//     destino, así que tampoco sale en esa respuesta — misma fila "extra"
//     que en creación, con su nombre real.
export function buildFamiliaCompletaBlock({ familiaId, alumnoId = null, fetchEconomicoFn = fetchEconomicoFamilia, getTarifaActual, getNombreActual }) {
  const wrap = document.createElement("div");
  wrap.className = "ac-familia-completa";

  const title = document.createElement("div");
  title.className = "ac-familia-completa-title";
  title.textContent = "Familia completa";
  wrap.appendChild(title);

  const hermanosList = document.createElement("div");
  wrap.appendChild(hermanosList);

  const nuevoSlot = document.createElement("div");
  wrap.appendChild(nuevoSlot);

  const totalRow = document.createElement("div");
  totalRow.className = "ac-familia-completa-total";
  const totalLabel = document.createElement("span");
  totalLabel.textContent = "Total conjunto";
  const totalValor = document.createElement("span");
  totalRow.append(totalLabel, totalValor);
  wrap.appendChild(totalRow);

  let totalHermanosCargado = 0;
  let yaEsMiembro = false;

  function precioNetoActual() {
    const t = getTarifaActual?.();
    return t ? calcPrecioNeto(t.precio_bruto, t.descuento_pct) : 0;
  }

  // La fila "extra" (creación o preview de cambio) se repinta entera en
  // cada refresh() — a diferencia de los hermanos ya cargados (que solo
  // cambian al recargar la familia), esta cambia con cada tecla en Datos
  // del alumno o en Tarifa, así que no vale la pena mutar in-place.
  function refresh() {
    const netoActual = precioNetoActual();
    nuevoSlot.innerHTML = "";
    if (!yaEsMiembro) {
      nuevoSlot.appendChild(buildAlumnoEconomicoRow({
        nombre: getNombreActual?.() || "Alumno nuevo",
        tarifa: { precio_bruto: getTarifaActual?.()?.precio_bruto || 0, precio_neto: netoActual },
        descuentos: [],
        subtotalNeto: netoActual,
      }));
    }
    totalValor.textContent = formatEuros(totalHermanosCargado + (yaEsMiembro ? 0 : netoActual));
  }

  async function cargar() {
    hermanosList.innerHTML = "";
    const cargando = document.createElement("p");
    cargando.className = "ac-loading";
    cargando.textContent = "Cargando…";
    hermanosList.appendChild(cargando);
    try {
      const data = await fetchEconomicoFn(familiaId);
      const alumnos = data?.alumnos || [];
      yaEsMiembro = alumnoId != null && alumnos.some((a) => a.id === alumnoId);
      totalHermanosCargado = Number(data?.totalNeto || 0);

      hermanosList.innerHTML = "";
      if (!alumnos.length) {
        const empty = document.createElement("p");
        empty.className = "ac-empty";
        empty.textContent = "Sin otros alumnos vinculados todavía.";
        hermanosList.appendChild(empty);
      } else {
        alumnos.forEach((alumno) => hermanosList.appendChild(buildAlumnoEconomicoRow(alumno)));
      }
    } catch {
      hermanosList.innerHTML = "";
      yaEsMiembro = false;
      totalHermanosCargado = 0;
      const error = document.createElement("p");
      error.className = "ac-empty";
      error.textContent = "No se pudieron cargar los hermanos.";
      hermanosList.appendChild(error);
    }
    refresh();
  }
  cargar();

  return { wrap, refresh };
}
