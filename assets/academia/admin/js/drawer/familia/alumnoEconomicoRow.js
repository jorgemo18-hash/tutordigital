function formatEuros(n) {
  return `${Number(n || 0).toFixed(2)} €`;
}

// Fila de un alumno con su desglose económico: tarifa bruta, una línea por
// cada descuento recurrente que le aplique (concepto + porcentaje), y su
// subtotal ya con el descuento aplicado. `alumno` llega con la forma que
// devuelve el backend (economicoFamilia.js): { nombre, tarifa:
// {precio_bruto, precio_neto}|null, descuentos: [{concepto, porcentaje,
// importe}], subtotalNeto }. Compartida por "Familia completa"
// (familiaCompleta.js) y "Familia — foto económica" (economicoFamiliaSection.js)
// para que ambos bloques pinten el desglose exactamente igual, sin cada uno
// reimplementando su propia versión del mismo markup.
export function buildAlumnoEconomicoRow(alumno) {
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
